import { makeAutoObservable, runInAction } from 'mobx';
import { t } from "../i18n";
import MarksService, { MarkStatus } from '../services/MarksService';
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
                this.statuses = response.payload;
                this.isLoading = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, t("errors.markStatuses"));
                this.isLoading = false;
            });
        }
    }
}

const markStatusesStore = new MarkStatusesStore();

export default markStatusesStore;