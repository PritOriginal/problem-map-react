import BaseService from "./BaseService"

export interface MarkType {
    type_mark_id: number;
    name: string;
}

export interface MarkStatus {
    mark_status_id: number;
    name: string;
}


class MapService extends BaseService {
    public getMarks() {
        return fetch("/api/map/marks").then(this.getResponse)
    }

    public getMarkById(id: number) {
        return fetch(`/api/map/marks/${id}`).then(this.getResponse)
    }

    public getMarksByUserId(userId: number) {
        return fetch(`/api/map/marks/user/${userId}`).then(this.getResponse)
    }

    public addMark() {
        return fetch("/api/map/marks").then(this.getResponse)
    }

    public getMarkTypes() {
        return fetch("/api/map/marks/types").then(this.getResponse)
    }

    public getMarkStatuses() {
        return fetch("/api/map/marks/statuses").then(this.getResponse)
    }

    public getDistricts() {
        return fetch("/api/map/districts").then(this.getResponse)
    }

    public addPhoto(photo: Blob) {
        const formData = new FormData();
        formData.append("photo", photo)

        return fetch("/api/map/photos", {
            method: "POST",
            body: formData,
        }).then(this.getResponse)
    }
}

export default new MapService();