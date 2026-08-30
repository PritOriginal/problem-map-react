import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarksService, { GetMarkStatusesResponse, MarkStatus } from "../services/MarksService";
import markStatusesStore from "./mark-statuses";
import notificationsStore from "./notifications";

function statuses(...names: string[]): MarkStatus[] {
    return names.map((name, i) => ({ mark_status_id: i + 1, name, parent_id: null }));
}

function response(payload: MarkStatus[]): GetMarkStatusesResponse {
    return { success: true, payload };
}

/** Reaches into the store the way a fresh module would: no data, nothing remembered. */
function reset(): void {
    markStatusesStore.statuses = [];
    markStatusesStore.error = null;
    markStatusesStore.isLoading = false;
    (markStatusesStore as unknown as { loaded: boolean }).loaded = false;
    (markStatusesStore as unknown as { inFlight: Promise<void> | null }).inFlight = null;
}

describe("markStatusesStore.fetch", () => {
    beforeEach(() => {
        reset();
        notificationsStore.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        reset();
        vi.restoreAllMocks();
    });

    it("collapses parallel callers into one request, resolving both with the data", async () => {
        let resolve!: (value: GetMarkStatusesResponse) => void;
        const getMarkStatuses = vi.spyOn(MarksService, "getMarkStatuses")
            .mockImplementation(() => new Promise<GetMarkStatusesResponse>((res) => { resolve = res; }));

        const first = markStatusesStore.fetch();
        const second = markStatusesStore.fetch();
        resolve(response(statuses("Не подтверждена")));
        await Promise.all([first, second]);

        expect(getMarkStatuses).toHaveBeenCalledTimes(1);
        expect(markStatusesStore.statuses.map((x) => x.name)).toEqual(["Не подтверждена"]);
        expect(markStatusesStore.isLoading).toBe(false);
    });

    it("does not request again once loaded", async () => {
        const getMarkStatuses = vi.spyOn(MarksService, "getMarkStatuses").mockResolvedValue(response(statuses("Не подтверждена")));

        await markStatusesStore.fetch();
        await markStatusesStore.fetch();

        expect(getMarkStatuses).toHaveBeenCalledTimes(1);
    });

    it("force re-fetches and overwrites the dictionary (language change)", async () => {
        const getMarkStatuses = vi.spyOn(MarksService, "getMarkStatuses")
            .mockResolvedValueOnce(response(statuses("Не подтверждена")))
            .mockResolvedValueOnce(response(statuses("Unconfirmed")));

        await markStatusesStore.fetch();
        await markStatusesStore.fetch(true);

        expect(getMarkStatuses).toHaveBeenCalledTimes(2);
        expect(markStatusesStore.statuses.map((x) => x.name)).toEqual(["Unconfirmed"]);
    });

    it("does not latch on a failure: the next call tries again", async () => {
        const getMarkStatuses = vi.spyOn(MarksService, "getMarkStatuses")
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(response(statuses("Не подтверждена")));

        await markStatusesStore.fetch();
        expect(markStatusesStore.error).toBe("network down");
        expect(markStatusesStore.isLoading).toBe(false);

        await markStatusesStore.fetch();

        expect(getMarkStatuses).toHaveBeenCalledTimes(2);
        expect(markStatusesStore.statuses.map((x) => x.name)).toEqual(["Не подтверждена"]);
        expect(markStatusesStore.error).toBeNull();
    });
});
