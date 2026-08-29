import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { runInAction } from "mobx";

import Filters from "./filters";
import { renderPanel, resetStores } from "../../test/render";
import { setMatchMedia } from "../../test/setup";
import { mockFetchRoutes } from "../../test/fetch";
import { FILTERS_CLOSE_MS, FILTERS_OPEN_MS } from "../map-constants";
import { t } from "../../i18n";
import marksStore, { DEFAULT_FILTERS } from "../../store/marks";
import markStatusesStore from "../../store/mark-statuses";
import markTypesStore from "../../store/mark-types";
import { MarkStatusType } from "../../services/MarksService";

const panel = () => document.querySelector(".filters");
const roundButton = () => document.querySelector(".filters-button");

/** Opens the panel and lets the morph finish. */
function open(): void {
    fireEvent.click(roundButton()!);
    act(() => {
        vi.advanceTimersByTime(FILTERS_OPEN_MS);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    // The panel fetches nothing itself, but toggling a filter asks the marks store to
    // reload and toggling a category also asks for the boundary counts. Neither store is
    // the subject here, so both requests are answered with nothing.
    mockFetchRoutes({
        "GET /api/marks": { marks: [] },
        "GET /api/admin_boundaries/marks_count": { admin_boundaries: [] },
    });
    runInAction(() => {
        markStatusesStore.statuses = [
            { mark_status_id: MarkStatusType.ConfirmedStatus, name: "Подтверждена", parent_id: null },
            { mark_status_id: MarkStatusType.ClosedStatus, name: "Закрыта", parent_id: null },
        ];
        markTypesStore.types = [
            { mark_type_id: 1, name: "Дороги" },
        ];
    });
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("Filters", () => {
    it("starts as the round button, with no panel", () => {
        renderPanel(<Filters />);

        expect(roundButton()).toBeInTheDocument();
        expect(panel()).toBeNull();
    });

    it("opens from a real button, named for screen readers", () => {
        renderPanel(<Filters />);

        // A <button>, not a div dressed as one: the keyboard behaviour and the name are
        // then the platform's rather than ours to reimplement.
        const button = screen.getByRole("button", { name: t("map.filtersTitle") });
        expect(button.tagName).toBe("BUTTON");
        expect(button).toHaveAttribute("type", "button");
        expect(button).toBe(roundButton());
    });

    it("morphs the button into the panel and back", () => {
        renderPanel(<Filters />);

        fireEvent.click(roundButton()!);
        // Mid-morph both are on screen: the panel is clipped back to the button's own
        // circle, and the two crossfade inside it.
        expect(panel()).toHaveClass("filters--open");
        expect(roundButton()).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(FILTERS_OPEN_MS);
        });
        expect(panel()).not.toHaveClass("filters--open");
        expect(roundButton()).toBeNull();

        fireEvent.click(document.querySelector(".filters__toggle")!);
        expect(panel()).toHaveClass("filters--close");
        act(() => {
            vi.advanceTimersByTime(FILTERS_CLOSE_MS);
        });
        expect(panel()).toBeNull();
        expect(roundButton()).toBeInTheDocument();
    });

    it("skips both phases under prefers-reduced-motion", () => {
        setMatchMedia((query) => query.includes("prefers-reduced-motion"));
        renderPanel(<Filters />);

        fireEvent.click(roundButton()!);
        // No animation to wait out, so the panel is already there in its resting state
        // and the button it grew from is gone -- without the timers having run.
        expect(panel()).toBeInTheDocument();
        expect(panel()).not.toHaveClass("filters--open");
        expect(roundButton()).toBeNull();

        fireEvent.click(document.querySelector(".filters__toggle")!);
        expect(panel()).toBeNull();
        expect(roundButton()).toBeInTheDocument();
    });

    it("toggles a status through the store when its chip is clicked", () => {
        // `marksStore.updateMarkStatus` is a MobX action, i.e. a bound property the store
        // defines itself, so it cannot be spied on; what it does to the filters is the
        // observable effect anyway.
        renderPanel(<Filters />);
        open();

        expect(marksStore.filters.mark_status_ids).toContain(MarkStatusType.ClosedStatus);
        fireEvent.click(screen.getByText("Закрыта"));
        expect(marksStore.filters.mark_status_ids).not.toContain(MarkStatusType.ClosedStatus);

        fireEvent.click(screen.getByText("Закрыта"));
        expect(marksStore.filters.mark_status_ids).toContain(MarkStatusType.ClosedStatus);
    });

    it("shows a chip as pressed exactly while its status is in the filters", () => {
        renderPanel(<Filters />);
        open();

        // every status is selected by default
        const chip = screen.getByText("Закрыта").closest("button")!;
        expect(chip).toHaveAttribute("aria-pressed", "true");

        act(() => {
            marksStore.updateMarkStatus(MarkStatusType.ClosedStatus);
        });
        expect(chip).toHaveAttribute("aria-pressed", "false");
    });

    it("offers the reset only once the filters are not the default ones", () => {
        renderPanel(<Filters />);
        open();

        expect(screen.queryByText(t("map.filtersReset"))).toBeNull();

        act(() => {
            marksStore.updateMarkType(1);
        });
        const reset = screen.getByText(t("map.filtersReset"));

        fireEvent.click(reset);
        expect(marksStore.filters.mark_type_ids).toEqual(DEFAULT_FILTERS.mark_type_ids);
        expect(screen.queryByText(t("map.filtersReset"))).toBeNull();
    });

    it("counts the selection, and spells a count of zero as \"all\"", () => {
        renderPanel(<Filters />);
        open();

        // no category chosen means no restriction on categories, not "no categories"
        expect(screen.getByText(t("map.categories")).textContent).toContain(t("map.filtersAll"));

        act(() => {
            marksStore.setFilters({ mark_type_ids: [], mark_status_ids: [MarkStatusType.ClosedStatus] });
        });
        expect(screen.getByText(t("map.statuses")).textContent)
            .toContain(t("map.filtersCount", { n: 1, total: 2 }));
    });
});
