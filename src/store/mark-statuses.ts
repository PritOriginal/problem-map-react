import { makeAutoObservable, runInAction } from 'mobx';
import MarksService, { MarkStatus } from '../services/MarksService';
import { getErrorMessage } from '../services/http';
import notificationsStore from './notifications';

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
            console.error(error);
            runInAction(() => {
                this.error = getErrorMessage(error, 'Ошибка загрузки типов меток');
                this.isLoading = false;
            });
            notificationsStore.showError(this.error);
        }
    }
}

const markStatusesStore = new MarkStatusesStore();

export default markStatusesStore;