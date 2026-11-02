import type {
  DeveloperOverview,
  DeveloperSnapshot,
} from "@devscope/shared";

export const CACHE_SECONDS = 10 * 60;

export interface DevScopeStore {
  getCachedOverview(username: string): Promise<DeveloperOverview | undefined>;
  cacheOverview(
    username: string,
    overview: DeveloperOverview,
    ttlSeconds: number,
  ): Promise<void>;
  saveSnapshot(overview: DeveloperOverview): Promise<void>;
  getDeveloperHistory(
    githubId: number,
    days: number,
  ): Promise<DeveloperSnapshot[]>;
  getRepositoryHistory(
    repositoryId: number,
    days: number,
  ): Promise<{ capturedAt: string; stars: number; forks: number }[]>;
  health(): Promise<void>;
}

export type CachedData = {
  overview: DeveloperOverview;
  cached: boolean;
};

export function cacheKey(username: string): string {
  return `developer:${username.toLowerCase()}`;
}
