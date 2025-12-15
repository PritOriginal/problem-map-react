import BaseService from "./BaseService"

class MapService extends BaseService {
    public getDistricts() {
        return fetch("/api/map/districts").then(this.getResponse)
    }
}

export default new MapService();