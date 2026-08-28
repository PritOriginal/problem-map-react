import { makeAutoObservable } from "mobx";
import { getErrorMessage } from "../services/http";

class NotificationsStore {
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    /** Shows the error banner and returns the displayed message. */
    showError = (error: unknown, fallback?: string): string => {
        this.error = getErrorMessage(error, fallback);
        return this.error;
    }

    clear = () => {
        this.error = null;
    }
}

const notificationsStore = new NotificationsStore();

export default notificationsStore;
