import { vi } from "vitest";

/**
 * `fetch` stubs, formalising what src/services/contracts.test.ts already does by hand:
 * `vi.stubGlobal("fetch", ...)` returning a fresh `Response` per call (a body can only be
 * read once) whose JSON is the backend envelope `{ success, payload, meta }` that
 * src/services/http.ts `parseResponse` expects.
 *
 * The setup file's `vi.restoreAllMocks()` does not undo `stubGlobal`, so a suite using
 * these helpers should still `afterEach(() => vi.unstubAllGlobals())`, exactly as the
 * contract tests do.
 */

export interface ResponseInitLike {
    status?: number;
    headers?: Record<string, string>;
}

/** Wraps a payload in the success envelope unless it already looks like one. */
export function envelope(body: unknown, meta?: unknown): unknown {
    if (body !== null && typeof body === "object" && "success" in (body as Record<string, unknown>)) {
        return body;
    }
    return { success: true, payload: body, meta };
}

/** A JSON `Response` carrying `body` verbatim (no enveloping). */
export function jsonResponse(body: unknown, init: ResponseInitLike = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json", ...init.headers },
    });
}

/**
 * Stubs `fetch` so the next call resolves with `body` (enveloped when it is a bare
 * payload) and every call after it rejects — an unexpected second request is a test bug,
 * not a silent repeat of the first answer.
 */
export function mockFetchOnce(body: unknown, init?: ResponseInitLike): void {
    const fetchMock = vi.fn<() => Promise<Response>>()
        .mockImplementationOnce(async () => jsonResponse(envelope(body), init))
        .mockImplementation(async () => {
            throw new Error("fetch was called more than once, but only one response was mocked");
        });
    vi.stubGlobal("fetch", fetchMock);
}

/** A route answer: a literal payload, or a function of the request. */
export type RouteHandler = unknown | ((req: Request) => unknown);

/**
 * Stubs `fetch` with a routing table keyed by `"<METHOD> <pathname>"`, e.g.
 * `mockFetchRoutes({ "GET /api/marks": { marks: [] } })`. The query string is ignored
 * when matching, so one entry covers every filter combination.
 *
 * A handler may return a `Response` (used as is) or any value, which is enveloped.
 * An unmatched request rejects with a message naming the route, so a typo in a URL
 * surfaces as a clear failure rather than an empty payload.
 */
export function mockFetchRoutes(routes: Record<string, RouteHandler>): void {
    // normalised once so lookups tolerate extra spaces and a lower-case method
    const table = new Map<string, RouteHandler>(
        Object.entries(routes).map(([key, handler]) => [normalizeKey(key), handler]),
    );

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = toRequest(input, init);
        const key = `${request.method.toUpperCase()} ${pathOf(request.url)}`;
        if (!table.has(key)) {
            throw new Error(`No mock for ${key}. Mocked: ${[...table.keys()].join(", ") || "(none)"}`);
        }
        const handler = table.get(key);
        const result = typeof handler === "function" ? (handler as (req: Request) => unknown)(request) : handler;
        return result instanceof Response ? result : jsonResponse(envelope(result));
    }));
}

function normalizeKey(key: string): string {
    const [method, ...rest] = key.trim().split(/\s+/);
    return `${method.toUpperCase()} ${pathOf(rest.join(" "))}`;
}

/** Path only: services call relative `/api/...` URLs, and filters live in the query. */
function pathOf(url: string): string {
    return new URL(url, "http://localhost").pathname;
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
    if (input instanceof Request) {
        return init ? new Request(input, init) : input;
    }
    return new Request(new URL(String(input), "http://localhost"), init);
}
