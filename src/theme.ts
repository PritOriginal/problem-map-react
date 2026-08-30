import { useCallback, useSyncExternalStore } from "react";

/**
 * The colour theme. Three states, not two: "auto" follows the operating system,
 * which is the right default for a field app whose users move between daylight
 * and night. An explicit choice overrides it and is remembered.
 *
 * Deliberately a plain external store, not MobX -- it mirrors LangStore in
 * src/i18n/index.ts so both work the same way and can be read outside React
 * (the map style is chosen from JS, and `var()` means nothing to WebGL).
 */
export type Theme = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEMES: readonly Theme[] = ["auto", "light", "dark"];
export const DEFAULT_THEME: Theme = "auto";
export const THEME_STORAGE_KEY = "theme";

/** The browser-tab colour, matching --chrome in each theme. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#1b1d1c", dark: "#101214" };

export function parseTheme(value: unknown): Theme | null {
    return typeof value === "string" && (THEMES as readonly string[]).includes(value) ? (value as Theme) : null;
}

function readStoredTheme(): Theme {
    try {
        return parseTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia(DARK_QUERY).matches;
}

/** What "auto" actually resolves to right now. */
export function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === "auto") {
        return systemPrefersDark() ? "dark" : "light";
    }
    return theme;
}

type Listener = () => void;

/** The one media query the theme cares about; one MediaQueryList is made per store. */
function darkMediaQuery(): MediaQueryList | null {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return null;
    }
    return window.matchMedia(DARK_QUERY);
}

export class ThemeStore {
    private theme: Theme = readStoredTheme();
    private listeners = new Set<Listener>();

    /**
     * One MediaQueryList for the life of the store. `getResolved` is the `getSnapshot`
     * of a `useSyncExternalStore` read by every marker, heatmap cell and boundary on the
     * map, and React calls getSnapshot at least twice per commit -- creating a fresh
     * MediaQueryList in there cost hundreds of `matchMedia` calls per render pass.
     */
    private readonly mediaQuery: MediaQueryList | null = darkMediaQuery();

    /** The already-resolved theme. Recomputed only when an input actually changes. */
    private resolved: ResolvedTheme;

    /** While on "auto", follow the system as it changes -- no reload needed. */
    private readonly onSystemChange = () => {
        if (this.theme !== "auto") {
            return;
        }
        const next = this.computeResolved();
        if (next === this.resolved) {
            return;
        }
        this.resolved = next;
        this.applyToDocument();
        this.listeners.forEach((listener) => listener());
    };

    constructor() {
        this.resolved = this.computeResolved();
        this.applyToDocument();
        this.mediaQuery?.addEventListener("change", this.onSystemChange);
    }

    get = (): Theme => this.theme;

    /** A plain field read: no matchMedia, and referentially stable between changes. */
    getResolved = (): ResolvedTheme => this.resolved;

    set = (theme: Theme) => {
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        this.resolved = this.computeResolved();
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // storage may be unavailable (private mode); the choice lives for the session only
        }
        this.applyToDocument();
        this.listeners.forEach((listener) => listener());
    };

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * Drops the system-theme subscription and every listener. The app singleton lives
     * as long as the document and never needs this; tests that build their own store do.
     */
    dispose = () => {
        this.mediaQuery?.removeEventListener("change", this.onSystemChange);
        this.listeners.clear();
    };

    private computeResolved(): ResolvedTheme {
        if (this.theme === "auto") {
            return this.mediaQuery?.matches ? "dark" : "light";
        }
        return this.theme;
    }

    /**
     * "auto" leaves the attribute off entirely, so the stylesheet's
     * prefers-color-scheme block is what decides. An explicit choice stamps
     * data-theme, which the stylesheet lets win in both directions.
     */
    private applyToDocument() {
        if (typeof document === "undefined") {
            return;
        }
        const root = document.documentElement;
        if (this.theme === "auto") {
            root.removeAttribute("data-theme");
        } else {
            root.setAttribute("data-theme", this.theme);
        }
        const resolved = this.resolved;
        root.style.colorScheme = resolved;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
    }
}

const themeStore = new ThemeStore();

export const getTheme = (): Theme => themeStore.get();
export const setTheme = (theme: Theme) => themeStore.set(theme);

/**
 * The resolved theme, and a subscription to it, for code outside React that has to
 * follow it. Nothing in the app needs the subscription today -- `useTheme` covers the
 * components -- but the map's colour is chosen from plain JS, so the pair is kept.
 */
export const getResolvedTheme = (): ResolvedTheme => themeStore.getResolved();
export const subscribeTheme = (listener: () => void): (() => void) => themeStore.subscribe(listener);

/** Current theme choice plus what it resolves to, re-rendering on change. */
export function useTheme(): { theme: Theme; resolved: ResolvedTheme } {
    const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => DEFAULT_THEME);
    const resolved = useSyncExternalStore(themeStore.subscribe, themeStore.getResolved, () => "light" as ResolvedTheme);
    return { theme, resolved };
}

/** Stable setter for the switcher. */
export function useSetTheme(): (theme: Theme) => void {
    return useCallback((theme: Theme) => themeStore.set(theme), []);
}
