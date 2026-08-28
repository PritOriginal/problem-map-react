import { makeAutoObservable, runInAction } from "mobx";
import MapService, { AdminBoundary, AdminBoundaryMarksCount, GetAdminBoundariesMarksCountRequest, GetAdminBoundariesRequest } from "../services/MapService";
import { getErrorMessage } from "../services/http";
import notificationsStore from "./notifications";
import marksStore from "./marks";

class AdminBoundariesStore {
    boundaries: AdminBoundary[] = [];
    marksCount: AdminBoundaryMarksCount[] = [];

    filtersBoundaries: GetAdminBoundariesRequest = {
        admin_levels: [6, 9, 10]
    }
    filtersMarksCount: GetAdminBoundariesMarksCountRequest = {
        admin_levels: [6, 9, 10],
        mark_type_ids: [],
    }

    isLoadingBoundaries: boolean = false;
    isLoadingMarksCount: boolean = false;

    errorBoundaries: string | null = null;
    errorMarkCount: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetchBoundaries = async () => {
        this.isLoadingBoundaries = true;
        this.errorBoundaries = null;
        try {
            const response = await MapService.getAdminBoundaries(this.filtersBoundaries);
            runInAction(() => {
                this.boundaries = response.payload.admin_boundaries;
                this.isLoadingBoundaries = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.errorBoundaries = getErrorMessage(error, 'Ошибка загрузки административных границ');
                this.isLoadingBoundaries = false;
            });
            notificationsStore.showError(this.errorBoundaries);
        }
    }

    fetchMarksCount = async () => {
        this.isLoadingMarksCount = true;
        this.errorMarkCount = null;
        try {
            const response = await MapService.getAdminBoundariesMarksCount({
                ...this.filtersMarksCount,
                mark_type_ids: marksStore.filters.mark_type_ids,
            });
            runInAction(() => {
                this.marksCount = response.payload.admin_boundaries;
                this.isLoadingMarksCount = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.errorMarkCount = getErrorMessage(error, 'Ошибка загрузки административных границ');
                this.isLoadingMarksCount = false;
            });
            notificationsStore.showError(this.errorMarkCount);
        }
    }
}

const adminBoundariesStore = new AdminBoundariesStore();

export default adminBoundariesStore;