import { makeAutoObservable, runInAction } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { Role, canModerate } from '../utils/role';

class User {
    username: string = "";
    id: number = 0;
    role: Role = "user";

    constructor() {
        makeAutoObservable(this);
        makePersistable(this, {
            name: 'user',
            properties: ['username', "id", "role"],
            storage: window.localStorage,
        });
    }

    get isModerator(): boolean {
        return this.id !== 0 && canModerate(this.role);
    }

    setUser = (username: string, id: number, role: Role = "user") => {
        runInAction(() => {
            this.username = username;
            this.id = id;
            this.role = role;
        });
    }

    setRole = (role: Role) => {
        this.role = role;
    }

    resetUser = () => {
        runInAction(() => {
            this.username = "";
            this.id = 0;
            this.role = "user";
        });
    }
}

const user = new User();
export default user;
