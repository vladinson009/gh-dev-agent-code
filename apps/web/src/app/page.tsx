"use client";

import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  GitFork,
  Github,
  LoaderCircle,
  Search,
  ShieldCheck,
  Star,
  Users,
  Code2,
  CalendarDays,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DeveloperAnalytics,
  DeveloperSnapshot,
  GitHubProfile,
  GitHubRepository,
  PaginatedRepositories,
} from "@devscope/shared";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const LANGUAGE_COLORS = [
  "#8b5cf6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];
const PAGE_SIZE = 8;

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};
type Comparison = {
  left: { profile: GitHubProfile; analytics: DeveloperAnalytics };
  right: { profile: GitHubProfile; analytics: DeveloperAnalytics };
};

async function requestData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success || body.data === undefined) {
    throw new Error(body.error?.message ?? "The request could not be completed.");
  }
  return body.data;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [searchValue, setSearchValue] = useState("vercel");
  const [activeUsername, setActiveUsername] = useState("vercel");
  const [profile, setProfile] = useState<GitHubProfile>();
  const [fetchedAt, setFetchedAt] = useState("");
  const [analytics, setAnalytics] = useState<DeveloperAnalytics>();
  const [repositories, setRepositories] = useState<PaginatedRepositories>();
  const [history, setHistory] = useState<DeveloperSnapshot[]>([]);
  const [sort, setSort] = useState("stars");
  const [language, setLanguage] = useState("");
  const [repositorySearch, setRepositorySearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [comparison, setComparison] = useState<Comparison>();
  const [compareError, setCompareError] = useState("");
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      sort,
      page: String(page),
      per_page: String(PAGE_SIZE),
    });
    if (language) query.set("language", language);
    if (repositorySearch) query.set("q", repositorySearch);

    setLoading(true);
    setError("");

    Promise.all([
      requestData<{ profile: GitHubProfile; fetchedAt: string }>(
        `/api/v1/developers/${encodeURIComponent(activeUsername)}`,
        controller.signal,
      ),
      requestData<DeveloperAnalytics>(
        `/api/v1/developers/${encodeURIComponent(activeUsername)}/analytics`,
        controller.signal,
      ),
      requestData<PaginatedRepositories>(
        `/api/v1/developers/${encodeURIComponent(activeUsername)}/repositories?${query}`,
        controller.signal,
      ),
      requestData<{ snapshots: DeveloperSnapshot[] }>(
        `/api/v1/developers/${encodeURIComponent(activeUsername)}/history?days=365`,
        controller.signal,
      ),
    ])
      .then(([profileData, analyticsData, repositoryData, historyData]) => {
        setProfile(profileData.profile);
        setFetchedAt(profileData.fetchedAt);
        setAnalytics(analyticsData);
        setRepositories(repositoryData);
        setHistory(historyData.snapshots);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setProfile(undefined);
        setFetchedAt("");
        setAnalytics(undefined);
        setRepositories(undefined);
        setHistory([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong while loading this profile.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeUsername, language, page, repositorySearch, reloadKey, sort]);

  const languages = useMemo(
    () => analytics?.languages.map((item) => item.language) ?? [],
    [analytics],
  );
  const trend = useMemo(() => {
    if (history.length > 1) {
      const startIndex = Math.max(history.length - 7, 1);
      return history.slice(startIndex).map((snapshot, index) => {
        const previous = history[startIndex + index - 1];
        return {
          date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
            new Date(snapshot.capturedAt),
          ),
          stars: snapshot.totalStars - previous.totalStars,
          forks: snapshot.totalForks - previous.totalForks,
        };
      });
    }
    return analytics?.monthlyCreations.map((item) => ({
      date: item.month.slice(5),
      stars: item.repositories,
      forks: 0,
    })) ?? [];
  }, [analytics, history]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = searchValue.trim();
    if (!username) return;
    setPage(1);
    setLanguage("");
    setRepositorySearch("");
    setActiveUsername(username);
  }

  async function submitComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!compareLeft.trim() || !compareRight.trim()) return;
    setComparing(true);
    setCompareError("");
    setComparison(undefined);
    try {
      const result = await requestData<Comparison>(
        `/api/v1/compare/${encodeURIComponent(compareLeft.trim())}/${encodeURIComponent(compareRight.trim())}`,
      );
      setComparison(result);
    } catch (requestError) {
      setCompareError(
        requestError instanceof Error ? requestError.message : "Comparison failed.",
      );
    } finally {
      setComparing(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="DevScope home">
          <span className="brand-mark"><Code2 size={21} strokeWidth={2.2} /></span>
          <span>devscope<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span className="nav-dot" /> Overview</a>
          <a className="nav-item" href="#repositories"><BookOpen size={17} /> Repositories</a>
          <a className="nav-item" href="#languages"><Code2 size={17} /> Languages</a>
          <a className="nav-item" href="#compare"><ArrowDownUp size={17} /> Compare</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><ShieldCheck size={17} /></span>
            <div><strong>Public data, private by design</strong><p>Only public GitHub metrics are shown.</p></div>
          </div>
          <div className="api-status"><span /> API connected <span className="api-status-dot" /></div>
          <div className="sidebar-footer"><Github size={14} /> Powered by GitHub REST API</div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>Developer explorer</b></div>
          <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={14} />
          </a>
        </header>

        <div className="content">
          <section className="page-heading" id="overview">
            <div>
              <div className="eyebrow"><span /> DEVELOPER INTELLIGENCE</div>
              <h1>Developer explorer</h1>
              <p>Find the signal in a developer&apos;s public work.</p>
            </div>
            <form className="search-form" onSubmit={submitSearch}>
              <Search size={17} />
              <label className="sr-only" htmlFor="username">GitHub username</label>
              <span className="search-prefix">@</span>
              <input
                id="username"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search a developer..."
                autoComplete="off"
              />
              <button type="submit" disabled={loading}><span>Explore</span><ArrowRight size={15} /></button>
            </form>
          </section>

          {error ? (
            <section className="error-panel" role="alert">
              <div className="error-icon">!</div>
              <div><strong>Couldn&apos;t load this profile</strong><p>{error}</p></div>
              <button className="text-button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
            </section>
          ) : loading && !profile ? (
            <div className="loading-panel"><LoaderCircle className="spin" size={24} /><span>Gathering public profile data...</span></div>
          ) : profile ? (
            <>
              <section className="profile-card">
                <div className="profile-main">
                  <img className="avatar" src={profile.avatar_url} alt={`${profile.login}'s avatar`} />
                  <div className="profile-identity">
                    <div className="profile-name-row">
                      <h2>{profile.name || profile.login}</h2>
                      <a className="handle" href={profile.html_url} target="_blank" rel="noreferrer">@{profile.login}<ArrowUpRight size={13} /></a>
                    </div>
                    <p className="bio">{profile.bio || "No bio has been added to this profile yet."}</p>
                    <div className="profile-meta">
                      {profile.location && <span><span className="meta-pin">⌖</span>{profile.location}</span>}
                      <span><CalendarDays size={14} /> Joined {formatDate(profile.created_at)}</span>
                      {fetchedAt && <span><CalendarDays size={14} /> Refreshed {formatDateTime(fetchedAt)}</span>}
                      {profile.blog && <a href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`} target="_blank" rel="noreferrer"><ArrowUpRight size={13} /> Website</a>}
                    </div>
                  </div>
                </div>
                <div className="profile-followers">
                  <div><Users size={16} /><strong>{formatNumber(profile.followers)}</strong></div>
                  <span>followers</span>
                  <span className="follower-divider">·</span>
                  <span>{formatNumber(profile.following)} following</span>
                </div>
              </section>

              <section className="metric-grid" aria-label="Developer metrics">
                <MetricCard icon={<BookOpen size={17} />} label="Public repositories" value={formatNumber(profile.public_repos)} accent="violet" caption="Publicly available" />
                <MetricCard icon={<Star size={17} />} label="Total stars" value={formatNumber(analytics?.totalStars ?? 0)} accent="amber" caption="Across public repos" />
                <MetricCard icon={<GitFork size={17} />} label="Total forks" value={formatNumber(analytics?.totalForks ?? 0)} accent="blue" caption="Across public repos" />
                <MetricCard icon={<Code2 size={17} />} label="Languages" value={String(analytics?.languages.length ?? 0)} accent="green" caption="Detected in repositories" />
              </section>

              <section className="chart-grid">
                <article className="panel" id="languages">
                  <div className="panel-heading">
                    <div><h3>Language breakdown</h3><p>Repositories by primary language</p></div>
                    <span className="chart-menu">•••</span>
                  </div>
                  {analytics?.languages.length ? (
                    <div className="language-chart">
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={analytics.languages} dataKey="repositories" nameKey="language" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none">
                              {analytics.languages.map((item, index) => <Cell key={item.language} fill={LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} repositories`, ""]} contentStyle={{ background: "#111827", border: "1px solid #273244", borderRadius: 10, color: "#e5e7eb" }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center"><strong>{analytics.repositoryCount}</strong><span>repos</span></div>
                      </div>
                      <div className="legend">
                        {analytics.languages.slice(0, 5).map((item, index) => (
                          <div className="legend-row" key={item.language}>
                            <span className="legend-color" style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }} />
                            <span className="legend-label">{item.language}</span>
                            <span className="legend-count">{item.repositories}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <EmptyChart />}
                </article>
                <article className="panel">
                  <div className="panel-heading">
                    <div><h3>Repository activity</h3><p>{history.length > 1 ? "Star and fork changes since prior collection" : "Repositories created over time"}</p></div>
                    <span className="chart-period"><span /> {history.length > 1 ? "HISTORY" : "12 MONTHS"}</span>
                  </div>
                  {trend.length ? (
                    <div className="activity-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid stroke="#202a38" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#718096", fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#718096", fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: "#111827", border: "1px solid #273244", borderRadius: 10, color: "#e5e7eb" }} />
                          {history.length > 1 ? (
                            <>
                              <Bar dataKey="stars" name="Stars gained" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                              <Bar dataKey="forks" name="Forks gained" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={24} />
                            </>
                          ) : (
                            <Bar dataKey="stars" name="Repositories" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyChart text="A second snapshot will reveal how these metrics change over time." />}
                </article>
              </section>

              <section className="panel repositories-panel" id="repositories">
                <div className="repo-panel-top">
                  <div className="panel-heading">
                    <div><h3>Repositories <span className="count-pill">{repositories?.total ?? 0}</span></h3><p>Public projects by {profile.login}</p></div>
                  </div>
                  <div className="repo-controls">
                    <label className="repo-filter"><Search size={14} /><input value={repositorySearch} onChange={(event) => { setPage(1); setRepositorySearch(event.target.value); }} placeholder="Filter repos" /></label>
                    <select aria-label="Filter by language" value={language} onChange={(event) => { setPage(1); setLanguage(event.target.value); }}>
                      <option value="">All languages</option>
                      {languages.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select aria-label="Sort repositories" value={sort} onChange={(event) => setSort(event.target.value)}>
                      <option value="stars">Most stars</option>
                      <option value="updated">Recently updated</option>
                      <option value="forks">Most forks</option>
                    </select>
                  </div>
                </div>
                <div className="repository-table-wrap">
                  <table className="repository-table">
                    <thead><tr><th>REPOSITORY</th><th>LANGUAGE</th><th>STARS</th><th>FORKS</th><th>LAST UPDATED</th><th /></tr></thead>
                    <tbody>
                      {repositories?.items.map((repository) => <RepositoryRow key={repository.id} repository={repository} />)}
                      {!repositories?.items.length && <tr><td className="empty-row" colSpan={6}>No repositories match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span>Showing {repositories?.items.length ?? 0} of {repositories?.total ?? 0} repositories</span>
                  <div className="pagination">
                    <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Previous page">‹</button>
                    <span>Page <b>{page}</b> of <b>{Math.max(repositories?.totalPages ?? 1, 1)}</b></span>
                    <button disabled={page >= (repositories?.totalPages ?? 1) || loading} onClick={() => setPage((current) => current + 1)} aria-label="Next page">›</button>
                  </div>
                </div>
              </section>

              <section className="panel compare-panel" id="compare">
                <div className="compare-intro">
                  <div className="compare-icon"><ArrowDownUp size={18} /></div>
                  <div><h3>Developer comparison</h3><p>Put two public profiles side by side.</p></div>
                </div>
                <form className="compare-form" onSubmit={submitComparison}>
                  <label><span>DEVELOPER ONE</span><div><span>@</span><input value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)} placeholder="username" /></div></label>
                  <span className="versus">VS</span>
                  <label><span>DEVELOPER TWO</span><div><span>@</span><input value={compareRight} onChange={(event) => setCompareRight(event.target.value)} placeholder="username" /></div></label>
                  <button disabled={comparing || !compareLeft.trim() || !compareRight.trim()}>{comparing ? <LoaderCircle className="spin" size={15} /> : "Compare profiles"}<ArrowRight size={14} /></button>
                </form>
                {compareError && <p className="compare-error" role="alert">{compareError}</p>}
                {comparison && <ComparisonResult comparison={comparison} />}
              </section>

              <footer className="page-footer">
                <span>Data provided by GitHub REST API</span>
                <span>Historical metrics begin collecting when a profile is first explored.</span>
              </footer>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  caption: string;
}) {
  return <article className="metric-card">
    <div className={`metric-icon ${accent}`}>{icon}</div>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    <div className="metric-caption">{caption}</div>
  </article>;
}

function RepositoryRow({ repository }: { repository: GitHubRepository }) {
  return <tr>
    <td>
      <a className="repo-name" href={repository.html_url} target="_blank" rel="noreferrer">{repository.name}<ArrowUpRight size={13} /></a>
      <span className="repo-description">{repository.description || "No description provided."}</span>
    </td>
    <td>{repository.language ? <span className="language-tag"><i style={{ background: LANGUAGE_COLORS[Math.abs(repository.language.length) % LANGUAGE_COLORS.length] }} />{repository.language}</span> : <span className="muted">—</span>}</td>
    <td><span className="table-stat"><Star size={14} />{formatNumber(repository.stargazers_count)}</span></td>
    <td><span className="table-stat"><GitFork size={14} />{formatNumber(repository.forks_count)}</span></td>
    <td className="updated-cell">{formatDate(repository.updated_at)}</td>
    <td><a className="external-link" href={repository.html_url} target="_blank" rel="noreferrer" aria-label={`Open ${repository.name} on GitHub`}><ArrowUpRight size={15} /></a></td>
  </tr>;
}

function EmptyChart({ text = "No language data available for this profile yet." }: { text?: string }) {
  return <div className="empty-chart"><Code2 size={21} /><span>{text}</span></div>;
}

function ComparisonResult({ comparison }: { comparison: Comparison }) {
  const metrics = [
    { label: "Followers", left: comparison.left.profile.followers, right: comparison.right.profile.followers },
    { label: "Repositories", left: comparison.left.profile.public_repos, right: comparison.right.profile.public_repos },
    { label: "Total stars", left: comparison.left.analytics.totalStars, right: comparison.right.analytics.totalStars },
    { label: "Total forks", left: comparison.left.analytics.totalForks, right: comparison.right.analytics.totalForks },
  ];
  return <div className="comparison-result">
    {[comparison.left, comparison.right].map((developer) => <div className="comparison-person" key={developer.profile.id}>
      <img src={developer.profile.avatar_url} alt="" /><span>@{developer.profile.login}</span>
    </div>)}
    <div className="comparison-metrics">
      {metrics.map((metric) => <div className="comparison-metric" key={metric.label}>
        <span>{formatNumber(metric.left)}</span><small>{metric.label}</small><span>{formatNumber(metric.right)}</span>
      </div>)}
    </div>
  </div>;
}
