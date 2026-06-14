/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react";

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UseListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  [key: string]: string | number | undefined;
}

export function useList<T>(endpoint: string, options: UseListOptions = {}) {
  const [data, setData] = useState<PaginatedData<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(options.page || 1);
  const [limit, setLimit] = useState(options.limit || 10);
  const [refreshKey, setRefreshKey] = useState(0);

  const restOptions = { ...options };
  delete restOptions.page;
  delete restOptions.limit;
  const optionsKey = JSON.stringify(restOptions);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));

        Object.entries(restOptions).forEach(([key, value]) => {
          if (value !== undefined) {
            params.set(key, String(value));
          }
        });

        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch data";
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, limit, optionsKey, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const setPageNumber = (p: number) => setPage(p);
  const setPageSize = (l: number) => {
    setLimit(l);
    setPage(1);
  };

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    setPageNumber,
    setPageSize,
    refresh,
  };
}
