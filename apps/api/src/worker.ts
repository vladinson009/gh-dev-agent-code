import "./lib/env.js";
import { createGitHubClient } from "./features/github-client/client.js";
import { createDeveloperService } from "./features/developers/service.js";
import { createPostgresStore } from "./lib/postgres-store.js";
import { pool } from "./lib/database.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before starting the snapshot worker.");
}

const usernames = (process.env.TRACKED_GITHUB_USERNAMES ?? "")
  .split(",")
  .map((username) => username.trim())
  .filter(Boolean);
const intervalHours = Number(process.env.SNAPSHOT_INTERVAL_HOURS ?? 6);

if (usernames.length === 0) {
  throw new Error("Set TRACKED_GITHUB_USERNAMES to a comma-separated list of profiles.");
}
if (!Number.isFinite(intervalHours) || intervalHours < 1 || intervalHours > 720) {
  throw new Error("SNAPSHOT_INTERVAL_HOURS must be between 1 and 720.");
}

const developers = createDeveloperService(
  createPostgresStore(pool),
  createGitHubClient(process.env.GITHUB_TOKEN),
);

async function collectSnapshots() {
  for (const username of usernames) {
    try {
      const overview = await developers.refresh(username);
      console.info(
        `Collected ${username}: ${overview.repositories.length} repositories at ${overview.fetchedAt}`,
      );
    } catch (error) {
      console.error(`Snapshot collection failed for ${username}`, error);
    }
  }
}

await collectSnapshots();
const timer = setInterval(
  () => void collectSnapshots(),
  intervalHours * 60 * 60 * 1000,
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    void pool.end();
  });
}
