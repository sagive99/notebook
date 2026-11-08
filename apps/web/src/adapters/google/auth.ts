import { z } from 'zod';
import { AuthRequiredError } from '../../ports';
import type { AuthPort, AuthState } from '../../ports';
import { safeStorage } from '../../platform/safe-storage';

export const SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive.appdata',
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
} as const;

export const BASE_SCOPES = [SCOPES.drive, SCOPES.calendar];

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string; scope?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (response: TokenResponse) => void;
        error_callback: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const storedTokenSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
});

type StoredToken = z.infer<typeof storedTokenSchema>;

const TOKEN_KEY = 'notebook.google.token';
const CONNECTED_KEY = 'notebook.google.connected';
const GRANTED_KEY = 'notebook.google.scopes';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EXPIRY_MARGIN_MS = 60_000;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const isExpired = (token: StoredToken): boolean => token.expiresAt - EXPIRY_MARGIN_MS <= Date.now();

const readGrantedScopes = (): string[] => (safeStorage.get(GRANTED_KEY) ?? '').split(' ').filter(Boolean);

const readStoredToken = (): StoredToken | null => {
  const raw = safeStorage.get(TOKEN_KEY);

  if (raw === null) {
    return null;
  }

  try {
    const parsed = storedTokenSchema.safeParse(JSON.parse(raw));

    if (!parsed.success || isExpired(parsed.data)) {
      safeStorage.remove(TOKEN_KEY);

      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

const writeStoredToken = (token: StoredToken | null): void => {
  if (token === null) {
    safeStorage.remove(TOKEN_KEY);

    return;
  }

  safeStorage.set(TOKEN_KEY, JSON.stringify(token));
};

const wasConnected = (): boolean => safeStorage.get(CONNECTED_KEY) === '1';

const loadScript = (): Promise<GoogleIdentity> => new Promise((resolve, reject) => {
  if (window.google?.accounts?.oauth2) {
    resolve(window.google);

    return;
  }

  const script = document.createElement('script');
  script.src = GIS_SRC;
  script.async = true;
  script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in failed to load.')));
  script.onerror = () => reject(new Error('Google sign-in failed to load. Check your connection.'));
  document.head.appendChild(script);
});

/**
 * Google OAuth for a static site: Google Identity Services issues short-lived access tokens
 * in the browser. Tokens are cached until expiry so reopening the app within the hour needs no tap;
 * after that, a single tap re-authorizes (see ADR 0004).
 */
export class GoogleAuth implements AuthPort {
  private token: StoredToken | null = readStoredToken();
  private granted: string[] = readGrantedScopes();
  private client: TokenClient | null = null;
  private pending: { resolve: (token: StoredToken) => void; reject: (error: Error) => void; scopes: string[] } | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly clientId: string) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  state(): AuthState {
    if (this.validToken()) {
      return { status: 'signed-in' };
    }

    return wasConnected() ? { status: 'expired' } : { status: 'signed-out' };
  }

  /** Whether the user granted a scope; remembered across token expiry so incremental grants persist. */
  hasScope(scope: string): boolean {
    return this.granted.includes(scope);
  }

  /** A valid access token, or AuthRequiredError when the user must tap to reconnect. */
  accessToken(scope: string): string {
    const token = this.validToken();

    if (!token || !token.scopes.includes(scope)) {
      throw new AuthRequiredError();
    }

    return token.accessToken;
  }

  /** Marks the cached token unusable after Google rejected it. */
  invalidate(): void {
    this.token = null;
    writeStoredToken(null);
    this.emit();
  }

  /** Must run from a user gesture: it may open Google's consent popup. */
  async connect(extraScopes: string[] = []): Promise<void> {
    const scopes = [...new Set([...BASE_SCOPES, ...this.granted, ...extraScopes])];
    const google = await loadScript();
    const client = this.client ?? google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: scopes.join(' '),
      include_granted_scopes: true,
      callback: (response) => this.onToken(response),
      error_callback: (error) => this.onError(new Error(error.message ?? error.type ?? 'Google sign-in was cancelled.')),
    });
    this.client = client;

    const token = await new Promise<StoredToken>((resolve, reject) => {
      this.pending?.reject(new Error('Superseded by a newer sign-in request.'));
      this.pending = { resolve, reject, scopes };
      client.requestAccessToken({ prompt: wasConnected() && extraScopes.length === 0 ? '' : 'consent', scope: scopes.join(' ') });
    });

    this.token = token;
    this.granted = token.scopes;
    writeStoredToken(token);
    safeStorage.set(GRANTED_KEY, token.scopes.join(' '));
    safeStorage.set(CONNECTED_KEY, '1');
    this.emit();
  }

  /** Revokes the grant at Google (no sign-in script needed) and forgets everything stored locally. */
  async disconnect(): Promise<void> {
    const token = this.token?.accessToken;
    this.token = null;
    this.granted = [];
    writeStoredToken(null);
    safeStorage.remove(GRANTED_KEY);
    safeStorage.remove(CONNECTED_KEY);
    this.emit();

    if (!token) {
      return;
    }

    const response = await fetch(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }).catch(() => null);

    if (!response?.ok) {
      throw new Error('Disconnected on this phone, but Google could not be reached to revoke access. Remove it at myaccount.google.com/permissions.');
    }
  }

  private validToken(): StoredToken | null {
    if (this.token && isExpired(this.token)) {
      this.token = null;
      writeStoredToken(null);
    }

    return this.token;
  }

  private onToken(response: TokenResponse): void {
    const pending = this.pending;
    this.pending = null;

    if (!pending) {
      return;
    }

    if (response.error || !response.access_token) {
      pending.reject(new Error(response.error_description ?? response.error ?? 'Google did not return an access token.'));

      return;
    }

    const granted = (response.scope ?? '').split(' ').filter(Boolean);
    const missing = BASE_SCOPES.filter((scope) => !granted.includes(scope));

    if (missing.length > 0) {
      pending.reject(new Error('Calendar and Drive access are both needed. Please allow them on the Google screen.'));

      return;
    }

    pending.resolve({ accessToken: response.access_token, expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000, scopes: granted });
  }

  private onError(error: Error): void {
    this.pending?.reject(error);
    this.pending = null;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
