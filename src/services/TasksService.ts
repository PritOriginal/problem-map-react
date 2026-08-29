import BaseService, { IResponse, unwrapList } from "./BaseService";
import { ListMeta } from "./http";

/** Task statuses (`GET /tasks/statuses`). */
export enum TaskStatusType {
    Assigned = 1,
    Done = 2,
    Overdue = 3,
}

export interface Task {
    task_id: number;
    name: string;
    user_id: number;
    mark_id: number;
    status_id: number;
    /** Deadline (ISO date-time) or null when the task has none. */
    due_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface TaskStatus {
    id: number;
    code: string;
    name: string;
}

export interface GetTasksRequest {
    statuses?: number[];
    limit?: number;
    offset?: number;
}

/** `GET /tasks/user/{id}` returns `{ tasks: Task[] }`; `payload` is unwrapped to the list. */
export interface GetTasksResponse extends IResponse {
    payload: Task[];
    meta?: ListMeta;
}

/** `GET /tasks/statuses` returns `{ task_statuses: TaskStatus[] }`; `payload` is unwrapped to the list. */
export interface GetTaskStatusesResponse extends IResponse {
    payload: TaskStatus[];
}

/** Tasks of a user (backend integration/wave-4). Completing a task = adding a check on its mark. */
class TasksService extends BaseService {
    public getUserTasks(userId: number, req: GetTasksRequest = {}): Promise<GetTasksResponse> {
        const params = new URLSearchParams();
        if (req.statuses && req.statuses.length > 0) {
            params.set("statuses", req.statuses.join(","));
        }
        if (req.limit !== undefined) {
            params.set("limit", String(req.limit));
        }
        if (req.offset !== undefined) {
            params.set("offset", String(req.offset));
        }
        const query = params.toString();
        return this.requestWithAuth<IResponse>(`/api/tasks/user/${userId}${query ? `?${query}` : ""}`)
            .then((res) => ({ ...res, payload: unwrapList<Task>(res.payload, "tasks") }));
    }

    /** Localized task statuses (`Accept-Language`); optional on the backend. */
    public getTaskStatuses(): Promise<GetTaskStatusesResponse> {
        return this.request<IResponse>("/api/tasks/statuses")
            .then((res) => ({ ...res, payload: unwrapList<TaskStatus>(res.payload, "task_statuses") }));
    }
}

export default new TasksService();
