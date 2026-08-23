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

type GraphQLResponse = {
  data?: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: Array<{
            contributionDays: Array<{
              contributionCount: number;
              contributionLevel: GitHubLevel;
              weekday: number;
              date: string;
            }>;
          }>;
        };
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
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

export async function fetchGitHubContributions(
  username: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<ContributionCell[]> {
  if (!username.trim()) throw new Error("GitHub username is required");
  if (!token.trim())
    throw new Error(
      "A GitHub token is required to query the contribution calendar",
    );

  const response = await fetcher("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "git-miner-action",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => response.statusText);
    throw new Error(
      `GitHub API request failed (${response.status}): ${details}`,
    );
  }

  const payload = (await response.json()) as GraphQLResponse;
  if (payload.errors?.length)
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  const user = payload.data?.user;
  if (!user) throw new Error(`GitHub user "${username}" was not found`);

  return user.contributionsCollection.contributionCalendar.weeks.flatMap(
    (week, x) =>
      week.contributionDays.map((day) => ({
        x,
        y: day.weekday,
        date: day.date,
        count: day.contributionCount,
        level: LEVELS[day.contributionLevel],
      })),
  );
}
