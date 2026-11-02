import { cors } from "hono/cors";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  historyQuerySchema,
  repositoryNameSchema,
  repositoryQuerySchema,
  usernameSchema,
} from "@devscope/shared";
import { calculateAnalytics, listRepositories } from "./features/developers/analytics.js";
import { createDeveloperService } from "./features/developers/service.js";
import type { GitHubClient } from "./features/github-client/client.js";
import { ApiError } from "./lib/errors.js";
import type { DevScopeStore } from "./lib/store.js";

export function createApp(dependencies: {
  store: DevScopeStore;
  github: GitHubClient;
}) {
  const app = new Hono();
  const developers = createDeveloperService(dependencies.store, dependencies.github);

  app.use(
    "*",
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
      allowMethods: ["GET", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/health/live", (context) =>
    context.json({ success: true, data: { status: "live" } }),
  );
  app.get("/health", async (context) => {
    await dependencies.store.health();
    return context.json({ success: true, data: { status: "ready" } });
  });

  app.get("/api/v1/developers/:username", async (context) => {
    const parsedUsername = usernameSchema.safeParse(context.req.param("username"));
    if (!parsedUsername.success) {
      throw new ApiError(400, "INVALID_USERNAME", "Enter a valid GitHub username.");
    }
    const result = await developers.getOverview(parsedUsername.data);
    return context.json({
      success: true,
      data: { profile: result.overview.profile, fetchedAt: result.overview.fetchedAt },
      meta: { cached: result.cached },
    });
  });

  app.get("/api/v1/developers/:username/repositories", async (context) => {
    const username = usernameSchema.safeParse(context.req.param("username"));
    const query = repositoryQuerySchema.safeParse(context.req.query());
    if (!username.success) {
      throw new ApiError(400, "INVALID_USERNAME", "Enter a valid GitHub username.");
    }
    if (!query.success) {
      throw new ApiError(400, "INVALID_QUERY", "Repository query parameters are invalid.");
    }
    const { overview, cached } = await developers.getOverview(username.data);
    return context.json({
      success: true,
      data: listRepositories(overview, query.data),
      meta: { cached, fetchedAt: overview.fetchedAt },
    });
  });

  app.get("/api/v1/developers/:username/analytics", async (context) => {
    const username = usernameSchema.safeParse(context.req.param("username"));
    if (!username.success) {
      throw new ApiError(400, "INVALID_USERNAME", "Enter a valid GitHub username.");
    }
    const { overview, cached } = await developers.getOverview(username.data);
    return context.json({
      success: true,
      data: calculateAnalytics(overview.repositories),
      meta: { cached, fetchedAt: overview.fetchedAt },
    });
  });

  app.get("/api/v1/developers/:username/history", async (context) => {
    const username = usernameSchema.safeParse(context.req.param("username"));
    const query = historyQuerySchema.safeParse(context.req.query());
    if (!username.success) {
      throw new ApiError(400, "INVALID_USERNAME", "Enter a valid GitHub username.");
    }
    if (!query.success) {
      throw new ApiError(400, "INVALID_QUERY", "History query parameters are invalid.");
    }
    const { overview } = await developers.getOverview(username.data);
    const history = await dependencies.store.getDeveloperHistory(
      overview.profile.id,
      query.data.days,
    );
    return context.json({
      success: true,
      data: { snapshots: history, days: query.data.days },
    });
  });

  app.get("/api/v1/compare/:left/:right", async (context) => {
    const leftUsername = usernameSchema.safeParse(context.req.param("left"));
    const rightUsername = usernameSchema.safeParse(context.req.param("right"));
    if (!leftUsername.success || !rightUsername.success) {
      throw new ApiError(400, "INVALID_USERNAME", "Enter valid GitHub usernames.");
    }
    const [left, right] = await Promise.all([
      developers.getOverview(leftUsername.data),
      developers.getOverview(rightUsername.data),
    ]);
    return context.json({
      success: true,
      data: {
        left: {
          profile: left.overview.profile,
          analytics: calculateAnalytics(left.overview.repositories),
        },
        right: {
          profile: right.overview.profile,
          analytics: calculateAnalytics(right.overview.repositories),
        },
      },
    });
  });

  app.get("/api/v1/repositories/:owner/:repo", async (context) => {
    const owner = usernameSchema.safeParse(context.req.param("owner"));
    const repoName = repositoryNameSchema.safeParse(context.req.param("repo"));
    if (!owner.success || !repoName.success) {
      throw new ApiError(400, "INVALID_REPOSITORY", "Enter a valid repository path.");
    }
    const { overview, cached } = await developers.getOverview(owner.data);
    const repository = overview.repositories.find(
      (item) => item.name.toLowerCase() === repoName.data.toLowerCase(),
    );
    if (!repository) {
      throw new ApiError(404, "NOT_FOUND", "GitHub repository was not found.");
    }
    return context.json({
      success: true,
      data: repository,
      meta: { cached, fetchedAt: overview.fetchedAt },
    });
  });

  app.get("/api/v1/repositories/:owner/:repo/history", async (context) => {
    const owner = usernameSchema.safeParse(context.req.param("owner"));
    const repoName = repositoryNameSchema.safeParse(context.req.param("repo"));
    const query = historyQuerySchema.safeParse(context.req.query());
    if (!owner.success || !repoName.success) {
      throw new ApiError(400, "INVALID_REPOSITORY", "Enter a valid repository path.");
    }
    if (!query.success) {
      throw new ApiError(400, "INVALID_QUERY", "History query parameters are invalid.");
    }
    const { overview } = await developers.getOverview(owner.data);
    const repository = overview.repositories.find(
      (item) => item.name.toLowerCase() === repoName.data.toLowerCase(),
    );
    if (!repository) {
      throw new ApiError(404, "NOT_FOUND", "GitHub repository was not found.");
    }
    const history = await dependencies.store.getRepositoryHistory(
      repository.id,
      query.data.days,
    );
    return context.json({
      success: true,
      data: { snapshots: history, days: query.data.days },
    });
  });

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(
        { success: false, error: { code: error.code, message: error.message } },
        error.status as ContentfulStatusCode,
      );
    }
    console.error("Unhandled API error", error);
    return context.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      },
      500,
    );
  });

  app.notFound((context) =>
    context.json({
      success: false,
      error: { code: "NOT_FOUND", message: "Endpoint was not found." },
    }, 404),
  );

  return app;
}
