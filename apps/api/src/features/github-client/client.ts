import type {
  DeveloperOverview,
  GitHubProfile,
  GitHubRepository,
} from "@devscope/shared";
import { ApiError } from "../../lib/errors.js";

const API_ROOT = "https://api.github.com";
const MAX_REPOSITORY_PAGES = 10;

export type GitHubClient = {
  fetchOverview(username: string): Promise<DeveloperOverview>;
};

async function requestJson<T>(
  url: string,
  token?: string,
  request: typeof fetch = fetch,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await request(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      if (attempt === 2) {
        throw new ApiError(502, "GITHUB_UNAVAILABLE", "GitHub could not be reached.");
      }
      await delay(250 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (remaining === "0" || response.headers.has("retry-after")));
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      rateLimited;

    if (retryable && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const resetAt = Number(response.headers.get("x-ratelimit-reset"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : response.status === 403 && resetAt > 0
            ? Math.max(resetAt * 1000 - Date.now(), 250)
            : 250 * 2 ** attempt;
      if (waitMs <= 2000) {
        await delay(waitMs);
        continue;
      }
    }

    if (response.status === 404) {
      throw new ApiError(404, "NOT_FOUND", "GitHub user or repository was not found.");
    }
    if (rateLimited) {
      const resetAt = response.headers.get("x-ratelimit-reset");
      throw new ApiError(
        503,
        "GITHUB_RATE_LIMITED",
        `GitHub API rate limit reached.${resetAt ? ` Try again after ${new Date(Number(resetAt) * 1000).toISOString()}.` : ""}`,
      );
    }
    if (response.status >= 500) {
      throw new ApiError(502, "GITHUB_UNAVAILABLE", "GitHub API returned an error.");
    }
    throw new ApiError(502, "GITHUB_REQUEST_FAILED", "GitHub rejected the API request.");
  }

  throw new ApiError(502, "GITHUB_UNAVAILABLE", "GitHub could not be reached.");
}

export function createGitHubClient(
  token?: string,
  baseUrl = API_ROOT,
  request: typeof fetch = fetch,
): GitHubClient {
  const fetchJson = <T>(url: string) => requestJson<T>(url, token, request);

  return {
    async fetchOverview(username) {
      const profile = await fetchJson<GitHubProfile>(
        `${baseUrl}/users/${encodeURIComponent(username)}`,
      );
      const repositories: GitHubRepository[] = [];

      for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
        const batch = await fetchJson<GitHubRepository[]>(
          `${baseUrl}/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`,
        );
        repositories.push(...batch);
        if (batch.length < 100) break;
      }

      return { profile, repositories, fetchedAt: new Date().toISOString() };
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
