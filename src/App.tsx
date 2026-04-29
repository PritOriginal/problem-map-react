import { useEffect } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import AuthService from './services/AuthService';
import PanelRoute from './components/panel/panel';

export default function App() {

  useEffect(() => {
    AuthService.refreshTokens();
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