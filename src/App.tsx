// import {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, reactify} from './lib/ymaps';

import Header from './components/header/Header';
import Map from "./Map";

export default function App() {
  return (
    <div className='main'>
      <Header />
      <div style={{ width: '100%', height: 'calc(100vh - 48px)' }}>
        <Map />
      </div>
    </div>
  );
}