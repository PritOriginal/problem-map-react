import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Leaderboard from "./leaderboard";
import { renderPanel, resetStores } from "../../../test/render";
import { envelope, jsonResponse } from "../../../test/fetch";
import { ru } from "../../../i18n/ru";

interface Call {
    period: string | null;
    boundary: string | null;
}

/**
 * Answers the leaderboard and the boundary warm-up, recording the query of every
 * leaderboard request -- which is how "the filter actually asked the backend again"
 * is told apart from "the component merely re-rendered".
 */
function stubBackend(entries: unknown[]): Call[] {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
        if (url.pathname === "/api/leaderboard") {
            calls.push({ period: url.searchParams.get("period"), boundary: url.searchParams.get("boundary_id") });
            return jsonResponse(envelope({ leaderboard: entries }));
        }
        if (url.pathname === "/api/map/admin-boundaries") {
            return jsonResponse(envelope({ admin_boundaries: [{ id: 4, name: "Центральный", admin_level: 9 }] }));
        }
        throw new Error(`No mock for ${url.pathname}`);
    }));
    return calls;
}

describe("Leaderboard", () => {
    beforeEach(() => {
        resetStores();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lists the entries the backend returned", async () => {
        stubBackend([
            { user_id: 1, username: "anna", rating: 30 },
            { user_id: 2, username: "boris", rating: 20 },
        ]);

        renderPanel(<Leaderboard />);

        expect(await screen.findByText("anna")).toBeInTheDocument();
        expect(screen.getByText("boris")).toBeInTheDocument();
        expect(screen.queryByText(ru["leaderboard.empty"])).not.toBeInTheDocument();
    });

    it("says the board is empty rather than showing a blank list", async () => {
        stubBackend([]);

        renderPanel(<Leaderboard />);

        expect(await screen.findByText(ru["leaderboard.empty"])).toBeInTheDocument();
    });

    it("asks the backend again when the period changes", async () => {
        const calls = stubBackend([{ user_id: 1, username: "anna", rating: 30 }]);

        renderPanel(<Leaderboard />);
        await screen.findByText("anna");
        expect(calls).toHaveLength(1);
        // "all" is the default and is left out of the query
        expect(calls[0].period).toBeNull();

        await userEvent.selectOptions(screen.getByLabelText(ru["leaderboard.period"]), "week");

        await waitFor(() => expect(calls).toHaveLength(2));
        expect(calls[1].period).toBe("week");
    });

    it("filters by district through the shared boundary select", async () => {
        const calls = stubBackend([{ user_id: 1, username: "anna", rating: 30 }]);

        renderPanel(<Leaderboard />);
        const districts = screen.getByLabelText(ru["leaderboard.district"]);
        await waitFor(() => expect(districts).toHaveTextContent("Центральный"));

        await userEvent.selectOptions(districts, "4");

        await waitFor(() => expect(calls[calls.length - 1].boundary).toBe("4"));
    });
});
