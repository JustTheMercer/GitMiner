import type { ContributionCell, ContributionLevel } from "./types.js";

type GitHubLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

const LEVELS: Record<GitHubLevel, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export type GitHubRequestOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const query = `query GitMinerContributions($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays { contributionCount contributionLevel weekday date }
        }
      }
    }
  }
}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryAfterMilliseconds(response: Response, fallback: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return fallback;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(retryAfter);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallback;
}

function shouldRetry(response: Response): boolean {
  if ([429, 502, 503, 504].includes(response.status)) return true;
  return response.status === 403 && response.headers.has("retry-after");
}

function parseContributionPayload(
  payload: unknown,
  username: string,
): ContributionCell[] {
  if (!isRecord(payload))
    throw new Error("GitHub API returned invalid JSON data");

  if (Array.isArray(payload.errors) && payload.errors.length) {
    const messages = payload.errors.map((error) =>
      isRecord(error) && typeof error.message === "string"
        ? error.message
        : "Unknown GraphQL error",
    );
    throw new Error(messages.join("; "));
  }

  if (!isRecord(payload.data) || !("user" in payload.data)) {
    throw new Error("GitHub API response is missing user data");
  }
  if (payload.data.user === null) {
    throw new Error(`GitHub user "${username}" was not found`);
  }
  const user = payload.data.user;
  if (!isRecord(user)) throw new Error("GitHub API returned invalid user data");
  const collection = user.contributionsCollection;
  if (!isRecord(collection)) {
    throw new Error("GitHub API response is missing contributionsCollection");
  }
  const calendar = collection.contributionCalendar;
  if (!isRecord(calendar) || !Array.isArray(calendar.weeks)) {
    throw new Error(
      "GitHub API response is missing contributionCalendar weeks",
    );
  }

  return calendar.weeks.flatMap((week, x) => {
    if (!isRecord(week) || !Array.isArray(week.contributionDays)) {
      throw new Error(`GitHub API returned invalid contribution week ${x}`);
    }
    return week.contributionDays.map((day, dayIndex) => {
      if (!isRecord(day)) {
        throw new Error(
          `GitHub API returned invalid contribution day ${x}:${dayIndex}`,
        );
      }
      const count = day.contributionCount;
      const level = day.contributionLevel;
      const weekday = day.weekday;
      const date = day.date;
      if (!Number.isInteger(count) || (count as number) < 0) {
        throw new Error(`GitHub API returned an invalid contribution count`);
      }
      if (typeof level !== "string" || !(level in LEVELS)) {
        throw new Error(`GitHub API returned an unknown contribution level`);
      }
      if (
        !Number.isInteger(weekday) ||
        (weekday as number) < 0 ||
        (weekday as number) > 6
      ) {
        throw new Error(`GitHub API returned an invalid weekday`);
      }
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`GitHub API returned an invalid contribution date`);
      }
      return {
        x,
        y: weekday as number,
        date,
        count: count as number,
        level: LEVELS[level as GitHubLevel],
      };
    });
  });
}

export async function fetchGitHubContributions(
  username: string,
  token: string,
  fetcher: typeof fetch = fetch,
  options: GitHubRequestOptions = {},
): Promise<ContributionCell[]> {
  if (!username.trim()) throw new Error("GitHub username is required");
  if (!token.trim())
    throw new Error(
      "A GitHub token is required to query the contribution calendar",
    );

  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error(
      "GitHub API timeout must be from 1000 to 60000 milliseconds",
    );
  }
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new Error("GitHub API retries must be an integer from 0 to 5");
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new Error("GitHub API retry delay must be a non-negative number");
  }

  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetcher("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          authorization: `bearer ${token.trim()}`,
          "content-type": "application/json",
          "user-agent": "git-miner-action",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ query, variables: { login: username.trim() } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!shouldRetry(response) || attempt === retries) break;
      const delay = Math.min(
        30_000,
        retryAfterMilliseconds(response, retryDelayMs * 2 ** attempt),
      );
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw new Error(
          `GitHub API request failed after ${attempt + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      await sleep(Math.min(4_000, retryDelayMs * 2 ** attempt));
    }
  }

  if (!response) {
    throw new Error("GitHub API request failed", { cause: lastError });
  }

  if (!response.ok) {
    const details = (
      await response.text().catch(() => response.statusText)
    ).slice(0, 500);
    const rateLimitReset = response.headers.get("x-ratelimit-reset");
    const rateLimit =
      response.headers.get("x-ratelimit-remaining") === "0" && rateLimitReset
        ? ` Rate limit resets at ${new Date(Number(rateLimitReset) * 1_000).toISOString()}.`
        : "";
    throw new Error(
      `GitHub API request failed (${response.status}): ${details}.${rateLimit}`,
    );
  }

  const payload = await response.json().catch((error: unknown) => {
    throw new Error(
      `GitHub API returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  });
  return parseContributionPayload(payload, username.trim());
}
