import BaseService from "./BaseService"

export interface MarkType {
    type_mark_id: number;
    name: string;
}

export interface MarkStatus {
    mark_status_id: number;
    name: string;
}


class MarksService extends BaseService {
    public getMarks() {
        return fetch("/api/marks").then(this.getResponse)
    }

    public getMarkById(id: number) {
        return fetch(`/api/marks/${id}`).then(this.getResponse)
    }

    public getMarksByUserId(userId: number) {
        return fetch(`/api/marks/user/${userId}`).then(this.getResponse)
    }

    public addMark() {
        return fetch("/api/marks").then(this.getResponse)
    }

    public getMarkTypes() {
        return fetch("/api/marks/types").then(this.getResponse)
    }

    public getMarkStatuses() {
        return fetch("/api/marks/statuses").then(this.getResponse)
    }
}

export default new MarksService();