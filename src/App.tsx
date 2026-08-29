import { useEffect, useRef } from 'react';
import Header from './components/header/Header';
import Map from "./Map";
import { getAccessToken, isAccessTokenValid, refreshTokens } from './services/tokens';
import PanelRoute from './components/panel/panel';
import user from './store/user';
import { getRoleFromToken } from './utils/role';
import { useT } from './i18n';
import { useOnline } from './utils/hooks';
import markTypesStore from './store/mark-types';
import markStatusesStore from './store/mark-statuses';
import organizationsStore from './store/organizations';
import taskStatusesStore from './store/task-statuses';

export default function App() {
  const { lang } = useT();

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

  // dictionaries are localized by `Accept-Language`: reload them when the language changes
  // (the initial load happens in Map on mount)
  const loadedLang = useRef(lang);
  useEffect(() => {
    if (loadedLang.current === lang) {
      return;
    }
    loadedLang.current = lang;
    markTypesStore.fetch();
    markStatusesStore.fetch();
    organizationsStore.fetch(true);
    if (user.id !== 0) {
      taskStatusesStore.fetch();
    }
  }, [lang]);

  return (
    <>
      <Header />
      <OfflineBanner />
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
