import { describe, expect, it, vi } from "vitest";
import { createGitHubClient } from "../src/features/github-client/client.js";

describe("GitHub client", () => {
  it("returns an explicit rate-limit error instead of retrying past the reset time", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.ceil(Date.now() / 1000) + 60),
        },
      }),
    );
    const client = createGitHubClient(undefined, "https://github.test", request);

    await expect(client.fetchOverview("octocat")).rejects.toMatchObject({
      status: 503,
      code: "GITHUB_RATE_LIMITED",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
