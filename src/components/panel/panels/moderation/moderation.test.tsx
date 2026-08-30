import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import ModerationPanel from "./moderation";
import { renderPanel, resetStores } from "../../../../test/render";
import { jsonResponse, envelope } from "../../../../test/fetch";
import { saveTokens } from "../../../../services/tokens";
import user from "../../../../store/user";
import type { Report } from "../../../../services/ReportsService";

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
    /** One entry per `GET /api/marks?ids=`, holding the ids that request asked for. */
    markBatches: number[][];
}

/**
 * Stubs `fetch` for the queue and for the batch read `GET /api/marks?ids=`, recording the
 * batches it was asked for. Ids in `failIds` are answered with a 500 for their whole batch,
 * the way a real failed request would be.
 */
function stubQueue(reports: Report[], failIds: number[] = []): Counters {
    const counters: Counters = { queueCalls: 0, markBatches: [] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
        if (url.pathname === "/api/moderation/queue") {
            counters.queueCalls++;
            return jsonResponse(envelope({ reports }));
        }
        const ids = url.searchParams.get("ids");
        if (url.pathname === "/api/marks" && ids !== null) {
            const batch = ids.split(",").map(Number);
            counters.markBatches.push(batch);
            await new Promise((resolve) => setTimeout(resolve, 1));
            if (batch.some((id) => failIds.includes(id))) {
                return jsonResponse({ success: false, error: { message: "boom" } }, { status: 500 });
            }
            return jsonResponse(envelope({ marks: batch.map(mark) }));
        }
        throw new Error(`No mock for ${url.pathname}${url.search}`);
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

    // This used to be one `GET /marks/{id}` per card, throttled to six in flight; the batch
    // endpoint reads the whole queue in a single request instead.
    it("loads the queue once and every mark behind it in one batch request", async () => {
        const reports = Array.from({ length: 20 }, (_, i) => report(i + 1));
        const counters = stubQueue(reports);

        renderPanel(<ModerationPanel />);

        await waitFor(() => expect(screen.getByText("mark-desc-20")).toBeInTheDocument(), { timeout: 5000 });

        expect(counters.queueCalls).toBe(1);
        expect(counters.markBatches).toHaveLength(1);
        expect(counters.markBatches[0]).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    // (a queue longer than the backend's 100-id limit is split into batches by the service;
    // QUEUE_LIMIT keeps this panel under it, and the split itself is covered in contracts.test.ts)

    it("keeps the other cards when the marks fail to load", async () => {
        const reports = Array.from({ length: 5 }, (_, i) => report(i + 1));
        stubQueue(reports, [3]);

        renderPanel(<ModerationPanel />);

        // the batch that fails takes its marks with it -- the cards stay, without mark blocks
        await waitFor(() => expect(document.querySelectorAll(".task-card")).toHaveLength(5));
        expect(screen.queryByText("mark-desc-3")).not.toBeInTheDocument();
    });

    it("does not request marks the queue already expanded", async () => {
        const expanded = { ...report(1), target: mark(1) } as Report;
        const counters = stubQueue([expanded, report(2)]);

        renderPanel(<ModerationPanel />);

        await waitFor(() => expect(screen.getByText("mark-desc-2")).toBeInTheDocument());

        expect(screen.getByText("mark-desc-1")).toBeInTheDocument();
        expect(counters.markBatches).toEqual([[2]]);
    });
});
