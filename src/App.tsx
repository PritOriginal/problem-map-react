import { useEffect } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import { getAccessToken, isAccessTokenValid, refreshTokens } from './services/tokens';
import PanelRoute from './components/panel/panel';

export default function App() {

  useEffect(() => {
    if (!isAccessTokenValid(getAccessToken())) {
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