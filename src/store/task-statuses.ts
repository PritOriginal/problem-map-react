import { makeAutoObservable, runInAction } from "mobx";
import TasksService, { TaskStatus } from "../services/TasksService";
import { tOr } from "../i18n";

/** Task statuses dictionary; falls back to the i18n names when the endpoint is unavailable. */
class TaskStatusesStore {
    statuses: TaskStatus[] = [];

    constructor() {
        makeAutoObservable(this);
    }

    fetch = async () => {
        try {
            const response = await TasksService.getTaskStatuses();
            runInAction(() => {
                this.statuses = Array.isArray(response.payload) ? response.payload : [];
            });
        } catch (error) {
            console.error(error);
        }
    }

    nameOf = (id: number): string => {
        return this.statuses.find((s) => s.id === id)?.name ?? tOr(`tasks.status.${id}`, String(id));
    }
}

const taskStatusesStore = new TaskStatusesStore();

export default taskStatusesStore;
