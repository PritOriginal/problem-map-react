import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { HistoryGroup } from "./history-column";
import { setTheme } from "../../../../../theme";
import { statusColors } from "../../../../../styles/tokens";
import type { MarkStatusHistoryItem } from "../../../../../services/MarksService";

const item: MarkStatusHistoryItem = {
    id: 1,
    mark_id: 7,
    old_mark_status_id: 1,
    new_mark_status_id: 2,
    changed_at: "2026-01-01T10:00:00Z",
};

function renderGroup() {
    return render(
        <MemoryRouter>
            <HistoryGroup group={[item]} depth={40} spanMs={3_600_000} isLast={false} />
        </MemoryRouter>,
    );
}

afterEach(() => setTheme("auto"));

/** The stratum is the one place the panel paints a mark status itself. */
describe("the history stratum", () => {
    it("takes the status colour of the live theme", () => {
        setTheme("dark");
        const { container } = renderGroup();
        const stratum = container.querySelector(".core__stratum") as HTMLElement;
        expect(stratum).toBeTruthy();
        expect(stratum.style.backgroundColor).toBe(rgb(statusColors("dark")[2]));
    });

    it("switches with the theme rather than staying on the light scale", () => {
        setTheme("light");
        const { container } = renderGroup();
        const stratum = container.querySelector(".core__stratum") as HTMLElement;
        expect(stratum.style.backgroundColor).toBe(rgb(statusColors("light")[2]));
        expect(screen.getByRole("listitem")).toBeInTheDocument();
    });
});

/** jsdom reports inline colours as `rgb(r, g, b)`. */
function rgb(hex: string): string {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
}
