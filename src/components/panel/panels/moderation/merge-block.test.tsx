import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MergeForm } from "./merge-block";
import { resetStores } from "../../../../test/render";
import { mockFetchRoutes } from "../../../../test/fetch";
import { saveTokens } from "../../../../services/tokens";
import type { Mark } from "../../../../services/MarksService";
import { t } from "../../../../i18n";

/** An unsigned JWT whose `exp` is far enough away for `ensureAccessToken` to accept it. */
function fakeAccessToken(): string {
    const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, role: "moderator" })}.sig`;
}

function mark(id: number): Mark {
    return {
        mark_id: id,
        name: "",
        geom: { type: "Point", coordinates: [1, 2] },
        mark_type_id: 1,
        description: "",
        user_id: 1,
        mark_status_id: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    } as Mark;
}

describe("MergeForm", () => {
    beforeEach(() => {
        resetStores();
        saveTokens(fakeAccessToken(), "refresh");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("lists the similar marks without the one being merged and merges the chosen target", async () => {
        mockFetchRoutes({
            "GET /api/marks/similar": [
                { ...mark(7), distance_m: 12 },
                // the source itself comes back from the API and has to be filtered out
                { ...mark(1), distance_m: 0 },
            ],
            "POST /api/marks/1/merge-into/7": { mark: mark(7) },
        });
        const onDone = vi.fn();
        const user = userEvent.setup();

        render(<MergeForm mark={mark(1)} onCancel={() => {}} onDone={onDone} />);

        await waitFor(() => expect(screen.getByText(t("mark.n", { id: 7 }))).toBeInTheDocument());
        expect(screen.queryByText(t("mark.n", { id: 1 }))).not.toBeInTheDocument();

        await user.click(screen.getAllByRole("button", { name: t("moderation.mergeConfirm") })[0]);
        // The merge is guarded by the confirmation dialog now, not by window.confirm.
        await user.click(await screen.findByRole("button", { name: t("confirm.ok") }));

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
        expect(onDone.mock.calls[0][0]).toMatchObject({ mark_id: 7 });
    });

    it("does not merge a mark into itself", async () => {
        mockFetchRoutes({ "GET /api/marks/similar": [] });
        const onDone = vi.fn();
        const user = userEvent.setup();

        render(<MergeForm mark={mark(1)} onCancel={() => {}} onDone={onDone} />);

        await waitFor(() => expect(screen.getByText(t("moderation.similarEmpty"))).toBeInTheDocument());

        await user.type(screen.getByLabelText(t("moderation.mergeManual")), "1");
        await user.click(screen.getByRole("button", { name: t("moderation.mergeConfirm") }));

        // rejected before the confirmation dialog, so no request was ever made
        expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
        expect(onDone).not.toHaveBeenCalled();
    });
});
