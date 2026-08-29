import type { GetMarksRequest, Mark, MarkChanges } from "../services/MarksService";

/**
 * Merges `GET /marks/changes` into the current list: changed marks replace (or are appended to)
 * existing ones when they match the filters, deleted / hidden ids are removed. Order is kept.
 */
export function applyMarkChanges(current: Mark[], changes: MarkChanges, filters?: GetMarksRequest): Mark[] {
    const gone = new Set<number>([...changes.deleted_ids, ...changes.hidden_ids]);
    const changed = new Map<number, Mark>();
    for (const mark of changes.marks) {
        if (mark.hidden) {
            gone.add(mark.mark_id);
        } else {
            changed.set(mark.mark_id, mark);
        }
    }
    const matches = (mark: Mark) => {
        if (!filters) {
            return true;
        }
        const typeOk = filters.mark_type_ids.length === 0 || filters.mark_type_ids.includes(mark.mark_type_id);
        const statusOk = filters.mark_status_ids.length === 0 || filters.mark_status_ids.includes(mark.mark_status_id);
        return typeOk && statusOk;
    };
    const result: Mark[] = [];
    for (const mark of current) {
        if (gone.has(mark.mark_id)) {
            continue;
        }
        const updated = changed.get(mark.mark_id);
        if (updated) {
            changed.delete(mark.mark_id);
            if (matches(updated)) {
                result.push(updated);
            }
        } else {
            result.push(mark);
        }
    }
    for (const mark of changed.values()) {
        if (!gone.has(mark.mark_id) && matches(mark)) {
            result.push(mark);
        }
    }
    return result;
}
