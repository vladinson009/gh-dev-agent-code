import type {
  DeveloperAnalytics,
  DeveloperOverview,
  GitHubRepository,
  PaginatedRepositories,
} from "@devscope/shared";

export function calculateAnalytics(
  repositories: GitHubRepository[],
): DeveloperAnalytics {
  const languages = new Map<string, { repositories: number; stars: number }>();
  const months = new Map<string, number>();

  for (const repository of repositories) {
    if (repository.language) {
      const current = languages.get(repository.language) ?? {
        repositories: 0,
        stars: 0,
      };
      current.repositories += 1;
      current.stars += repository.stargazers_count;
      languages.set(repository.language, current);
    }

    const month = repository.created_at.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
  }

  const totalStars = repositories.reduce(
    (sum, repository) => sum + repository.stargazers_count,
    0,
  );
  const totalForks = repositories.reduce(
    (sum, repository) => sum + repository.forks_count,
    0,
  );

  return {
    totalStars,
    totalForks,
    repositoryCount: repositories.length,
    averageStars:
      repositories.length === 0 ? 0 : Math.round(totalStars / repositories.length),
    languages: [...languages.entries()]
      .map(([language, stats]) => ({ language, ...stats }))
      .sort((left, right) => right.repositories - left.repositories),
    monthlyCreations: [...months.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([month, count]) => ({ month, repositories: count })),
  };
}

export function listRepositories(
  overview: DeveloperOverview,
  options: {
    sort: "stars" | "forks" | "updated";
    language?: string;
    q?: string;
    page: number;
    per_page: number;
  },
): PaginatedRepositories {
  const query = options.q?.toLocaleLowerCase();
  const language = options.language?.toLocaleLowerCase();
  const matching = overview.repositories
    .filter((repository) => !language || repository.language?.toLocaleLowerCase() === language)
    .filter((repository) => !query || repository.name.toLocaleLowerCase().includes(query))
    .sort((left, right) => {
      if (options.sort === "stars") {
        return right.stargazers_count - left.stargazers_count;
      }
      if (options.sort === "forks") {
        return right.forks_count - left.forks_count;
      }
      return right.updated_at.localeCompare(left.updated_at);
    });
  const start = (options.page - 1) * options.per_page;

  return {
    items: matching.slice(start, start + options.per_page),
    page: options.page,
    perPage: options.per_page,
    total: matching.length,
    totalPages: Math.ceil(matching.length / options.per_page),
  };
}
