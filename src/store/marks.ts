import { makeAutoObservable, runInAction } from 'mobx';
import MarksService, { Mark } from '../services/MarksService';

class MarksStore {
    marks: Mark[] = [];
    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetchMarks = async () => {
        this.isLoading = true;
        this.error = null;
        try {
            const response = await MarksService.getMarks();
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
}

const marksStore = new MarksStore();

export default marksStore;