import { makeAutoObservable, runInAction } from 'mobx';
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
                this.types = response.payload.mark_types;
                this.isLoading = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, 'Ошибка загрузки типов меток');
                this.isLoading = false;
            });
        }
    }
} 

const markTypesStore = new MarkTypesStore();

export default markTypesStore;