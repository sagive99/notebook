import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useAuthState, useCalendarSyncState, useNotebook, useServices } from '../../state/hooks';
import { CloudIcon, PeopleIcon, PlusIcon, SearchIcon, SpacesIcon, TodayIcon } from '../icons';
import { href } from '../router';
import type { Route } from '../router';

export const BottomNav = ({ route }: { route: Route }) => {
  const tabs = [
    { label: 'Today', target: { name: 'today' } as Route, icon: <TodayIcon />, active: route.name === 'today' || route.name === 'customize' },
    { label: 'Spaces', target: { name: 'spaces' } as Route, icon: <SpacesIcon />, active: route.name === 'spaces' || route.name === 'space' || route.name === 'new-space' || route.name === 'space-settings' },
    { label: 'People', target: { name: 'people' } as Route, icon: <PeopleIcon />, active: route.name === 'people' },
    { label: 'Search', target: { name: 'search' } as Route, icon: <SearchIcon />, active: route.name === 'search' },
  ];

  return (
    <nav class="bottom-nav" aria-label="Main">
      {tabs.map((tab) => (
        <a key={tab.label} href={href(tab.target)} class={`bottom-nav__tab ${tab.active ? 'bottom-nav__tab--active' : ''}`} aria-current={tab.active ? 'page' : undefined}>
          {tab.icon}
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
};

export const CaptureBar = ({ label = 'Write anything…', onOpen }: { label?: string; onOpen: () => void }) => (
  <div class="capture-bar">
    <button type="button" class="capture-bar__button" onClick={onOpen}>
      <PlusIcon size={18} />
      <span>{label}</span>
    </button>
  </div>
);

export const ScreenHeader = ({ eyebrow, title, actions, back }: { eyebrow?: string; title: string; actions?: ComponentChildren; back?: { label: string; href: string } }) => (
  <header class="screen-header">
    {back ? <a class="back-link" href={back.href}>‹ {back.label}</a> : null}
    <div class="screen-header__row">
      <div class="screen-header__titles">
        {eyebrow ? <span class="screen-header__eyebrow">{eyebrow}</span> : null}
        <h1 class="screen-header__title" dir="auto">{title}</h1>
      </div>
      {actions ? <div class="screen-header__actions">{actions}</div> : null}
    </div>
  </header>
);

/** One compact line telling the user whether their notebook is safely synced, with the fix when it is not. */
export const SyncBanner = () => {
  const services = useServices();
  const { status } = useNotebook();
  const auth = useAuthState();
  const calendarState = useCalendarSyncState();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!services.auth) {
    return null;
  }

  const connect = async () => {
    setBusy(true);
    setError(null);

    try {
      await services.connect();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const needsAction = auth.status !== 'signed-in' || status.kind === 'needs-auth' || calendarState.kind === 'needs-auth';

  if (needsAction) {
    const label = auth.status === 'signed-out' ? 'Connect Google to sync Calendar and back up your notebook.' : 'Google session expired. Changes are saved on this phone.';

    return (
      <div class="banner" role="status">
        <CloudIcon size={18} />
        <span class="banner__text">{error ?? label}</span>
        <button type="button" class="pill-button pill-button--small" disabled={busy} onClick={connect}>{auth.status === 'signed-out' ? 'Connect' : 'Reconnect'}</button>
      </div>
    );
  }

  if (status.kind === 'error' || calendarState.kind === 'error') {
    const message = status.kind === 'error' ? status.message : calendarState.kind === 'error' ? calendarState.message : '';

    return (
      <div class="banner banner--warning" role="status">
        <CloudIcon size={18} />
        <span class="banner__text">{message}</span>
        <button type="button" class="pill-button pill-button--small" onClick={() => {
          void services.store.sync();
          void services.calendarSync.flush();
        }}>Retry</button>
      </div>
    );
  }

  if (status.kind === 'offline') {
    return <div class="banner banner--quiet" role="status"><CloudIcon size={18} /><span class="banner__text">Offline. Changes are saved on this phone and will sync later.</span></div>;
  }

  return null;
};

export const SyncDot = () => {
  const { status } = useNotebook();
  const label = status.kind === 'synced' ? 'Synced' : status.kind === 'syncing' || status.kind === 'pending' ? 'Syncing' : status.kind === 'local-only' ? 'On this device' : status.kind === 'offline' ? 'Offline' : status.kind === 'signed-out' ? 'Not connected' : 'Needs attention';
  const tone = status.kind === 'synced' ? 'ok' : status.kind === 'syncing' || status.kind === 'pending' ? 'busy' : status.kind === 'local-only' ? 'quiet' : 'warn';

  return <span class={`sync-dot sync-dot--${tone}`} role="status" aria-label={label} title={label} />;
};
