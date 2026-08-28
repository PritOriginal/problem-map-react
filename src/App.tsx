import { useEffect } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import { getAccessToken, isAccessTokenValid, refreshTokens } from './services/tokens';
import PanelRoute from './components/panel/panel';
import user from './store/user';
import { getRoleFromToken } from './utils/role';

export default function App() {

  useEffect(() => {
    const token = getAccessToken();
    if (isAccessTokenValid(token)) {
      // keep the persisted role in sync with the token (e.g. role changed server-side)
      if (user.id !== 0) {
        user.setRole(getRoleFromToken(token));
      }
    } else {
      refreshTokens().catch(console.error);
    }
  }, [])

  return (
    <>
      <Header />
      <section className='main'>
        <PanelRoute />
        <Map />
      </section>
    </>
  );
}