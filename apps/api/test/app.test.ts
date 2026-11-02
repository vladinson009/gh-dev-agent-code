import { describe, expect, it, vi } from "vitest";
import type {
  DeveloperOverview,
  DeveloperSnapshot,
  GitHubRepository,
} from "@devscope/shared";
import { createApp } from "../src/app.js";
import type { DevScopeStore } from "../src/lib/store.js";

const profile = {
  id: 42,
  login: "octocat",
  name: "The Octocat",
  avatar_url: "https://example.com/avatar.png",
  html_url: "https://github.com/octocat",
  bio: "GitHub mascot",
  location: null,
  company: null,
  blog: null,
  followers: 5,
  following: 2,
  public_repos: 1,
  created_at: "2011-01-25T18:44:36Z",
};

const repository: GitHubRepository = {
  id: 70,
  name: "hello-world",
  full_name: "octocat/hello-world",
  description: "Test repo",
  html_url: "https://github.com/octocat/hello-world",
  language: "TypeScript",
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 1,
  created_at: "2024-03-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  pushed_at: "2025-01-01T00:00:00Z",
  default_branch: "main",
  fork: false,
};

const overview: DeveloperOverview = {
  profile,
  repositories: [repository],
  fetchedAt: "2025-01-01T00:00:00Z",
};

function makeStore(): DevScopeStore {
  let cached: DeveloperOverview | undefined;
  return {
    getCachedOverview: vi.fn(async () => cached),
    cacheOverview: vi.fn(async (_username, value) => { cached = value; }),
    saveSnapshot: vi.fn(async () => undefined),
    getDeveloperHistory: vi.fn(async (): Promise<DeveloperSnapshot[]> => []),
    getRepositoryHistory: vi.fn(async () => []),
    health: vi.fn(async () => undefined),
  };
}

describe("DevScope API", () => {
  it("validates usernames and returns a consistent error envelope", async () => {
    const app = createApp({
      store: makeStore(),
      github: { fetchOverview: vi.fn(async () => overview) },
    });
    const response = await app.request("/api/v1/developers/not%20valid");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "INVALID_USERNAME", message: "Enter a valid GitHub username." },
    });
  });

  it("maps profile, analytics, and filtered repository endpoints", async () => {
    const store = makeStore();
    const fetchOverview = vi.fn(async () => overview);
    const app = createApp({ store, github: { fetchOverview } });

    const profileResponse = await app.request("/api/v1/developers/octocat");
    const profileBody = await profileResponse.json();
    expect(profileResponse.status).toBe(200);
    expect(profileBody.data.profile.login).toBe("octocat");

    const analyticsResponse = await app.request(
      "/api/v1/developers/octocat/analytics",
    );
    const analyticsBody = await analyticsResponse.json();
    expect(analyticsBody.data).toMatchObject({
      totalStars: 12,
      totalForks: 3,
      repositoryCount: 1,
    });

    const repositoryResponse = await app.request(
      "/api/v1/developers/octocat/repositories?language=typescript&sort=stars&page=1&per_page=5",
    );
    const repositoryBody = await repositoryResponse.json();
    expect(repositoryBody.data.items.map((item: GitHubRepository) => item.name)).toEqual([
      "hello-world",
    ]);
    expect(fetchOverview).toHaveBeenCalledTimes(1);
    expect(store.saveSnapshot).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight GitHub refresh between concurrent requests", async () => {
    const fetchOverview = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return overview;
    });
    const app = createApp({ store: makeStore(), github: { fetchOverview } });
    const [first, second] = await Promise.all([
      app.request("/api/v1/developers/octocat"),
      app.request("/api/v1/developers/octocat/analytics"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchOverview).toHaveBeenCalledTimes(1);
  });
});
