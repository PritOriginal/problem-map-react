import { makeAutoObservable, runInAction } from 'mobx';
import MarksService, { MarkType } from '../services/MarksService';
import { getErrorMessage } from '../services/http';
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
                this.types = response.payload.mark_types;
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

const markTypesStore = new MarkTypesStore();

export default markTypesStore;