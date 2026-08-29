import { makeAutoObservable, runInAction } from "mobx";
import MapService, { BBox, HeatmapFeature } from "../services/MapService";
import { heatmapKey } from "../utils/heatmap";
import marksStore from "./marks";
import notificationsStore from "./notifications";

/** Heatmap layer state: toggled from the map filters, fetched per bbox/zoom. */
class HeatmapStore {
    enabled: boolean = false;
    features: HeatmapFeature[] = [];
    maxCount: number = 0;
    isLoading: boolean = false;

    private lastKey: string = "";
    private requestId: number = 0;

    constructor() {
        makeAutoObservable<HeatmapStore, "lastKey" | "requestId">(this, { lastKey: false, requestId: false });
    }

    setEnabled = (enabled: boolean) => {
        this.enabled = enabled;
        if (!enabled) {
            // invalidate in-flight requests so a late response does not repopulate a disabled layer
            this.requestId++;
            this.features = [];
            this.maxCount = 0;
            this.isLoading = false;
            this.lastKey = "";
        }
    }

    toggle = () => {
        this.setEnabled(!this.enabled);
    }

    /** Fetches the heatmap for the view unless the same request was just made. */
    fetch = async (bbox: BBox, cellM: number) => {
        if (!this.enabled) {
            return;
        }
        const { mark_type_ids, mark_status_ids } = marksStore.filters;
        const key = heatmapKey(bbox, cellM, mark_type_ids, mark_status_ids);
        if (key === this.lastKey) {
            return;
        }
        this.lastKey = key;
        const id = ++this.requestId;
        this.isLoading = true;
        try {
            const response = await MapService.getHeatmap({ bbox, cell_m: cellM, mark_type_ids: [...mark_type_ids], mark_status_ids: [...mark_status_ids] });
            if (id !== this.requestId || !this.enabled) {
                return;
            }
            runInAction(() => {
                this.features = response.payload?.features ?? [];
                this.maxCount = this.features.reduce((m, f) => Math.max(m, f.properties?.count ?? 0), 0);
                this.isLoading = false;
            });
        } catch (error) {
            if (id !== this.requestId) {
                return;
            }
            console.error(error);
            runInAction(() => {
                this.lastKey = "";
                this.isLoading = false;
                notificationsStore.showError(error, "Не удалось загрузить тепловую карту");
            });
        }
    }
}

const heatmapStore = new HeatmapStore();

export default heatmapStore;
