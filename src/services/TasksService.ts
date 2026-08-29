import BaseService, { IResponse } from "./BaseService";

export interface Task {
    task_id: number;
    user_id: number;
    mark_id: number;
    status_id: number;
    created_at: string;
    updated_at: string;
}

export enum TaskStatusType {
    UnfulfilledStatus = 1,
	CompletedStatus,
}

export interface GetTasksByUserIdFilters {
    statuses: number[];
}

export interface GetTasksByUserIdResponse extends IResponse {
    payload: GetTasksByUserIdResponsePayload;
}

export interface GetTasksByUserIdResponsePayload {
    tasks: Task[];
}

class TasksService extends BaseService {
    getTasksByUserId(userId: number, filters: GetTasksByUserIdFilters): Promise<GetTasksByUserIdResponse> {
        const params = new URLSearchParams();
        if (filters.statuses.length > 0) {
            params.append("statuses", filters.statuses.join(","));
        }

        return fetch(`/api/tasks/user/${userId}?${params}`).then(this.getResponse)
    }
}

export default new TasksService();