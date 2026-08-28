import { describe, expect, it, vi } from "vitest";
import { fetchGitHubContributions } from "../src/github.js";

const payload = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                {
                  contributionCount: 7,
                  contributionLevel: "THIRD_QUARTILE",
                  weekday: 2,
                  date: "2026-08-25",
                },
              ],
            },
          ],
        },
      },
    },
  },
};

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

describe("GitHub contributions", () => {
  it("validates and maps a successful GraphQL response", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(payload));
    const result = await fetchGitHubContributions(
      " octocat ",
      "token",
      fetcher,
    );
    expect(result).toEqual([
      { x: 0, y: 2, date: "2026-08-25", count: 7, level: 3 },
    ]);
    const request = fetcher.mock.calls[0]!;
    expect(request[0]).toBe("https://api.github.com/graphql");
    expect((request[1]?.headers as Record<string, string>).authorization).toBe(
      "bearer token",
    );
    expect(request[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries transient failures", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "temporary" }, 503))
      .mockResolvedValueOnce(jsonResponse(payload));
    const sleep = vi.fn(async () => undefined);
    const result = await fetchGitHubContributions("octocat", "token", fetcher, {
      retries: 1,
      retryDelayMs: 0,
      sleep,
    });
    expect(result).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("reports missing users and malformed payloads", async () => {
    const missing = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: { user: null } }),
    );
    await expect(
      fetchGitHubContributions("missing", "token", missing),
    ).rejects.toThrow(/was not found/);

    const malformed = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: { user: {} } }),
    );
    await expect(
      fetchGitHubContributions("octocat", "token", malformed),
    ).rejects.toThrow(/contributionsCollection/);
  });

  it("rejects missing credentials before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchGitHubContributions("", "token", fetcher),
    ).rejects.toThrow(/username is required/);
    await expect(
      fetchGitHubContributions("octocat", "", fetcher),
    ).rejects.toThrow(/token is required/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
