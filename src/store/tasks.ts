import { makeAutoObservable, reaction, runInAction } from "mobx";
import TasksService, { Task, TaskStatusType } from "../services/TasksService";
import user from "./user";

/** How many assigned tasks are loaded for the map highlight. */
const ASSIGNED_LIMIT = 500;

/**
 * Tasks assigned to the current user (`statuses=[Assigned]`), used to highlight
 * their marks on the map. Reloaded whenever the signed-in user changes and after
 * a check is added; cleared on sign-out.
 */
class TasksStore {
    tasks: Task[] = [];
    isLoading: boolean = false;
    /** Map filter: show only the marks that have a task assigned to me. */
    onlyMine: boolean = false;

    constructor() {
        makeAutoObservable(this);
        reaction(
            () => user.id,
            (id) => {
                if (id === 0) {
                    this.clear();
                } else {
                    this.fetch();
                }
            },
            { fireImmediately: true },
        );
    }

    get assignedMarkIds(): Set<number> {
        return new Set(this.tasks.map((task) => task.mark_id));
    }

    isAssigned = (markId: number): boolean => {
        return this.assignedMarkIds.has(markId);
    }

    toggleOnlyMine = () => {
        this.onlyMine = !this.onlyMine;
    }

    fetch = async () => {
        const userId = user.id;
        if (userId === 0) {
            return;
        }
        this.isLoading = true;
        try {
            const response = await TasksService.getUserTasks(userId, { statuses: [TaskStatusType.Assigned], limit: ASSIGNED_LIMIT, offset: 0 });
            runInAction(() => {
                // the user may have signed out while the request was in flight
                this.tasks = user.id === userId && Array.isArray(response.payload) ? response.payload : [];
            });
        } catch (error) {
            console.error(error);
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    clear = () => {
        this.tasks = [];
        this.onlyMine = false;
    }
}

const tasksStore = new TasksStore();

export default tasksStore;
