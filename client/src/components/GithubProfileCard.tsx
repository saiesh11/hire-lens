import { useState } from "react";
import type { FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CandidateDetail, GithubEnrichment, GithubSearchResult } from "../lib/types";
import { ApiError } from "../lib/api";

interface GithubProfileCardProps {
  username: string | null;
  enrichment: GithubEnrichment | null;
  candidateName: string | null;
  onSubmit: (username: string) => Promise<CandidateDetail>;
  onSearch: () => Promise<GithubSearchResult[]>;
  onUpdated: (candidate: CandidateDetail) => void;
}

export function GithubProfileCard({
  username,
  enrichment,
  candidateName,
  onSubmit,
  onSearch,
  onUpdated,
}: GithubProfileCardProps) {
  const [input, setInput] = useState(username ?? "");
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GithubSearchResult[] | null>(null);

  async function submitUsername(value: string) {
    if (!value.trim()) return;
    setIsFetching(true);
    setError(null);
    try {
      const updated = await onSubmit(value.trim());
      onUpdated(updated);
      setSearchResults(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch GitHub profile");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    await submitUsername(input);
  }

  async function handleSearch() {
    setIsSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const results = await onSearch();
      setSearchResults(results);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : "Failed to search GitHub");
    } finally {
      setIsSearching(false);
    }
  }

  function handlePickResult(result: GithubSearchResult) {
    setInput(result.login);
    void submitUsername(result.login);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">GitHub Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!username && candidateName && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSearch}
              disabled={isSearching}
              className="h-auto w-fit rounded-lg px-3 py-2"
            >
              {isSearching ? "Searching..." : `Search GitHub for "${candidateName}"`}
            </Button>

            {searchError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {searchError}
              </p>
            )}

            {searchResults && searchResults.length === 0 && !searchError && (
              <p className="text-sm text-muted-foreground">No matching GitHub profiles found.</p>
            )}

            {searchResults && searchResults.length > 0 && (
              <ul className="flex flex-col gap-2">
                {searchResults.map((result) => (
                  <li key={result.login}>
                    <button
                      type="button"
                      onClick={() => handlePickResult(result)}
                      disabled={isFetching}
                      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-indigo-300 dark:hover:border-indigo-700"
                    >
                      <img src={result.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {result.name ?? result.login} <span className="text-muted-foreground">@{result.login}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[result.bio, result.location].filter(Boolean).join(" · ") || "No bio available"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isFetching}
            placeholder="Or enter a GitHub username directly"
            className="block w-full rounded-xl border border-input bg-transparent px-3.5 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isFetching || !input.trim()} className="h-auto shrink-0 rounded-lg px-3 py-2">
            {isFetching ? "Fetching..." : enrichment ? "Refresh" : "Fetch"}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {enrichment && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <img
                src={enrichment.profile.avatarUrl}
                alt={`${enrichment.profile.login}'s GitHub avatar`}
                className="h-12 w-12 shrink-0 rounded-full"
              />
              <div className="min-w-0">
                <a
                  href={enrichment.profile.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {enrichment.profile.name ?? enrichment.profile.login}
                </a>
                {enrichment.profile.bio && (
                  <p className="text-sm text-muted-foreground">{enrichment.profile.bio}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[enrichment.profile.company, enrichment.profile.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{enrichment.profile.publicRepos}</span> repos
              </span>
              <span>
                <span className="font-semibold text-foreground">{enrichment.profile.followers}</span> followers
              </span>
              <span>
                <span className="font-semibold text-foreground">{enrichment.totalStars}</span> stars
              </span>
            </div>

            {enrichment.topLanguages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {enrichment.topLanguages.map((lang) => (
                  <Badge
                    key={lang.language}
                    variant="outline"
                    className="rounded-full border-transparent bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  >
                    {lang.language} · {lang.count}
                  </Badge>
                ))}
              </div>
            )}

            {enrichment.topRepos.length > 0 && (
              <ul className="flex flex-col gap-2">
                {enrichment.topRepos.map((repo) => (
                  <li key={repo.name} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {repo.name}
                      </a>
                      <span className="shrink-0 text-xs text-muted-foreground">★ {repo.stars}</span>
                    </div>
                    {repo.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{repo.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!enrichment && !error && username && (
          <p className="text-sm text-muted-foreground">No GitHub data fetched yet for "{username}".</p>
        )}
      </CardContent>
    </Card>
  );
}
