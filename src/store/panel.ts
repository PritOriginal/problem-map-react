import { makeAutoObservable } from "mobx";

class PanelStore {
    isOpen: boolean = false;
    headerHeight: number = 0;
    constructor() {
        makeAutoObservable(this);
    }

    setHeight = (height: number) => {
        this.headerHeight = height;
        document.documentElement.style.setProperty("--panel-header-height", `${height}px`);
    }

    setOpen = (state: boolean) => {
        this.isOpen = state;
    }

    toggle = () => {
        this.isOpen = !this.isOpen;
    }

}

const panelStore = new PanelStore();

export default panelStore;