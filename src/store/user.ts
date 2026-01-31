import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';

class User {
    username: string = "";
    id: number = 0;

    constructor() {
        makeAutoObservable(this);
        makePersistable(this, {
            name: 'user',
            properties: ['username', "id"],
            storage: window.localStorage,
        });
    }

    setUser = (username: string, id: number) => {
        this.username = username;
        this.id = id;
    }

    resetUser = () => {
        this.username = "";
        this.id = 0;
    }
}

const user = new User();
export default user;