import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOBILE_BREAKPOINT, useDeviceDetect, useIsMobile } from "./hooks";
import { resetMatchMedia, setMatchMedia } from "../test/setup";

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

/**
 * Wraps `window.matchMedia` so the test can see how many `MediaQueryList`s the hook
 * creates and how many listeners it puts on them. The point of the hook is that N
 * consumers share exactly one of each.
 */
function spyOnMatchMedia() {
    const real = window.matchMedia.bind(window);
    const lists: MediaQueryList[] = [];
    let added = 0;
    let removed = 0;
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
        const list = real(query);
        lists.push(list);
        const add = list.addEventListener.bind(list);
        const remove = list.removeEventListener.bind(list);
        list.addEventListener = ((...args: Parameters<typeof add>) => {
            added++;
            return add(...args);
        }) as typeof list.addEventListener;
        list.removeEventListener = ((...args: Parameters<typeof remove>) => {
            removed++;
            return remove(...args);
        }) as typeof list.removeEventListener;
        return list;
    });
    return {
        lists,
        get added() { return added; },
        get removed() { return removed; },
    };
}

/** Makes the mobile breakpoint query match (or not) and lets the listeners run. */
function setMobile(mobile: boolean) {
    act(() => {
        if (mobile) {
            setMatchMedia((query) => query === MOBILE_QUERY);
        } else {
            resetMatchMedia();
        }
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("useIsMobile", () => {
    it("reports the state of the mobile media query", () => {
        setMobile(true);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });

    it("shares one media query and one listener between every consumer", () => {
        const spy = spyOnMatchMedia();
        const a = renderHook(() => useIsMobile());
        const b = renderHook(() => useIsMobile());
        const c = renderHook(() => useIsMobile());

        expect(spy.lists).toHaveLength(1);
        expect(spy.added).toBe(1);

        a.unmount();
        b.unmount();
        c.unmount();
    });

    it("updates every consumer when the breakpoint is crossed", () => {
        setMobile(false);
        const a = renderHook(() => useIsMobile());
        const b = renderHook(() => useIsMobile());
        expect(a.result.current).toBe(false);
        expect(b.result.current).toBe(false);

        setMobile(true);
        expect(a.result.current).toBe(true);
        expect(b.result.current).toBe(true);

        setMobile(false);
        expect(a.result.current).toBe(false);
        expect(b.result.current).toBe(false);

        a.unmount();
        b.unmount();
    });

    it("drops the listener only when the last consumer unmounts", () => {
        const spy = spyOnMatchMedia();
        const a = renderHook(() => useIsMobile());
        const b = renderHook(() => useIsMobile());

        a.unmount();
        expect(spy.removed).toBe(0);

        b.unmount();
        expect(spy.removed).toBe(1);
    });
});

describe("useDeviceDetect", () => {
    it("keeps returning { isMobile }", () => {
        setMobile(true);
        const { result } = renderHook(() => useDeviceDetect());
        expect(result.current).toEqual({ isMobile: true });
    });
});
