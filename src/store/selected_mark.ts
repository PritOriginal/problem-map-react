import { makeAutoObservable } from 'mobx';

class SelectedMark {
    id: number = 0;

    constructor() {
        makeAutoObservable(this);
    }

    setId = (id: number) => {
        this.id = id;
    }
}

const selectedMark = new SelectedMark();

export default selectedMark