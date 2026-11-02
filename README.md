# DevScope

DevScope turns public GitHub data into developer and repository insights. The
first milestone includes a Next.js dashboard, a versioned Hono API, PostgreSQL
caching and metric snapshots, GitHub REST API rate-limit handling, and a
periodic snapshot worker.

## Stack

- **Web:** Next.js App Router, React, TypeScript, Recharts
- **API:** Hono on Node.js, TypeScript, Zod request validation
- **Data:** PostgreSQL via `pg`; SQL migrations are in `prisma/migrations`
- **Workspace:** npm workspaces with shared API types and schemas

## Run locally

Requirements: Node.js 20.9+, npm, and Docker.

```sh
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate --workspace @devscope/api
npm run dev
```

The web app runs at <http://localhost:3000>; the API runs at
<http://localhost:4000>. Add a GitHub personal access token to `GITHUB_TOKEN`
to raise the public API rate limit. A token is optional for public profile data.

To collect historical data in the background, set
`TRACKED_GITHUB_USERNAMES=octocat,vercel` and optionally
`SNAPSHOT_INTERVAL_HOURS=6`, then run:

```sh
npm run worker:dev --workspace @devscope/api
```

Snapshots are taken when a profile is first fetched and whenever the worker
collects it. History therefore starts at the first successful collection; GitHub
does not provide this historical data retroactively. The worker stores a
collection failure in logs and continues with the remaining configured users.

## API

All responses use `{ "success": true, "data": ... }`. Errors use
`{ "success": false, "error": { "code": ..., "message": ... } }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness |
| GET | `/health` | PostgreSQL readiness |
| GET | `/api/v1/developers/:username` | Public profile |
| GET | `/api/v1/developers/:username/repositories` | Filtered, sorted, paginated repositories |
| GET | `/api/v1/developers/:username/analytics` | Star, fork, language, and creation metrics |
| GET | `/api/v1/developers/:username/history?days=90` | Stored developer metric snapshots |
| GET | `/api/v1/compare/:left/:right` | Compare two public profiles |
| GET | `/api/v1/repositories/:owner/:repo` | Repository details |
| GET | `/api/v1/repositories/:owner/:repo/history?days=90` | Stored repository snapshots |

Repository lists are currently capped at the first 1,000 public repositories
per developer to keep upstream requests bounded. The API caches a normalized
developer payload in PostgreSQL for ten minutes. GitHub failures, exhausted
rate limits, and invalid input produce explicit API errors.

## Database and history

Run schema changes with `npm run db:migrate --workspace @devscope/api`.
PostgreSQL stores normalized developer/repository data, expiring API cache
entries, and append-only developer and repository metric snapshots. The schema
also defines account-owned watchlist tables for the account/auth milestone.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

## Docker

`docker compose up --build` starts PostgreSQL, the API, the web app, and a
snapshot worker. Configure `GITHUB_TOKEN` and `TRACKED_GITHUB_USERNAMES` in
`.env` before deploying. The example compose file is intended for development;
production deployments should use managed PostgreSQL, HTTPS, secret management,
and an OAuth/session implementation before enabling private user features.

## Next milestones

1. GitHub OAuth, secure sessions, and owner-authorized watchlist endpoints.
2. Queue-backed refresh scheduling and per-account collection preferences.
3. E2E/browser tests, retention policies, and production deployment configuration.
