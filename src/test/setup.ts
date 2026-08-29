import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom implements neither `matchMedia` nor `ResizeObserver`, and both are used at
 * module scope in production code: `src/theme.ts` builds its singleton on import and
 * calls `matchMedia("(prefers-color-scheme: dark)")` in the constructor, so a missing
 * stub crashes every test that transitively imports the theme. Both stubs are installed
 * here, before any test module is evaluated.
 */

type Matcher = (query: string) => boolean;

/** Nothing matches by default: light theme, motion allowed. */
const DEFAULT_MATCHER: Matcher = () => false;

let matcher: Matcher = DEFAULT_MATCHER;

/**
 * Points the `matchMedia` stub at a predicate, e.g.
 * `setMatchMedia((q) => q.includes("prefers-color-scheme: dark"))`.
 * Lists already created by `matchMedia` keep working: they consult the predicate on
 * every read of `matches`, so a change is visible to code holding an old MediaQueryList.
 */
export function setMatchMedia(match: Matcher): void {
    matcher = match;
    notifyMediaQueryLists();
}

/** Back to "nothing matches". Called after each test. */
export function resetMatchMedia(): void {
    matcher = DEFAULT_MATCHER;
    notifyMediaQueryLists();
}

const mediaQueryLists = new Set<StubMediaQueryList>();

/**
 * A MediaQueryList that reads `matches` lazily and supports both the modern
 * `addEventListener("change")` and the legacy `addListener` API — `src/theme.ts`
 * subscribes with the former.
 */
class StubMediaQueryList implements MediaQueryList {
    readonly media: string;
    onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

    private readonly listeners = new Set<EventListenerOrEventListenerObject>();
    private lastMatches: boolean;

    constructor(media: string) {
        this.media = media;
        this.lastMatches = matcher(media);
        mediaQueryLists.add(this);
    }

    get matches(): boolean {
        return matcher(this.media);
    }

    addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null): void => {
        if (type === "change" && listener) {
            this.listeners.add(listener);
        }
    }

    removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null): void => {
        if (type === "change" && listener) {
            this.listeners.delete(listener);
        }
    }

    addListener = (listener: ((ev: MediaQueryListEvent) => unknown) | null): void => {
        if (listener) {
            this.listeners.add(listener as EventListener);
        }
    }

    removeListener = (listener: ((ev: MediaQueryListEvent) => unknown) | null): void => {
        if (listener) {
            this.listeners.delete(listener as EventListener);
        }
    }

    dispatchEvent = (event: Event): boolean => {
        this.listeners.forEach((listener) => {
            if (typeof listener === "function") {
                listener.call(this, event);
            } else {
                listener.handleEvent(event);
            }
        });
        this.onchange?.call(this, event as MediaQueryListEvent);
        return true;
    }

    /** Fires "change" only when the predicate actually flipped this query's answer. */
    refresh(): void {
        const next = this.matches;
        if (next === this.lastMatches) {
            return;
        }
        this.lastMatches = next;
        const event = new Event("change") as MediaQueryListEvent;
        Object.defineProperty(event, "matches", { value: next });
        Object.defineProperty(event, "media", { value: this.media });
        this.dispatchEvent(event);
    }
}

function notifyMediaQueryLists(): void {
    mediaQueryLists.forEach((list) => list.refresh());
}

window.matchMedia = ((query: string) => new StubMediaQueryList(query)) as typeof window.matchMedia;

/** jsdom has no ResizeObserver; components that measure themselves only need it to exist. */
class StubResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = StubResizeObserver;
}

/**
 * jsdom implements the <dialog> element but none of its methods: `showModal`, `show` and
 * `close` are simply absent, so a component that opens one throws. The stubs below do the
 * part tests can observe -- the `open` attribute and the `close` event -- and nothing
 * else: the top layer, the focus trap and the Escape key are the browser's, and code that
 * needs Escape to work without them has to handle it itself.
 */
const dialogProto = window.HTMLDialogElement?.prototype as HTMLDialogElement | undefined;

if (dialogProto && typeof dialogProto.showModal !== "function") {
    const open = function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
    };
    dialogProto.show = open;
    dialogProto.showModal = open;
    dialogProto.close = function (this: HTMLDialogElement, returnValue?: string) {
        if (returnValue !== undefined) {
            this.returnValue = returnValue;
        }
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
    };
}

afterEach(() => {
    cleanup();
    resetMatchMedia();
    mediaQueryLists.clear();
    try {
        localStorage.clear();
    } catch {
        // storage may be unavailable in a test that stubbed it out
    }
    vi.restoreAllMocks();
});
