import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(1)
  .max(39)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, "Invalid GitHub username");

export const repositoryQuerySchema = z.object({
  sort: z.enum(["stars", "forks", "updated"]).default("stars"),
  language: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(10),
});

export const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(90),
});

export const repositoryNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, "Invalid repository name");

export type GitHubProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;
  fork: boolean;
};

export type DeveloperOverview = {
  profile: GitHubProfile;
  repositories: GitHubRepository[];
  fetchedAt: string;
};

export type LanguageStat = {
  language: string;
  repositories: number;
  stars: number;
};

export type DeveloperAnalytics = {
  totalStars: number;
  totalForks: number;
  repositoryCount: number;
  averageStars: number;
  languages: LanguageStat[];
  monthlyCreations: { month: string; repositories: number }[];
};

export type PaginatedRepositories = {
  items: GitHubRepository[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export type DeveloperSnapshot = {
  capturedAt: string;
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
};
