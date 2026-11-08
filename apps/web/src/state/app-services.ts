import { GoogleAuth, SCOPES } from '../adapters/google/auth';
import { GoogleCalendarGateway } from '../adapters/google/calendar';
import { DriveDocumentStore } from '../adapters/google/drive-store';
import { GmailGateway } from '../adapters/google/gmail';
import { createLocalStore } from '../adapters/local-store';
import type { AppConfig } from '../config';
import type { CalendarGateway, MailGateway } from '../ports';
import { CalendarSync } from './calendar-sync';
import { NotebookStore } from './notebook-store';

export type AppServices = {
  config: AppConfig;
  store: NotebookStore;
  auth: GoogleAuth | null;
  calendar: CalendarGateway | null;
  mail: MailGateway | null;
  calendarSync: CalendarSync;
  /** Signs in (from a tap) and starts syncing. */
  connect: () => Promise<void>;
  /** Asks for read-only Gmail access on top of the base sign-in (from a tap). */
  connectGmail: () => Promise<void>;
  gmailGranted: () => boolean;
  disconnect: () => Promise<void>;
  dispose: () => void;
};

const SYNC_INTERVAL_MS = 120_000;

/**
 * Composition root: wires adapters to the store and services. Nothing else constructs adapters,
 * so the UI depends only on ports and state.
 */
export const createAppServices = (config: AppConfig): AppServices => {
  const auth = config.googleClientId ? new GoogleAuth(config.googleClientId) : null;
  const remote = auth ? new DriveDocumentStore(auth) : null;
  const calendar = auth ? new GoogleCalendarGateway(auth) : null;
  const mail = auth ? new GmailGateway(auth) : null;
  const store = new NotebookStore({ local: createLocalStore(), remote: null });
  const calendarSync = new CalendarSync(store, null);

  const activate = (): void => {
    if (!auth || !remote) {
      return;
    }

    const state = auth.state();

    if (state.status === 'signed-in') {
      store.setRemote(remote, { kind: 'pending' });
      calendarSync.setGateway(calendar);
      void store.sync();

      return;
    }

    store.setRemote(remote, state.status === 'expired' ? { kind: 'needs-auth', message: 'Tap Reconnect to sync with Google.' } : { kind: 'signed-out' });
    calendarSync.setGateway(null);
  };

  activate();
  const unsubscribeAuth = auth?.subscribe(activate) ?? (() => undefined);

  const syncIfVisible = (): void => {
    if (document.visibilityState === 'visible' && auth?.state().status === 'signed-in') {
      void store.sync();
      void calendarSync.flush();
    }
  };
  const interval = setInterval(syncIfVisible, SYNC_INTERVAL_MS);
  document.addEventListener('visibilitychange', syncIfVisible);
  window.addEventListener('online', syncIfVisible);

  return {
    config,
    store,
    auth,
    calendar,
    mail,
    calendarSync,
    connect: async () => {
      await auth?.connect();
    },
    connectGmail: async () => {
      await auth?.connect([SCOPES.gmail]);
    },
    gmailGranted: () => auth?.hasScope(SCOPES.gmail) ?? false,
    disconnect: async () => {
      await auth?.disconnect();
    },
    dispose: () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('online', syncIfVisible);
      unsubscribeAuth();
      store.dispose();
    },
  };
};

