import { env } from "../lib/env.js";

export class GithubApiError extends Error {}

export interface GithubEnrichment {
  profile: {
    login: string;
    name: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    avatarUrl: string;
    htmlUrl: string;
    publicRepos: number;
    followers: number;
  };
  totalStars: number;
  topLanguages: { language: string; count: number }[];
  topRepos: { name: string; description: string | null; language: string | null; stars: number; url: string }[];
}

interface GithubUserResponse {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
}

interface GithubRepoResponse {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  html_url: string;
}

export interface GithubSearchResult {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

interface GithubSearchUsersResponse {
  items: {
    login: string;
    name: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string;
    html_url: string;
  }[];
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }
  return headers;
}

// Prefers a bare profile link (github.com/username, not followed by another
// path segment) over a repo link (github.com/username/some-repo) — best
// effort, not exact; a wrong match is correctable via the manual entry field.
const GITHUB_URL_PATTERN = /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}))(\/|\s|$)/;

export function extractGithubUsername(text: string): string | null {
  const match = text.match(GITHUB_URL_PATTERN);
  return match ? match[1] : null;
}

// Accepts a bare username or a full profile URL people naturally paste
// (github.com/user, https://github.com/user/, www.github.com/user/repo,
// @user) and normalizes down to just the username GitHub's API expects.
function normalizeGithubUsername(input: string): string {
  let value = input.trim();
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/^www\./i, "");
  value = value.replace(/^github\.com\//i, "");
  value = value.replace(/^@/, "");
  value = value.split(/[/?#\s]/)[0] ?? value;
  return value;
}

export async function fetchGithubProfile(rawUsername: string): Promise<GithubEnrichment> {
  const username = normalizeGithubUsername(rawUsername);
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: githubHeaders() }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100`, {
      headers: githubHeaders(),
    }),
  ]);

  if (userRes.status === 404) {
    throw new GithubApiError(`No GitHub user found with the username "${username}"`);
  }
  if (!userRes.ok || !reposRes.ok) {
    throw new GithubApiError(`GitHub API request failed (status ${userRes.status}/${reposRes.status})`);
  }

  const user = (await userRes.json()) as GithubUserResponse;
  const repos = (await reposRes.json()) as GithubRepoResponse[];
  const ownRepos = repos.filter((repo) => !repo.fork);

  const languageCounts = new Map<string, number>();
  for (const repo of ownRepos) {
    if (!repo.language) continue;
    languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
  }
  const topLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, count }));

  const topRepos = [...ownRepos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((repo) => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      url: repo.html_url,
    }));

  const totalStars = ownRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

  return {
    profile: {
      login: user.login,
      name: user.name,
      bio: user.bio,
      company: user.company,
      location: user.location,
      blog: user.blog,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      publicRepos: user.public_repos,
      followers: user.followers,
    },
    totalStars,
    topLanguages,
    topRepos,
  };
}

// The Search API has its own, much stricter rate limit than the regular
// REST endpoints above (10 req/min unauthenticated, 30 req/min
// authenticated) — fine for a user-triggered, one-click-per-candidate
// search, not something to call automatically or in bulk.
export async function searchGithubUsers(name: string): Promise<GithubSearchResult[]> {
  const query = `${name} in:name`;
  const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`, {
    headers: githubHeaders(),
  });

  if (!res.ok) {
    throw new GithubApiError(`GitHub search request failed (status ${res.status})`);
  }

  const body = (await res.json()) as GithubSearchUsersResponse;
  return body.items.map((item) => ({
    login: item.login,
    name: item.name,
    bio: item.bio,
    location: item.location,
    avatarUrl: item.avatar_url,
    htmlUrl: item.html_url,
  }));
}
