import { DependencyList, useCallback, useEffect, useRef, useState } from "react";
import notificationsStore from "../store/notifications";
import { isAbortError } from "./abort";

export interface AsyncState<T> {
    /** Last successful result; `undefined` until the first one arrives. */
    data: T | undefined;
    isLoading: boolean;
    /** Last rejection (never an abort). Cleared when a request succeeds. */
    error: unknown;
    /** Stable across renders: re-runs the fetcher with the current deps. */
    reload: () => void;
}

export interface AsyncOptions {
    /** Not to run the request — the replacement for an early return: `!isModerator`, `userId === 0`, `orgId === 0`. */
    enabled?: boolean;
    /** Message for `notificationsStore.showError`, already put through `t()`. */
    errorMessage?: string;
    /** Not to show the banner (how `statsRes`/`profileRes` in sign-out.tsx behave). */
    silent?: boolean;
}

/**
 * One data load tied to a component's lifetime: run `fetcher`, keep its result, and
 * cancel it when the deps change or the component goes away.
 *
 * Two things it does that the hand-written `let ignore = false` effect did not:
 *
 * - Cancellation is an `AbortController`, so a superseded request is actually stopped
 *   rather than merely ignored on arrival, and its rejection is swallowed — an abort
 *   reaches neither `error`, nor the notification banner, nor the console.
 * - `fetcher` and `errorMessage` are read from a ref, so `deps` is a list of *data*,
 *   not of functions. Nothing forces `t` (a new identity on every language change)
 *   into the dependency list, and `react-hooks/exhaustive-deps` is satisfied without
 *   a disable comment at the call site.
 */
export function useAsyncData<T>(
    fetcher: (signal: AbortSignal) => Promise<T>,
    deps: DependencyList,
    options?: AsyncOptions,
): AsyncState<T> {
    const enabled = options?.enabled ?? true;
    const silent = options?.silent ?? false;

    // Refreshed on every render so a request started later uses the current closure and
    // the current language, while neither of them can retrigger the effect.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const errorMessageRef = useRef(options?.errorMessage);
    errorMessageRef.current = options?.errorMessage;
    const silentRef = useRef(silent);
    silentRef.current = silent;

    const [data, setData] = useState<T | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<unknown>(undefined);
    const [nonce, setNonce] = useState(0);

    const reload = useCallback(() => setNonce((value) => value + 1), []);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        setIsLoading(true);
        fetcherRef.current(signal)
            .then((result) => {
                if (signal.aborted) {
                    return;
                }
                setData(result);
                setError(undefined);
                setIsLoading(false);
            })
            .catch((reason: unknown) => {
                if (isAbortError(reason, signal)) {
                    return;
                }
                // The single place the pattern used to log from: every call site paired a
                // `console.error` with the banner below, and DEV-only keeps it out of prod.
                if (import.meta.env.DEV) {
                    console.error(reason);
                }
                setError(reason);
                setIsLoading(false);
                if (!silentRef.current) {
                    notificationsStore.showError(reason, errorMessageRef.current);
                }
            });
        return () => controller.abort();
        // `nonce` is what `reload` bumps; the rest is the caller's honest data list.
        // The rule cannot see through the spread -- this is the one place that keeps a
        // disable, and it buys the removal of the one at every call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, enabled, nonce]);

    return { data, isLoading, error, reload };
}
