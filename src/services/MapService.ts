import BaseService from "./BaseService"

class MapService extends BaseService {
    public getMarks() {
        return fetch("/api/map/marks").then(this.getResponse)
    }
    public addMark() {
        return fetch("/api/map/marks").then(this.getResponse)
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