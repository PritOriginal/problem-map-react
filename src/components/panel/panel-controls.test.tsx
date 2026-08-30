import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BoundarySelect, SelectField } from "./panel-controls";
import { resetStores } from "../../test/render";
import { mockFetchRoutes } from "../../test/fetch";
import { ru } from "../../i18n/ru";

describe("SelectField", () => {
    it("binds its label to the control, so the select is reachable by its name", () => {
        render(
            <SelectField
                label="Период"
                value="all"
                options={[{ value: "all", label: "За всё время" }, { value: "week", label: "Неделя" }]}
                onChange={() => {}}
            />,
        );

        // getByLabelText only finds it through a real htmlFor/id pair or an aria name:
        // the wrapping <label> these controls used to rely on is not enough on its own
        // once the label carries anything but the control.
        const select = screen.getByLabelText("Период");
        expect(select.tagName).toBe("SELECT");
    });

    it("hands a string select its own union member back", async () => {
        const onChange = vi.fn();
        render(
            <SelectField
                label="Период"
                value="all"
                options={[{ value: "all", label: "За всё время" }, { value: "week", label: "Неделя" }]}
                onChange={onChange}
            />,
        );

        await userEvent.selectOptions(screen.getByLabelText("Период"), "week");

        expect(onChange).toHaveBeenCalledWith("week");
    });

    it("hands a numeric select a number, not the DOM's string", async () => {
        const onChange = vi.fn();
        render(
            <SelectField
                label="Район"
                value={0}
                options={[{ value: 0, label: "Весь город" }, { value: 7, label: "Центральный" }]}
                onChange={onChange}
            />,
        );

        await userEvent.selectOptions(screen.getByLabelText("Район"), "7");

        expect(onChange).toHaveBeenCalledWith(7);
        expect(onChange.mock.calls[0][0]).toBeTypeOf("number");
    });

    it("spans the whole grid on demand instead of an inline gridColumn", () => {
        const { container } = render(
            <SelectField span label="Район" value={0} options={[{ value: 0, label: "Весь город" }]} onChange={() => {}} />,
        );

        expect(container.querySelector("label")).toHaveClass("analytics-controls__span");
    });

    it("mints a fresh id per instance, so two fields do not share a label", () => {
        render(
            <>
                <SelectField label="Район" value={0} options={[{ value: 0, label: "Весь город" }]} onChange={() => {}} />
                <SelectField label="Период" value="all" options={[{ value: "all", label: "За всё время" }]} onChange={() => {}} />
            </>,
        );

        expect(screen.getByLabelText("Район").id).not.toBe(screen.getByLabelText("Период").id);
    });
});

describe("BoundarySelect", () => {
    beforeEach(() => {
        resetStores();
        // The select reads the geometry-less index, which the store assembles from one
        // marks-count request per admin level (the counter does not report the level itself).
        const byLevel: Record<string, { id: number; name: string }[]> = {
            "6": [{ id: 1, name: "Тамбов" }],
            "9": [{ id: 2, name: "Советский" }, { id: 3, name: "Ленинский" }],
            "10": [],
        };
        const feature = (id: number) => ({
            type: "Feature",
            id,
            geometry: { type: "MultiPolygon", coordinates: [] },
            properties: { name: String(id), admin_level: 9 },
        });
        mockFetchRoutes({
            "GET /api/map/admin-boundaries": {
                admin_boundaries: Object.entries(byLevel).flatMap(([level, refs]) =>
                    refs.map((ref) => ({ ...ref, admin_level: Number(level) }))),
            },
            "GET /api/map/admin-boundaries/1.geojson": feature(1),
            "GET /api/map/admin-boundaries/2.geojson": feature(2),
            "GET /api/map/admin-boundaries/3.geojson": feature(3),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("warms the store and lists the districts by level, then by name", async () => {
        render(<BoundarySelect label={ru["leaderboard.district"]} value={0} onChange={() => {}} />);

        const select = screen.getByLabelText(ru["leaderboard.district"]);
        await waitFor(() => expect(select).toHaveTextContent("Тамбов"));

        const labels = [...select.querySelectorAll("option")].map((o) => o.textContent);
        expect(labels).toEqual([ru["analytics.wholeCity"], "Тамбов", "Ленинский", "Советский"]);
    });
});
