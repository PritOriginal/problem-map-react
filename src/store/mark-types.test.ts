import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarksService, { GetMarkTypesResponse, MarkType } from "../services/MarksService";
import markTypesStore from "./mark-types";
import notificationsStore from "./notifications";

function types(...names: string[]): MarkType[] {
    return names.map((name, i) => ({ mark_type_id: i + 1, name }));
}

function response(payload: MarkType[]): GetMarkTypesResponse {
    return { success: true, payload };
}

/** Reaches into the store the way a fresh module would: no data, nothing remembered. */
function reset(): void {
    markTypesStore.types = [];
    markTypesStore.error = null;
    markTypesStore.isLoading = false;
    (markTypesStore as unknown as { loaded: boolean }).loaded = false;
    (markTypesStore as unknown as { inFlight: Promise<void> | null }).inFlight = null;
}

describe("markTypesStore.fetch", () => {
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
        let resolve!: (value: GetMarkTypesResponse) => void;
        const getMarkTypes = vi.spyOn(MarksService, "getMarkTypes")
            .mockImplementation(() => new Promise<GetMarkTypesResponse>((res) => { resolve = res; }));

        const first = markTypesStore.fetch();
        const second = markTypesStore.fetch();
        resolve(response(types("Мусор")));
        await Promise.all([first, second]);

        expect(getMarkTypes).toHaveBeenCalledTimes(1);
        expect(markTypesStore.types.map((x) => x.name)).toEqual(["Мусор"]);
        expect(markTypesStore.isLoading).toBe(false);
    });

    it("does not request again once loaded", async () => {
        const getMarkTypes = vi.spyOn(MarksService, "getMarkTypes").mockResolvedValue(response(types("Мусор")));

        await markTypesStore.fetch();
        await markTypesStore.fetch();

        expect(getMarkTypes).toHaveBeenCalledTimes(1);
    });

    it("force re-fetches and overwrites the dictionary (language change)", async () => {
        const getMarkTypes = vi.spyOn(MarksService, "getMarkTypes")
            .mockResolvedValueOnce(response(types("Мусор")))
            .mockResolvedValueOnce(response(types("Trash")));

        await markTypesStore.fetch();
        await markTypesStore.fetch(true);

        expect(getMarkTypes).toHaveBeenCalledTimes(2);
        expect(markTypesStore.types.map((x) => x.name)).toEqual(["Trash"]);
    });

    it("does not latch on a failure: the next call tries again", async () => {
        const getMarkTypes = vi.spyOn(MarksService, "getMarkTypes")
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(response(types("Мусор")));

        await markTypesStore.fetch();
        expect(markTypesStore.error).toBe("network down");
        expect(markTypesStore.isLoading).toBe(false);

        await markTypesStore.fetch();

        expect(getMarkTypes).toHaveBeenCalledTimes(2);
        expect(markTypesStore.types.map((x) => x.name)).toEqual(["Мусор"]);
        expect(markTypesStore.error).toBeNull();
    });
});
