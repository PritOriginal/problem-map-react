import { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { Link, To } from "react-router-dom";
import { Mark } from "../../services/MarksService";
import markTypesStore from "../../store/mark-types";
import { MarkBadges } from "../badges/badges";
import { TypeIcon } from "./mark";
import { localeOf, useT } from "../../i18n";

/**
 * One mark in a list: its category icon and number, its badges, and the day it was
 * made. The profile screens each carried their own copy of this, down to the same
 * three inline flex objects.
 *
 * `to` makes the row a link; without one it is a real `<button>`, so a row that only
 * runs a callback is reachable from the keyboard instead of being a clickable `<div>`.
 * `trailing` is for whatever the screen adds on the right of the badge row.
 */
export const MarkRow = observer(function MarkRow({ mark, to, onClick, trailing }: {
    mark: Mark;
    to?: To;
    onClick?: () => void;
    trailing?: ReactNode;
}) {
    const { t, lang } = useT();
    const type = markTypesStore.byId.get(mark.mark_type_id);

    const content = (
        <>
            <span className="mark-row__head">
                <TypeIcon typeId={mark.mark_type_id} type={type} color="#000" />
                <span className="mark-row__name"><b>{t("mark.n", { id: mark.mark_id })}</b> {type?.name ?? ""}</span>
            </span>
            <span className="mark-row__foot">
                <MarkBadges mark={mark} />
                {trailing ?? <span className="mark-row__date">{new Date(mark.created_at).toLocaleDateString(localeOf(lang))}</span>}
            </span>
        </>
    );

    if (to !== undefined) {
        return <Link className="profile-list__item mark-row" to={to} onClick={onClick}>{content}</Link>;
    }
    return (
        <button type="button" className="profile-list__item mark-row" onClick={onClick}>{content}</button>
    );
});

export default MarkRow;
