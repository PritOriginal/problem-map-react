import { afterEach, describe, expect, it, vi } from "vitest";
import { useParams } from "react-router-dom";
import { renderPanel, resetStores } from "./render";
import { mockFetchOnce, mockFetchRoutes } from "./fetch";
import { setMatchMedia } from "./setup";
import { resolveTheme } from "../theme";
import marksStore from "../store/marks";
import user from "../store/user";
import panelStore from "../store/panel";
import MarksService from "../services/MarksService";

afterEach(() => vi.unstubAllGlobals());

function Params() {
    const { id } = useParams();
    return <span>mark {id}</span>;
}

describe("test helpers", () => {
    it("renderPanel mounts the element under the given route pattern", () => {
        const { getByText } = renderPanel(<Params />, { route: "/marks/7", path: "/marks/:id" });
        expect(getByText("mark 7")).toBeInTheDocument();
    });

    it("resetStores puts singletons back, including ones without a public reset", () => {
        user.setUser("u", 5, "admin");
        panelStore.setOpen(true);
        marksStore.marks = [{ mark_id: 1 } as never];
        marksStore.filters.mark_type_ids = [3];

        resetStores();

        expect(user.id).toBe(0);
        expect(panelStore.isOpen).toBe(false);
        expect(marksStore.marks).toEqual([]);
        expect(marksStore.filters.mark_type_ids).toEqual([]);
    });

    it("mockFetchOnce answers once with the backend envelope", async () => {
        mockFetchOnce({ marks: [{ mark_id: 1 }] });
        const res = await MarksService.getMarks({ mark_type_ids: [], mark_status_ids: [] });
        expect(res.payload).toEqual({ marks: [{ mark_id: 1 }] });
        await expect(MarksService.getMarks({ mark_type_ids: [], mark_status_ids: [] })).rejects.toThrow(/more than once/);
    });

    it("mockFetchRoutes matches on method and path, ignoring the query", async () => {
        mockFetchRoutes({ "GET /api/marks": (req: Request) => ({ marks: [{ url: req.url }] }) });
        const res = await MarksService.getMarks({ mark_type_ids: [1], mark_status_ids: [] });
        expect(res.payload).toEqual({ marks: [{ url: "http://localhost/api/marks?mark_type_ids=1" }] });
        await expect(MarksService.getMarkById(1)).rejects.toThrow(/No mock for GET \/api\/marks\/1/);
    });

    it("setMatchMedia drives the theme's prefers-color-scheme query", () => {
        expect(resolveTheme("auto")).toBe("light");
        setMatchMedia((query) => query.includes("prefers-color-scheme: dark"));
        expect(resolveTheme("auto")).toBe("dark");
        expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
    });
});
