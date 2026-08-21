import { useEffect, useState } from "react";
import { getCached, setCached } from "./pageCache";
import { ApiError } from "./api";

interface CachedResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  setData: (value: T) => void;
}

/**
 * Stale-while-revalidate: shows a cached value instantly (no loading
 * skeleton) while always refetching in the background to keep it current.
 * A background revalidation failure is swallowed when there's cached data
 * already on screen — it only surfaces as `error` when there's nothing to
 * fall back on. `fetcher` is intentionally not part of the effect's
 * dependencies, matching how the callers already omit useApi()'s functions
 * from their own effect deps today.
 */
export function useCachedResource<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: unknown[],
): CachedResource<T> {
  const initial = getCached<T>(cacheKey);
  const [data, setDataState] = useState<T | null>(initial ?? null);
  const [isLoading, setIsLoading] = useState(initial === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const existing = getCached<T>(cacheKey);

    if (existing !== undefined) {
      setDataState(existing);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    fetcher()
      .then((result) => {
        if (cancelled) return;
        setCached(cacheKey, result);
        setDataState(result);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (existing === undefined) {
          setError(err instanceof ApiError ? err.message : "Failed to load");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps]);

  function setData(value: T) {
    setCached(cacheKey, value);
    setDataState(value);
  }

  return { data, isLoading, error, setData };
}
