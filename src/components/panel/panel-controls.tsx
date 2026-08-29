import { ReactNode, useEffect, useId, useMemo } from "react";
import { observer } from "mobx-react-lite";
import adminBoundariesStore from "../../store/admin-boundaries";
import { useT } from "../../i18n";

/**
 * The filter row above a list: the same `.analytics-controls` grid that analytics,
 * the leaderboard and moderation each opened by hand.
 */
export function PanelControls({ children }: { children: ReactNode }): ReactNode {
    return <div className="analytics-controls">{children}</div>;
}

export interface SelectOption<T extends string | number> {
    value: T;
    label: string;
}

/**
 * A labelled `<select>`.
 *
 * The label is tied to the control by `htmlFor`/`id` rather than by wrapping alone:
 * every one of these used to be a bare `<label>text<select/></label>`, and analytics
 * additionally had a `<label style={{ gridColumn: "1 / -1" }}>` whose only purpose was
 * the grid span -- a label with no control is what a screen reader reports it as.
 *
 * The value type drives the parse: a `number` select gives `onChange` a number back,
 * so call sites stop writing `Number(e.target.value)` and the union-typed string
 * selects stop writing a cast.
 */
export function SelectField<T extends string | number>({ label, value, options, onChange, span }: {
    label: string;
    value: T;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
    /** Stretch across the whole grid -- the replacement for `style={{ gridColumn: "1 / -1" }}`. */
    span?: boolean;
}): ReactNode {
    const id = useId();
    const numeric = typeof value === "number";
    return (
        <label className={span ? "analytics-controls__span" : undefined} htmlFor={id}>
            {label}
            <select
                id={id}
                value={value}
                onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
            >
                {options.map((option) => <option key={String(option.value)} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}

/**
 * The district filter. Both screens that carry one repeated the whole of it --
 * the warm-up effect, the same `admin_level`-then-name sort, and the "whole city"
 * option with id 0 -- so all three live here now. The store loads once and shares
 * an in-flight request, so mounting this reuses the map's data.
 */
export const BoundarySelect = observer(function BoundarySelect({ value, onChange, label, span }: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    span?: boolean;
}): ReactNode {
    const { t } = useT();

    useEffect(() => {
        adminBoundariesStore.fetchBoundaries();
    }, []);

    const raw = adminBoundariesStore.boundaries;
    const options = useMemo(() => [
        { value: 0, label: t("analytics.wholeCity") },
        ...[...raw]
            .sort((a, b) => a.admin_level - b.admin_level || a.name.localeCompare(b.name))
            .map((boundary) => ({ value: boundary.id, label: boundary.name })),
    ], [raw, t]);

    return <SelectField label={label} value={value} options={options} onChange={onChange} span={span} />;
});
