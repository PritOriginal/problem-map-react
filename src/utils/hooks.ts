import { useEffect, useState, useSyncExternalStore } from "react";

/** The single mobile breakpoint. Kept in sync with `$bp-mobile` in `src/mixins.scss`,
 * which cannot be shared with JS because `@media` cannot read CSS custom properties. */
export const MOBILE_BREAKPOINT = 768;

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

/**
 * One shared media query for every `useIsMobile` subscriber (the map, the header and
 * the panel → one listener instead of three).
 *
 * A `resize` listener fires on every pixel and would have to be throttled; a media
 * query fires only when the breakpoint is actually crossed, which is the only moment
 * the answer can change. Dragging a window across 200px inside one side of the
 * breakpoint now costs nothing at all, where before it rerendered the map ~200 times.
 *
 * The `MediaQueryList` is created on the first subscription and released with the last
 * one, so a page with no consumer holds no listener.
 */
const mobileQuery = (() => {
    const listeners = new Set<() => void>();
    let list: MediaQueryList | null = null;
    let isMobile = typeof window === "undefined" ? false : window.matchMedia(MOBILE_QUERY).matches;

    const onChange = (event: MediaQueryListEvent) => {
        isMobile = event.matches;
        listeners.forEach((listener) => listener());
    };

    return {
        get: () => isMobile,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            if (list === null) {
                list = window.matchMedia(MOBILE_QUERY);
                // the breakpoint may have been crossed while nobody was listening
                isMobile = list.matches;
                list.addEventListener("change", onChange);
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0 && list !== null) {
                    list.removeEventListener("change", onChange);
                    list = null;
                }
            };
        },
    };
})();

/** `true` below the mobile breakpoint, from a single shared media query. */
export const useIsMobile = (): boolean => useSyncExternalStore(mobileQuery.subscribe, mobileQuery.get, mobileQuery.get);

/** Back-compatible shape of `useIsMobile` for the components that destructure `{ isMobile }`. */
export const useDeviceDetect = () => ({ isMobile: useIsMobile() });

const NOW_INTERVAL_MS = 30_000;

/** One shared ticker for every `useNow` subscriber (many badges → one interval). */
const nowTicker = (() => {
    const listeners = new Set<() => void>();
    let now = Date.now();
    let timer: number | undefined;
    return {
        get: () => now,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            if (timer === undefined) {
                timer = window.setInterval(() => {
                    now = Date.now();
                    listeners.forEach((l) => l());
                }, NOW_INTERVAL_MS);
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0 && timer !== undefined) {
                    window.clearInterval(timer);
                    timer = undefined;
                }
            };
        },
    };
})();

/** Current time, refreshed every 30 s by a single shared interval (for countdowns). */
export const useNow = (): number => useSyncExternalStore(nowTicker.subscribe, nowTicker.get, nowTicker.get);

/** `navigator.onLine`, kept in sync with the `online` / `offline` events. */
export const useOnline = (): boolean => {
    const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
            window.removeEventListener("online", up);
            window.removeEventListener("offline", down);
        };
    }, []);
    return online;
};
