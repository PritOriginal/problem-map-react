import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AsyncState } from "./async-state";
import { ru } from "../../i18n/ru";

/**
 * The component exists to hold one difference the twelve hand-written copies did
 * not agree on, so that difference is what is pinned down here: whether a reload
 * blanks the list already on screen.
 */
describe("AsyncState", () => {
    it("shows the loading line while the first request is in flight", () => {
        render(
            <AsyncState isLoading isEmpty empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText(ru["common.loading"])).toBeInTheDocument();
        expect(screen.queryByText("nothing here")).not.toBeInTheDocument();
        expect(screen.queryByText("rows")).not.toBeInTheDocument();
    });

    it("shows the empty line once a request came back with nothing", () => {
        render(
            <AsyncState isLoading={false} isEmpty empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText("nothing here")).toBeInTheDocument();
        // a bare string is wrapped in the shared empty-state paragraph
        expect(screen.getByText("nothing here")).toHaveClass("empty-state");
        expect(screen.queryByText(ru["common.loading"])).not.toBeInTheDocument();
    });

    it("renders the children when there is something to show", () => {
        render(
            <AsyncState isLoading={false} isEmpty={false} empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText("rows")).toBeInTheDocument();
        expect(screen.queryByText(ru["common.loading"])).not.toBeInTheDocument();
        expect(screen.queryByText("nothing here")).not.toBeInTheDocument();
    });

    it("puts the loader over an already rendered list without keepPrevious", () => {
        render(
            <AsyncState isLoading isEmpty={false} empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText(ru["common.loading"])).toBeInTheDocument();
        expect(screen.getByText("rows")).toBeInTheDocument();
    });

    it("keepPrevious keeps the rendered children and says nothing while reloading", () => {
        const { rerender } = render(
            <AsyncState keepPrevious isLoading={false} isEmpty={false} empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );
        expect(screen.getByText("rows")).toBeInTheDocument();

        // the filter changed: a new request is in flight over the same list
        rerender(
            <AsyncState keepPrevious isLoading isEmpty={false} empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText("rows")).toBeInTheDocument();
        expect(screen.queryByText(ru["common.loading"])).not.toBeInTheDocument();
    });

    it("keepPrevious still shows the loader when there is nothing on screen yet", () => {
        render(
            <AsyncState keepPrevious isLoading isEmpty empty="nothing here">
                <p>rows</p>
            </AsyncState>,
        );

        expect(screen.getByText(ru["common.loading"])).toBeInTheDocument();
    });
});
