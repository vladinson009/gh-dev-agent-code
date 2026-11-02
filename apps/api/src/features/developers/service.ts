import type { DeveloperOverview } from "@devscope/shared";
import type { GitHubClient } from "../github-client/client.js";
import { CACHE_SECONDS, cacheKey } from "../../lib/store.js";
import type { DevScopeStore } from "../../lib/store.js";

export type DeveloperService = {
  getOverview(username: string): Promise<{ overview: DeveloperOverview; cached: boolean }>;
  refresh(username: string): Promise<DeveloperOverview>;
};

export function createDeveloperService(
  store: DevScopeStore,
  github: GitHubClient,
): DeveloperService {
  const inFlight = new Map<string, Promise<DeveloperOverview>>();

  async function refresh(username: string): Promise<DeveloperOverview> {
    const overview = await github.fetchOverview(username);
    await store.saveSnapshot(overview);
    await store.cacheOverview(username, overview, CACHE_SECONDS);
    return overview;
  }

  return {
    async getOverview(username) {
      const key = cacheKey(username);
      const pending = inFlight.get(key);
      if (pending) return { overview: await pending, cached: false };

      const cached = await store.getCachedOverview(username);
      if (cached) return { overview: cached, cached: true };

      const concurrent = inFlight.get(key);
      if (concurrent) return { overview: await concurrent, cached: false };
      const request = refresh(username);
      inFlight.set(key, request);
      try {
        return { overview: await request, cached: false };
      } finally {
        inFlight.delete(key);
      }
    },
    refresh,
  };
}
