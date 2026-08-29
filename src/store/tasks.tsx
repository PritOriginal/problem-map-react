import { makeAutoObservable, runInAction } from "mobx";
import TasksService, { GetTasksByUserIdFilters, Task } from "../services/TasksService";
import user from "./user";

class TasksStore {
    tasks: Task[] = []
    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetch = async (filters: GetTasksByUserIdFilters) => {
        this.isLoading = true;
        this.error = null;
        try {
            const response = await TasksService.getTasksByUserId(user.id, filters);
            runInAction(() => {
                this.tasks = response.payload.tasks;
                this.isLoading = false;
            });
        } catch (error) {
            console.log(error);
            this.error = 'Ошибка загрузки заданий';
            this.isLoading = false;
        }
    }
}

const tasksStore = new TasksStore();

export default tasksStore;