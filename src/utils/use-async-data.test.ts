import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useAsyncData } from "./use-async-data";
import notificationsStore from "../store/notifications";

/** A promise plus the handles to settle it from the test. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Rejects the way `fetch` does when its signal is aborted. */
function abortWhenSignalled(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
}

describe("useAsyncData", () => {
    beforeEach(() => {
        notificationsStore.clear();
        // the hook logs once, under import.meta.env.DEV, which vitest sets
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        notificationsStore.clear();
        vi.restoreAllMocks();
    });

    it("puts a resolved value in `data` and clears `isLoading`", async () => {
        const { result } = renderHook(() => useAsyncData(async () => "ok", []));

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.data).toBe("ok"));
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeUndefined();
    });

    it("puts a rejection in `error` and shows the banner", async () => {
        const boom = new Error("boom");
        const { result } = renderHook(() => useAsyncData<string>(
            () => Promise.reject(boom),
            [],
            { errorMessage: "не вышло" },
        ));

        await waitFor(() => expect(result.current.error).toBe(boom));
        expect(result.current.isLoading).toBe(false);
        // `getErrorMessage` prefers the error's own text; `errorMessage` is the fallback
        expect(notificationsStore.error).toBe("boom");

        notificationsStore.clear();
        const opaque = renderHook(() => useAsyncData<string>(
            () => Promise.reject(new Error("")),
            [],
            { errorMessage: "не вышло" },
        ));
        await waitFor(() => expect(opaque.result.current.error).toBeInstanceOf(Error));
        expect(notificationsStore.error).toBe("не вышло");
    });

    it("silent: the error is reported to the caller but not to the banner", async () => {
        const boom = new Error("boom");
        const { result } = renderHook(() => useAsyncData<string>(
            () => Promise.reject(boom),
            [],
            { errorMessage: "не вышло", silent: true },
        ));

        await waitFor(() => expect(result.current.error).toBe(boom));
        expect(notificationsStore.error).toBeNull();
    });

    it("unmounting mid-flight neither applies the answer nor warns", async () => {
        const gate = deferred<string>();
        const { result, unmount } = renderHook(() => useAsyncData(
            (signal) => Promise.race([gate.promise, abortWhenSignalled(signal)]),
            [],
        ));

        unmount();
        gate.resolve("late");
        await act(async () => { await Promise.resolve(); });

        expect(result.current.data).toBeUndefined();
        // an abort is not a failure: nothing is logged and no banner is raised
        expect(console.error).not.toHaveBeenCalled();
        expect(notificationsStore.error).toBeNull();
    });

    it("a deps change mid-flight discards the answer of the superseded request", async () => {
        const first = deferred<string>();
        const second = deferred<string>();
        const gates = [first, second];
        let calls = 0;

        const { result, rerender } = renderHook(({ id }: { id: number }) => useAsyncData(
            (signal) => Promise.race([gates[calls++].promise, abortWhenSignalled(signal)]),
            [id],
        ), { initialProps: { id: 1 } });

        await waitFor(() => expect(calls).toBe(1));
        rerender({ id: 2 });
        await waitFor(() => expect(calls).toBe(2));

        // the first request answers after it was superseded -- its value must not land
        await act(async () => {
            first.resolve("stale");
            await Promise.resolve();
        });
        expect(result.current.data).toBeUndefined();

        await act(async () => {
            second.resolve("fresh");
            await Promise.resolve();
        });
        await waitFor(() => expect(result.current.data).toBe("fresh"));
    });

    it("enabled: false runs nothing; flipping it to true runs the request", async () => {
        const fetcher = vi.fn(async () => "ok");
        const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useAsyncData(
            fetcher,
            [],
            { enabled },
        ), { initialProps: { enabled: false } });

        expect(fetcher).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();

        rerender({ enabled: true });
        await waitFor(() => expect(result.current.data).toBe("ok"));
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("reload() repeats the request and keeps its identity", async () => {
        let answer = "first";
        const fetcher = vi.fn(async () => answer);
        const { result } = renderHook(() => useAsyncData(fetcher, []));

        await waitFor(() => expect(result.current.data).toBe("first"));
        const reload = result.current.reload;

        answer = "second";
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.data).toBe("second"));
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(result.current.reload).toBe(reload);
    });

    it("a language change (new fetcher and errorMessage identity) does not refetch", async () => {
        const fetcher = vi.fn(async () => "ok");
        const { result, rerender } = renderHook(({ lang }: { lang: string }) => useAsyncData(
            // a fresh closure per render, exactly as a `t`-capturing call site produces
            () => fetcher(),
            [],
            { errorMessage: `failed-${lang}` },
        ), { initialProps: { lang: "ru" } });

        await waitFor(() => expect(result.current.data).toBe("ok"));
        expect(fetcher).toHaveBeenCalledTimes(1);

        rerender({ lang: "en" });
        await act(async () => { await Promise.resolve(); });
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
