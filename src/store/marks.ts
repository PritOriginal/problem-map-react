import { makeAutoObservable, runInAction } from 'mobx';
import { t } from "../i18n";
import MarksService, { GetMarksRequest, Mark, MarkChanges, MarkStatusType } from '../services/MarksService';
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

class MarksStore {
    marks: Mark[] = [];
    filters: GetMarksRequest = {
        mark_type_ids: [...DEFAULT_FILTERS.mark_type_ids],
        mark_status_ids: [...DEFAULT_FILTERS.mark_status_ids],
    };

    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetch = async () => {
        this.isLoading = true;
        this.error = null;
        const startedAt = new Date().toISOString();
        try {
            const response = await MarksService.getMarks(this.filters);
            runInAction(() => {
                this.marks = unwrapList<Mark>(response.payload, "marks");
                this.isLoading = false;
            });
            writeSince(startedAt);
        } catch (error) {
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

    applyChanges = (changes: MarkChanges) => {
        this.marks = applyMarkChanges(this.marks, changes, this.filters);
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

function writeSince(value: string): void {
    try {
        localStorage.setItem(MARKS_SINCE_KEY, value);
    } catch {
        // ignore
    }
}

const marksStore = new MarksStore();

export default marksStore;