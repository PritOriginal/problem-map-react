import { Mark, MarkStatus, MarkStatusHistoryItem, MarkStatusType } from "../../../../../services/MarksService";

/**
 * The history as strata: consecutive changes collapsed into the layer they belong to.
 *
 * A status may have a parent (`InWorkStatus` under `UnderReviewStatus`, say). A change
 * into a child status is a step *inside* the layer its parent opened, not a layer of
 * its own, so it joins the group opened by the nearest parentless change before it.
 * The order the service gave is kept throughout: flattening the groups gives `items`
 * back, and `group[0]` is the change that opened the layer.
 *
 * The list is walked backwards so a run of child changes is in hand by the time the
 * change that opens their layer is reached. Child changes at the very start of the
 * list have no layer to join and are dropped — as the loop this replaces dropped them.
 */
export function groupHistory(items: MarkStatusHistoryItem[], statuses: MarkStatus[]): MarkStatusHistoryItem[][] {
    const byId = new Map(statuses.map((status) => [status.mark_status_id, status]));
    const groups: MarkStatusHistoryItem[][] = [];
    let current: MarkStatusHistoryItem[] = [];
    for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index];
        current.unshift(item);
        // statuses with a parent are grouped under their parent status
        if (byId.get(item.new_mark_status_id)?.parent_id == null) {
            groups.unshift(current);
            current = [];
        }
    }
    return groups;
}

/** Statuses that end the mark's life: nothing left to check. */
const CLOSING_STATUSES: number[] = [
    MarkStatusType.ClosedStatus,
    MarkStatusType.RefutedStatus,
    MarkStatusType.DuplicateStatus,
];

/**
 * Whether the "check this mark" button belongs on the panel.
 *
 * An anonymous visitor is offered the button and meets the sign-in wall behind it, so
 * `userId === 0` says yes; so does a mark with no history yet, which is what the panel
 * shows for the moment before the request lands. Beyond that: a closed, refuted or
 * duplicate mark takes no more checks, and it is one verdict per user per layer — a
 * check the user already left in the CURRENT layer bars another, while their checks in
 * earlier layers do not, because the mark has moved on since.
 */
export function canAddCheck(mark: Mark, groups: MarkStatusHistoryItem[][], userId: number): boolean {
    if (userId === 0 || groups.length === 0) {
        return true;
    }
    if (CLOSING_STATUSES.includes(mark.mark_status_id)) {
        return false;
    }
    const lastGroup = groups[groups.length - 1];
    return !lastGroup.some((item) => (item.checks ?? []).some((check) => check.user_id === userId));
}
