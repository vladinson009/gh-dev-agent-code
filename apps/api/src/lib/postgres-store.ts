import type {
  DeveloperOverview,
  DeveloperSnapshot,
} from "@devscope/shared";
import type { Pool } from "pg";
import type { DevScopeStore } from "./store.js";
import { cacheKey } from "./store.js";

export function createPostgresStore(pool: Pool): DevScopeStore {
  return {
    async getCachedOverview(username) {
      const result = await pool.query<{ payload: DeveloperOverview }>(
        `SELECT payload FROM api_cache
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [cacheKey(username)],
      );
      return result.rows[0]?.payload;
    },

    async cacheOverview(username, overview, ttlSeconds) {
      await pool.query(
        `INSERT INTO api_cache (cache_key, payload, expires_at)
         VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))
         ON CONFLICT (cache_key) DO UPDATE
         SET payload = EXCLUDED.payload,
             expires_at = EXCLUDED.expires_at,
             updated_at = NOW()`,
        [cacheKey(username), JSON.stringify(overview), ttlSeconds],
      );
    },

    async saveSnapshot(overview) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO developers (github_id, username, profile)
           VALUES ($1, $2, $3)
           ON CONFLICT (github_id) DO UPDATE
           SET username = EXCLUDED.username, profile = EXCLUDED.profile, updated_at = NOW()`,
          [
            overview.profile.id,
            overview.profile.login,
            JSON.stringify(overview.profile),
          ],
        );

        for (const repository of overview.repositories) {
          await client.query(
            `INSERT INTO repositories
               (github_id, developer_id, name, stars, forks, language, updated_at, repository)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (github_id) DO UPDATE SET
               developer_id = EXCLUDED.developer_id,
               name = EXCLUDED.name,
               stars = EXCLUDED.stars,
               forks = EXCLUDED.forks,
               language = EXCLUDED.language,
               updated_at = EXCLUDED.updated_at,
               repository = EXCLUDED.repository`,
            [
              repository.id,
              overview.profile.id,
              repository.name,
              repository.stargazers_count,
              repository.forks_count,
              repository.language,
              repository.updated_at,
              JSON.stringify(repository),
            ],
          );
        }

        const totalStars = overview.repositories.reduce(
          (sum, repository) => sum + repository.stargazers_count,
          0,
        );
        const totalForks = overview.repositories.reduce(
          (sum, repository) => sum + repository.forks_count,
          0,
        );
        await client.query(
          `INSERT INTO developer_snapshots
             (developer_id, followers, public_repos, total_stars, total_forks, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            overview.profile.id,
            overview.profile.followers,
            overview.profile.public_repos,
            totalStars,
            totalForks,
            overview.fetchedAt,
          ],
        );

        for (const repository of overview.repositories) {
          await client.query(
            `INSERT INTO repository_snapshots (repository_id, stars, forks, captured_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (repository_id, captured_at) DO NOTHING`,
            [
              repository.id,
              repository.stargazers_count,
              repository.forks_count,
              overview.fetchedAt,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getDeveloperHistory(githubId, days) {
      const result = await pool.query<{
        captured_at: Date;
        followers: number;
        public_repos: number;
        total_stars: string;
        total_forks: string;
      }>(
        `SELECT captured_at, followers, public_repos, total_stars, total_forks
         FROM developer_snapshots
         WHERE developer_id = $1
           AND captured_at >= NOW() - ($2 * INTERVAL '1 day')
         ORDER BY captured_at ASC`,
        [githubId, days],
      );
      return result.rows.map((row): DeveloperSnapshot => ({
        capturedAt: row.captured_at.toISOString(),
        followers: row.followers,
        publicRepos: row.public_repos,
        totalStars: Number(row.total_stars),
        totalForks: Number(row.total_forks),
      }));
    },

    async getRepositoryHistory(repositoryId, days) {
      const result = await pool.query<{
        captured_at: Date;
        stars: number;
        forks: number;
      }>(
        `SELECT captured_at, stars, forks
         FROM repository_snapshots
         WHERE repository_id = $1
           AND captured_at >= NOW() - ($2 * INTERVAL '1 day')
         ORDER BY captured_at ASC`,
        [repositoryId, days],
      );
      return result.rows.map((row) => ({
        capturedAt: row.captured_at.toISOString(),
        stars: row.stars,
        forks: row.forks,
      }));
    },

    async health() {
      await pool.query("SELECT 1");
    },
  };
}
