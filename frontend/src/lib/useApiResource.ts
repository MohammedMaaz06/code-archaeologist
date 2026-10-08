"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { isAbortError } from "@/lib/api";

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a resource whenever `deps` change. Pass `null` as the fetcher to stay idle.
 * Superseded requests are aborted, so a slow older response can never overwrite a newer one.
 */
export function useApiResource<T>(
  fetcher: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList
) {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: fetcher !== null, // avoid flashing an "empty" state before the first request starts
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const run = fetcherRef.current;
    if (!run) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });

    run(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Request failed." });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
