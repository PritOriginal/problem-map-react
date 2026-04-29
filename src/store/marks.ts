import { makeAutoObservable, runInAction } from 'mobx';
import MarksService, { GetMarksRequest, Mark, MarkStatusType } from '../services/MarksService';

class MarksStore {
    marks: Mark[] = [];
    filters: GetMarksRequest = {
        mark_type_ids: [],
        mark_status_ids: [
            MarkStatusType.UnconfirmedStatus,
            MarkStatusType.ConfirmedStatus,
            MarkStatusType.UnderReviewStatus,
            MarkStatusType.RediscoveredStatus,
            MarkStatusType.ClosedStatus,
        ]
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
            console.log(error);
            this.error = 'Ошибка загрузки меток';
            this.isLoading = false;
        }
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