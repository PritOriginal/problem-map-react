import { useEffect } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import AuthService from './services/AuthService';

export default function App() {

  useEffect(() => {
    AuthService.refreshTokens();
  }, [])

  return (
    <div className='main'>
      <Header />
      <div style={{ width: '100%', height: 'calc(100vh - 48px)' }}>
        <Map />
      </div>
    </div>
  );
}