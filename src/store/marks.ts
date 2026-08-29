import { makeAutoObservable, runInAction } from 'mobx';
import { t } from "../i18n";
import MarksService, { GetMarksRequest, Mark, MarkStatusType } from '../services/MarksService';
import notificationsStore from './notifications';

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
        try {
            const response = await MarksService.getMarks(this.filters);
            runInAction(() => {
                this.marks = response.payload.marks;
                this.isLoading = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, t("errors.marks"));
                this.isLoading = false;
            });
        }
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

const marksStore = new MarksStore();

export default marksStore;