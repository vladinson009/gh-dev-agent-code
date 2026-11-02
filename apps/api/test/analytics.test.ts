import { describe, expect, it } from "vitest";
import type { DeveloperOverview, GitHubRepository } from "@devscope/shared";
import { calculateAnalytics, listRepositories } from "../src/features/developers/analytics.js";

function repository(
  name: string,
  stars: number,
  language: string | null,
  createdAt: string,
): GitHubRepository {
  return {
    id: stars + name.length,
    name,
    full_name: `octocat/${name}`,
    description: null,
    html_url: `https://github.com/octocat/${name}`,
    language,
    stargazers_count: stars,
    forks_count: stars / 2,
    open_issues_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    pushed_at: createdAt,
    default_branch: "main",
    fork: false,
  };
}

const repositories = [
  repository("alpha", 8, "TypeScript", "2024-01-10T00:00:00.000Z"),
  repository("beta", 3, "TypeScript", "2024-02-10T00:00:00.000Z"),
  repository("gamma", 5, "Rust", "2024-02-11T00:00:00.000Z"),
];

const overview: DeveloperOverview = {
  profile: {
    id: 1,
    login: "octocat",
    name: "Octocat",
    avatar_url: "https://github.com/images/error/octocat_happy.gif",
    html_url: "https://github.com/octocat",
    bio: null,
    location: null,
    company: null,
    blog: null,
    followers: 0,
    following: 0,
    public_repos: repositories.length,
    created_at: "2011-01-25T18:44:36Z",
  },
  repositories,
  fetchedAt: "2025-01-01T00:00:00.000Z",
};

describe("developer analytics", () => {
  it("aggregates repository and language metrics", () => {
    expect(calculateAnalytics(repositories)).toEqual({
      totalStars: 16,
      totalForks: 8,
      repositoryCount: 3,
      averageStars: 5,
      languages: [
        { language: "TypeScript", repositories: 2, stars: 11 },
        { language: "Rust", repositories: 1, stars: 5 },
      ],
      monthlyCreations: [
        { month: "2024-01", repositories: 1 },
        { month: "2024-02", repositories: 2 },
      ],
    });
  });

  it("filters, sorts, and paginates without mutating the overview", () => {
    const result = listRepositories(overview, {
      sort: "stars",
      language: "typescript",
      q: "a",
      page: 1,
      per_page: 1,
    });

    expect(result.items.map((item) => item.name)).toEqual(["alpha"]);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(overview.repositories.map((item) => item.name)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });
});
