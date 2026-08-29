/**
 * True when a rejection is the abort of `signal` rather than a real failure.
 *
 * `AbortController.abort()` rejects the in-flight `fetch` with a `DOMException`
 * named `AbortError`, but code running after the abort (a `.then` that touches a
 * response body, for instance) can fail with something else entirely; the signal
 * itself is therefore the primary evidence, the exception name only a fallback for
 * an abort that came from elsewhere.
 */
export function isAbortError(error: unknown, signal: AbortSignal): boolean {
    return signal.aborted || (error instanceof DOMException && error.name === "AbortError");
}
