import { jwtDecode } from "jwt-decode";
import AuthService from "./AuthService";
import { saveTokens } from "./tokens";
import user from "../store/user";
import notificationsStore from "../store/notifications";

/** Signs in with login/password, stores the token pair and the user identity. */
export async function signIn(login: string, password: string): Promise<void> {
    const data = await AuthService.signIn({ login, password });
    const payload = jwtDecode(data.payload.access_token);
    saveTokens(data.payload.access_token, data.payload.refresh_token);
    notificationsStore.clear();
    user.setUser(login, Number(payload.sub));
}
