import { makeAutoObservable } from "mobx";
import { getErrorMessage } from "../services/http";

class NotificationsStore {
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    showError = (error: unknown, fallback?: string) => {
        this.error = getErrorMessage(error, fallback);
    }

    clear = () => {
        this.error = null;
    }
}

const notificationsStore = new NotificationsStore();

export default notificationsStore;
