import { makeAutoObservable, runInAction } from 'mobx';
import { t } from "../i18n";
import MarksService, { MarkType } from '../services/MarksService';
import notificationsStore from './notifications';

class MarkTypesStore {
    types: MarkType[] = [];
    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetch = async () => {
        this.isLoading = true;
        this.error = null;
        try {
            const response = await MarksService.getMarkTypes();
            runInAction(() => {
                this.types = Array.isArray(response.payload) ? response.payload : [];
                this.isLoading = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, t("errors.markTypes"));
                this.isLoading = false;
            });
        }
    }
} 

const markTypesStore = new MarkTypesStore();

export default markTypesStore;