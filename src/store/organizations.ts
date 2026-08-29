import { makeAutoObservable, runInAction } from "mobx";
import OrganizationsService, { Organization } from "../services/OrganizationsService";

/** Dictionary of organizations (names for mark cards, options for the assign select). */
class OrganizationsStore {
    items: Organization[] = [];
    isLoading: boolean = false;
    private loaded: boolean = false;

    constructor() {
        makeAutoObservable<OrganizationsStore, "loaded">(this, { loaded: false });
    }

    /** Loads the dictionary once; `force` re-fetches (e.g. after a language change). */
    fetch = async (force: boolean = false) => {
        if ((this.loaded && !force) || this.isLoading) {
            return;
        }
        this.isLoading = true;
        try {
            const response = await OrganizationsService.getOrganizations();
            runInAction(() => {
                this.items = response.payload ?? [];
                this.loaded = true;
                this.isLoading = false;
            });
        } catch (error) {
            // the dictionary is auxiliary (wave-4 backend): cards simply show no organization
            console.error(error);
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    nameOf = (id: number | null | undefined): string | null => {
        if (id === null || id === undefined) {
            return null;
        }
        return this.items.find((o) => o.organization_id === id)?.name ?? null;
    }
}

const organizationsStore = new OrganizationsStore();

export default organizationsStore;
