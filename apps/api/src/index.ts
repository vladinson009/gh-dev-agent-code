import "./lib/env.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGitHubClient } from "./features/github-client/client.js";
import { createPostgresStore } from "./lib/postgres-store.js";
import { pool } from "./lib/database.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before starting the API.");
}

const app = createApp({
  store: createPostgresStore(pool),
  github: createGitHubClient(process.env.GITHUB_TOKEN),
});
const port = Number(process.env.API_PORT ?? 4000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.info(`DevScope API listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    void pool.end();
  });
}
