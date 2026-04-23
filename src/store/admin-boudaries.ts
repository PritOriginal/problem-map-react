import { makeAutoObservable, runInAction } from "mobx";
import MapService, { AdminBoundary, AdminBoundaryMarksCount, GetAdminBoundariesMarksCountRequest, GetAdminBoundariesRequest } from "../services/MapService";

class AdminBoundariesStore {
    boundaries: AdminBoundary[] = [];
    marksCount: AdminBoundaryMarksCount[] = [];

    isLoadingBoundaries: boolean = false;
    isLoadingMarksCount: boolean = false;

    errorBoundaries: string | null = null;
    errorMarkCount: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    fetchBoundaries = async (req: GetAdminBoundariesRequest) => {
        this.isLoadingBoundaries = true;
        this.errorBoundaries = null;
        try {
            const response = await MapService.getAdminBoundaries(req);
            runInAction(() => {
                this.boundaries = response.payload.admin_boundaries;
                this.isLoadingBoundaries = false;
            });
        } catch (error) {
            console.log(error);
            this.errorBoundaries = 'Ошибка загрузки административных границ';
            this.isLoadingBoundaries = false;
        }
    }

    fetchMarksCount = async (req: GetAdminBoundariesMarksCountRequest) => {
        this.isLoadingMarksCount = true;
        this.errorMarkCount = null;
        try {
            const response = await MapService.getAdminBoundariesMarksCount(req);
            runInAction(() => {
                this.marksCount = response.payload.admin_boundaries;
                this.isLoadingMarksCount = false;
            });
        } catch (error) {
            console.log(error);
            this.errorMarkCount = 'Ошибка загрузки административных границ';
            this.isLoadingMarksCount = false;
        }
    }
}

const adminBoundariesStore = new AdminBoundariesStore();

export default adminBoundariesStore;