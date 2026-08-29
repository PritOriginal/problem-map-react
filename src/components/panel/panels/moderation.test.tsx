import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import ModerationPanel from "./moderation";
import { renderPanel, resetStores } from "../../../test/render";
import { jsonResponse, envelope } from "../../../test/fetch";
import { saveTokens } from "../../../services/tokens";
import user from "../../../store/user";
import type { Report } from "../../../services/ReportsService";

/** An unsigned JWT whose `exp` is far enough away for `ensureAccessToken` to accept it. */
function fakeAccessToken(): string {
    const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, role: "moderator" })}.sig`;
}

function report(id: number): Report {
    return {
        report_id: id,
        target_type: "mark",
        target_id: id,
        reason: "spam",
        comment: "",
        reporter_id: 5,
        status: "open",
        created_at: "2026-01-01T00:00:00Z",
    };
}

function mark(id: number) {
    return {
        mark_id: id,
        name: "",
        geom: { type: "Point", coordinates: [1, 2] },
        mark_type_id: 1,
        description: `mark-desc-${id}`,
        user_id: 1,
        mark_status_id: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
}

interface Counters {
    queueCalls: number;
    markCalls: number;
    maxInFlight: number;
}

/**
 * Stubs `fetch` for the queue and for `GET /api/marks/{id}`, counting how many mark
 * requests are in flight at the same time. `failIds` answer with a 500.
 */
function stubQueue(reports: Report[], failIds: number[] = []): Counters {
    const counters: Counters = { queueCalls: 0, markCalls: 0, maxInFlight: 0 };
    let inFlight = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
        if (url.pathname === "/api/moderation/queue") {
            counters.queueCalls++;
            return jsonResponse(envelope({ reports }));
        }
        const markMatch = /^\/api\/marks\/(\d+)$/.exec(url.pathname);
        if (markMatch) {
            counters.markCalls++;
            inFlight++;
            counters.maxInFlight = Math.max(counters.maxInFlight, inFlight);
            // a real tick, so requests that overlap are actually seen to overlap
            await new Promise((resolve) => setTimeout(resolve, 1));
            inFlight--;
            const id = Number(markMatch[1]);
            if (failIds.includes(id)) {
                return jsonResponse({ success: false, error: { message: "boom" } }, { status: 500 });
            }
            return jsonResponse(envelope({ mark: mark(id) }));
        }
        throw new Error(`No mock for ${url.pathname}`);
    }));
    return counters;
}

describe("ModerationPanel", () => {
    beforeEach(() => {
        resetStores();
        saveTokens(fakeAccessToken(), "refresh");
        user.setUser("mod", 1, "moderator");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("loads the queue once and the marks behind it with a bounded concurrency", async () => {
        const reports = Array.from({ length: 20 }, (_, i) => report(i + 1));
        const counters = stubQueue(reports);

        renderPanel(<ModerationPanel />);

        await waitFor(() => expect(screen.getByText("mark-desc-20")).toBeInTheDocument());

        expect(counters.queueCalls).toBe(1);
        expect(counters.markCalls).toBe(20);
        // one request per card would have put all 20 in flight at once
        expect(counters.maxInFlight).toBeLessThanOrEqual(6);
    });

    it("keeps the other cards when one mark fails to load", async () => {
        const reports = Array.from({ length: 5 }, (_, i) => report(i + 1));
        stubQueue(reports, [3]);

        renderPanel(<ModerationPanel />);

        await waitFor(() => expect(screen.getByText("mark-desc-5")).toBeInTheDocument());

        expect(screen.getByText("mark-desc-1")).toBeInTheDocument();
        expect(screen.queryByText("mark-desc-3")).not.toBeInTheDocument();
        // the card itself is still there, just without its mark block
        expect(document.querySelectorAll(".task-card")).toHaveLength(5);
    });

    it("does not request marks the queue already expanded", async () => {
        const expanded = { ...report(1), target: mark(1) } as Report;
        const counters = stubQueue([expanded, report(2)]);

        renderPanel(<ModerationPanel />);

        await waitFor(() => expect(screen.getByText("mark-desc-2")).toBeInTheDocument());

        expect(screen.getByText("mark-desc-1")).toBeInTheDocument();
        expect(counters.markCalls).toBe(1);
    });
});
