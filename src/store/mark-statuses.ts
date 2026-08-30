import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import MarksService, { MarkStatus } from "../services/MarksService";
import notificationsStore from "./notifications";

class MarkStatusesStore {
    statuses: MarkStatus[] = [];
    isLoading: boolean = false;
    error: string | null = null;

    private loaded: boolean = false;
    /** The request currently in flight, shared with every caller that joins it. */
    private inFlight: Promise<void> | null = null;

    constructor() {
        makeAutoObservable<MarkStatusesStore, "loaded" | "inFlight">(this, { loaded: false, inFlight: false });
    }

    /** Statuses by id — a computed index so list rows do not each run a `find()`. */
    get byId(): Map<number, MarkStatus> {
        return new Map(this.statuses.map((status) => [status.mark_status_id, status]));
    }

    /**
     * Loads the dictionary once. The map, the admin and the analytics panels all ask for it,
     * and StrictMode runs every effect twice, so concurrent callers share one request instead
     * of each firing its own; a caller arriving after a successful load gets no request at all.
     *
     * `force` re-fetches — the names are localized by `Accept-Language`, so a language change
     * has to reload them. A forced reload never resolves with the answer of a request that was
     * already in flight (it may carry the previous language): it queues a fresh one behind it.
     *
     * A failure is not remembered: the next call tries again, so one network error at startup
     * does not leave the app without its dictionary.
     */
    fetch = (force: boolean = false): Promise<void> => {
        if (!force) {
            if (this.inFlight) {
                return this.inFlight;
            }
            if (this.loaded) {
                return Promise.resolve();
            }
        }
        // no queue to wait for -> the request starts synchronously, as it did before the guard
        const previous = this.inFlight;
        const request: Promise<void> = (previous ? previous.then(() => this.load()) : this.load())
            .finally(() => {
                if (this.inFlight === request) {
                    this.inFlight = null;
                }
            });
        this.inFlight = request;
        return request;
    }

    private load = async (): Promise<void> => {
        runInAction(() => {
            this.isLoading = true;
            this.error = null;
        });
        try {
            const response = await MarksService.getMarkStatuses();
            runInAction(() => {
                this.statuses = Array.isArray(response.payload) ? response.payload : [];
                this.loaded = true;
                this.isLoading = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, t("errors.markStatuses"));
                this.isLoading = false;
            });
        }
    }
}

const markStatusesStore = new MarkStatusesStore();

export default markStatusesStore;
