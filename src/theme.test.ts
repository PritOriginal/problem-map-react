import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeStore, resolveTheme } from "./theme";
import { setMatchMedia } from "./test/setup";

/** The predicate `setMatchMedia` needs to make the system look dark. */
const DARK = (query: string) => query.includes("prefers-color-scheme: dark");

let store: ThemeStore | null = null;

/** Every test builds its own store: the module singleton is shared by the whole run. */
function makeStore(): ThemeStore {
    store = new ThemeStore();
    return store;
}

afterEach(() => {
    store?.dispose();
    store = null;
});

describe("ThemeStore", () => {
    it("resolves auto against the system at construction time", () => {
        setMatchMedia(DARK);
        expect(makeStore().getResolved()).toBe("dark");
    });

    it("follows the system theme while on auto and notifies subscribers", () => {
        const theme = makeStore();
        const listener = vi.fn();
        theme.subscribe(listener);

        expect(theme.getResolved()).toBe("light");

        setMatchMedia(DARK);

        expect(theme.getResolved()).toBe("dark");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("lets an explicit choice override the system theme", () => {
        setMatchMedia(DARK);
        const theme = makeStore();
        expect(theme.getResolved()).toBe("dark");

        theme.set("light");

        expect(theme.get()).toBe("light");
        expect(theme.getResolved()).toBe("light");

        // The system going back to light must not disturb the explicit choice.
        const listener = vi.fn();
        theme.subscribe(listener);
        setMatchMedia(() => false);

        expect(theme.getResolved()).toBe("light");
        expect(listener).not.toHaveBeenCalled();

        // ...and going back to auto picks the system up again.
        theme.set("auto");
        expect(theme.getResolved()).toBe("light");
        setMatchMedia(DARK);
        expect(theme.getResolved()).toBe("dark");
    });

    it("calls matchMedia once per store, however often getResolved is read", () => {
        const spy = vi.spyOn(window, "matchMedia");
        const theme = makeStore();

        // getSnapshot is called at least twice per commit, for every marker on the map.
        const reads = Array.from({ length: 1000 }, () => theme.getResolved());

        // One list, built in the constructor.
        expect(spy).toHaveBeenCalledTimes(1);

        // What the same reads used to cost: getResolved was `resolveTheme(this.theme)`,
        // and `resolveTheme` still builds a MediaQueryList on every call.
        spy.mockClear();
        for (let i = 0; i < reads.length; i++) {
            resolveTheme("auto");
        }
        expect(spy).toHaveBeenCalledTimes(1000);

        // A stable primitive: useSyncExternalStore would loop otherwise.
        expect(new Set(reads).size).toBe(1);
        expect(reads[0]).toBe("light");
    });

    it("does not call matchMedia when the theme is set explicitly", () => {
        const theme = makeStore();
        const spy = vi.spyOn(window, "matchMedia");

        theme.set("dark");
        theme.getResolved();

        expect(spy).not.toHaveBeenCalled();
    });

    it("stops following the system after dispose()", () => {
        const theme = makeStore();
        const listener = vi.fn();
        theme.subscribe(listener);

        theme.dispose();
        setMatchMedia(DARK);

        expect(theme.getResolved()).toBe("light");
        expect(listener).not.toHaveBeenCalled();
    });
});
