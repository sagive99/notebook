import { toIsoDate } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { AuthState } from '../adapters/google/auth';
import { AuthRequiredError } from '../ports';
import type { CalendarEvent, StarredEmail } from '../ports';
import type { AppServices } from './app-services';
import type { Command, StoreSnapshot } from './notebook-store';

export const ServicesContext = createContext<AppServices | null>(null);

export const useServices = (): AppServices => {
  const services = useContext(ServicesContext);

  if (!services) {
    throw new Error('useServices must be used inside ServicesContext.');
  }

  return services;
};

/** Subscribes to an external store and re-renders on change. */
const useExternal = <T>(subscribe: (listener: () => void) => () => void, read: () => T): T => {
  const [value, setValue] = useState(read);

  useEffect(() => {
    setValue(read);

    return subscribe(() => setValue(read));
  }, [subscribe, read]);

  return value;
};

export const useNotebook = (): StoreSnapshot & { run: (command: Command) => void } => {
  const { store } = useServices();
  const snapshot = useExternal(store.subscribe, store.getSnapshot);
  const run = useCallback((command: Command) => {
    store.run(command);
  }, [store]);

  return { ...snapshot, run };
};

const signedOut = (): AuthState => ({ status: 'signed-out' });
const noopSubscribe = (): (() => void) => () => undefined;

export const useAuthState = (): AuthState => {
  const { auth } = useServices();
  const subscribe = useCallback((listener: () => void) => auth?.subscribe(listener) ?? noopSubscribe(), [auth]);
  const read = useCallback(() => auth?.state() ?? signedOut(), [auth]);

  return useExternal(subscribe, read);
};

export const useCalendarSyncState = () => {
  const { calendarSync } = useServices();

  return useExternal(calendarSync.subscribe, calendarSync.getState);
};

/** Today's date, refreshed when the app returns to the foreground or the day rolls over. */
export const useToday = (): IsoDate => {
  const [today, setToday] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    const refresh = () => setToday(toIsoDate(new Date()));
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
};

export type RemoteData<T> =
  | { kind: 'unavailable' }
  | { kind: 'loading'; previous: T | null }
  | { kind: 'ready'; data: T }
  | { kind: 'needs-auth' }
  | { kind: 'error'; message: string; previous: T | null };

const previousOf = <T>(state: RemoteData<T>): T | null => (state.kind === 'ready' ? state.data : state.kind === 'loading' || state.kind === 'error' ? state.previous : null);

/** Loads remote data while signed in, keeping the last good value visible during refreshes and failures. */
const useRemote = <T>(load: (() => Promise<T>) | null, key: string): { state: RemoteData<T>; reload: () => void } => {
  const auth = useAuthState();
  const [state, setState] = useState<RemoteData<T>>({ kind: 'unavailable' });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!load || auth.status !== 'signed-in') {
      setState(auth.status === 'expired' && load ? { kind: 'needs-auth' } : { kind: 'unavailable' });

      return;
    }

    const request = latest.current + 1;
    latest.current = request;
    setState((current) => ({ kind: 'loading', previous: previousOf(current) }));
    load()
      .then((data) => {
        if (latest.current === request) {
          setState({ kind: 'ready', data });
        }
      })
      .catch((error: unknown) => {
        if (latest.current !== request) {
          return;
        }

        setState((current) => (error instanceof AuthRequiredError ? { kind: 'needs-auth' } : { kind: 'error', message: error instanceof Error ? error.message : 'Could not load.', previous: previousOf(current) }));
      });
  }, [load, auth.status, key, nonce]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNonce((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { state, reload };
};

export const useDayEvents = (day: IsoDate) => {
  const { calendar, calendarSync } = useServices();
  const load = useCallback(async (): Promise<CalendarEvent[]> => {
    if (!calendar) {
      return [];
    }

    const events = await calendar.listDay(day);
    calendarSync.reconcileDay(day, events);

    return events;
  }, [calendar, calendarSync, day]);

  return useRemote(calendar ? load : null, day);
};

export const useStarredEmails = (enabled: boolean) => {
  const { mail, gmailGranted } = useServices();
  const authState = useAuthState();
  const granted = enabled && authState.status === 'signed-in' && gmailGranted();
  const load = useCallback(async (): Promise<StarredEmail[]> => (mail ? mail.listStarred(8) : []), [mail]);

  return { ...useRemote(granted && mail ? load : null, 'starred'), granted };
};
