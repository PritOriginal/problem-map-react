import { useEffect } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import { getAccessToken, isAccessTokenValid, refreshTokens } from './services/tokens';
import PanelRoute from './components/panel/panel';
import user from './store/user';
import { getRoleFromToken } from './utils/role';
import { useT } from './i18n';
import { useOnline } from './utils/hooks';
import offlineQueueStore from './store/offline-queue';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { useToKeepSearch } from './utils/navigation';
import { useDictionaryReload } from './utils/use-dictionary-reload';

export default function App() {
  useEffect(() => {
    const token = getAccessToken();
    if (isAccessTokenValid(token)) {
      // keep the persisted role in sync with the token (e.g. role changed server-side);
      // wait for hydration, otherwise the persisted (possibly stale) role would overwrite ours
      user.hydrated.then(() => {
        if (user.id !== 0) {
          user.setRole(getRoleFromToken(token));
        }
      });
    } else {
      refreshTokens().catch(console.error);
    }
  }, [])

  // offline queue: load persisted items and flush them when the browser comes back online
  useEffect(() => {
    offlineQueueStore.start();
    return () => offlineQueueStore.stop();
  }, []);

  // dictionaries are localized by `Accept-Language`: reload them when the language changes
  // (the initial load happens in Map on mount)
  useDictionaryReload();

  return (
    <>
      <Header />
      <OfflineBanner />
      <QueueBanner />
      <section className='main'>
        <PanelRoute />
        <Map />
      </section>
    </>
  );
}

function OfflineBanner() {
  const { t } = useT();
  const online = useOnline();
  if (online) {
    return null;
  }
  return <div className="offline-banner" role="status">{t("common.offline")}</div>;
}

/** "Sending postponed: N queued" with a manual send button (offline queue, wave-5). */
const QueueBanner = observer(function QueueBanner() {
  const { t } = useT();
  const online = useOnline();
  const toKeepSearch = useToKeepSearch();
  const count = offlineQueueStore.count;
  if (count === 0) {
    return null;
  }
  return (
    <div className="offline-banner queue-banner" role="status">
      <Link to={toKeepSearch("/queue")}>{t("offline.banner", { count })}</Link>
      <button type="button" className="btn-secondary mini" disabled={!online || offlineQueueStore.isFlushing} onClick={() => offlineQueueStore.flush()}>
        {t(offlineQueueStore.isFlushing ? "offline.sending" : "offline.send")}
      </button>
    </div>
  );
});
