import { makeAutoObservable, runInAction } from 'mobx';
import { t } from "../i18n";
import MarksService, { GetMarksRequest, MARKS_MAX_LIMIT, Mark, MarkChanges, MarkStatusType } from '../services/MarksService';
import notificationsStore from './notifications';
import { unwrapList } from '../services/http';
import { applyMarkChanges } from '../utils/mark-changes';

/** localStorage key of the `server_time` of the last full load / incremental sync. */
export const MARKS_SINCE_KEY = "marks_since";

/** Filters applied when the URL carries none. */
export const DEFAULT_FILTERS: Readonly<GetMarksRequest> = {
    mark_type_ids: [],
    mark_status_ids: [
        MarkStatusType.UnconfirmedStatus,
        MarkStatusType.ConfirmedStatus,
        MarkStatusType.UnderReviewStatus,
        MarkStatusType.RediscoveredStatus,
        MarkStatusType.ClosedStatus,
        MarkStatusType.InWorkStatus,
    ],
};

/**
 * Page size the map asks for. `GET /marks` without a `limit` gets the backend's own default of
 * 100, which is why the map used to stop at a hundred marks; `MARKS_MAX_LIMIT` is as much as the
 * backend will hand out in one go.
 *
 * One request, not a paging loop: the whole city currently holds ~114 marks, so the cap is five
 * times the data and paging on startup would only add round trips. When `total` does outgrow it
 * the map says so (`truncated`) instead of lying — and that notice is the signal that the map
 * should start loading by viewport instead: `GetMarksRequest.bbox` is already wired through the
 * service for exactly that, and `src/utils/heatmap.ts#bboxFromBounds` already turns the map's
 * bounds into one.
 */
export const MARKS_FETCH_LIMIT = MARKS_MAX_LIMIT;

class MarksStore {
    marks: Mark[] = [];
    /** `meta.total` of the last full load: how many marks match the filters server-side. */
    total: number = 0;
    filters: GetMarksRequest = {
        mark_type_ids: [...DEFAULT_FILTERS.mark_type_ids],
        mark_status_ids: [...DEFAULT_FILTERS.mark_status_ids],
    };

    isLoading: boolean = false;
    error: string | null = null;

    /** Sequence number of the newest `fetch`; a response with an older id is dropped. */
    private requestId: number = 0;
    /** Controller of the in-flight `fetch`, aborted when a newer one starts. */
    private controller: AbortController | null = null;

    constructor() {
        makeAutoObservable<MarksStore, "requestId" | "controller">(this, { requestId: false, controller: false });
    }

    /**
     * Full reload for the current filters. Rapid filter toggling would otherwise let the
     * last *returning* response win instead of the last *requested* one: the previous request
     * is aborted and every stale response (payload, `since` bookmark and error alike) is dropped.
     */
    fetch = async () => {
        this.controller?.abort();
        const controller = new AbortController();
        this.controller = controller;
        const id = ++this.requestId;
        this.isLoading = true;
        this.error = null;
        const startedAt = new Date().toISOString();
        try {
            const response = await MarksService.getMarks(
                { ...this.filters, limit: MARKS_FETCH_LIMIT },
                { signal: controller.signal },
            );
            if (id !== this.requestId) {
                return;
            }
            const marks = unwrapList<Mark>(response.payload, "marks");
            runInAction(() => {
                this.marks = marks;
                // an older backend may answer without `meta`; then what arrived is all there is
                this.total = response.meta?.total ?? marks.length;
                this.isLoading = false;
            });
            // only the winning response may move the incremental-sync bookmark forward
            writeSince(startedAt);
        } catch (error) {
            // a superseded request must not clear the loading flag of its successor, and an
            // abort is our own doing — never a failure worth a toast
            if (id !== this.requestId || isAbortError(error, controller.signal)) {
                return;
            }
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, t("errors.marks"));
                this.isLoading = false;
            });
        }
    }

    /**
     * Incremental refresh (`GET /marks/changes?since=`, backend integration/wave-5): merges changed
     * marks, drops deleted and hidden ones. Falls back to a full reload when there is no `since`
     * yet or the endpoint is unavailable.
     */
    sync = async () => {
        const since = readSince();
        if (!since) {
            return this.fetch();
        }
        try {
            const response = await MarksService.getMarkChanges(since);
            this.applyChanges(response.payload);
        } catch (error) {
            console.error(error);
            return this.fetch();
        }
    }

    /** True when the backend holds more marks for these filters than the map was given. */
    get truncated(): boolean {
        return this.total > this.marks.length;
    }

    applyChanges = (changes: MarkChanges) => {
        // the sync moves `total` by as much as it moved the loaded set, so a page that was
        // truncated stays truncated by the same amount instead of the notice going stale
        const before = this.marks.length;
        this.marks = applyMarkChanges(this.marks, changes, this.filters);
        this.total = Math.max(0, this.total + (this.marks.length - before));
        writeSince(changes.server_time);
    }

    /** Replaces both filter lists without fetching (used to apply filters from the URL). */
    setFilters = (filters: GetMarksRequest) => {
        this.filters.mark_type_ids = [...filters.mark_type_ids];
        this.filters.mark_status_ids = [...filters.mark_status_ids];
    }

    updateMarkType = (markTypeId: number) => {
        const index = this.filters.mark_type_ids.indexOf(markTypeId);
        if (index !== -1) {
            this.filters.mark_type_ids.splice(index, 1);
        } else {
            this.filters.mark_type_ids.push(markTypeId);
        }
        this.fetch();
    }

    updateMarkStatus = (markStatusId: number) => {
        const index = this.filters.mark_status_ids.indexOf(markStatusId);
        if (index !== -1) {
            this.filters.mark_status_ids.splice(index, 1);
        } else {
            this.filters.mark_status_ids.push(markStatusId);
        }
        this.fetch();
    }
}

function readSince(): string | null {
    try {
        return localStorage.getItem(MARKS_SINCE_KEY);
    } catch {
        return null;
    }
}

/** True for the rejection `fetch` produces when its signal is aborted. */
function isAbortError(error: unknown, signal: AbortSignal): boolean {
    return signal.aborted || (error instanceof DOMException && error.name === "AbortError");
}

function writeSince(value: string): void {
    try {
        localStorage.setItem(MARKS_SINCE_KEY, value);
    } catch {
        // ignore
    }
}

const marksStore = new MarksStore();

export default marksStore;