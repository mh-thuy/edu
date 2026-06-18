import { useState, useCallback } from "react";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

export function useApiCall<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (url: string, options?: RequestInit): Promise<T> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, `HTTP ${response.status}`),
        );
      }

      return await unwrapApiResponse<T>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { execute, isLoading, error };
}
