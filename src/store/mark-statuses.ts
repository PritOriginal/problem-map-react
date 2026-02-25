import { makeAutoObservable, runInAction } from 'mobx';
import MarksService, { MarkStatus } from '../services/MarksService';

class MarkStatusesStore {
    statuses: MarkStatus[] = [];
    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetch = async () => {
        this.isLoading = true;
        this.error = null;
        try {
            const response = await MarksService.getMarkStatuses();
            runInAction(() => {
                this.statuses = response.payload.mark_statuses;
                this.isLoading = false;
            });
        } catch (error) {
            console.log(error);
            this.error = 'Ошибка загрузки типов меток';
            this.isLoading = false;
        }
    }
}

const markStatusesStore = new MarkStatusesStore();

export default markStatusesStore;