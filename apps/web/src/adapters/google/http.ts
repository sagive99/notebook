import { AuthRequiredError } from '../../ports';
import type { GoogleAuth } from './auth';

export class GoogleApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export class OfflineError extends Error {
  constructor() {
    super('No connection. Changes are saved on this device and will sync later.');
    this.name = 'OfflineError';
  }
}

const describeFailure = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'message' in body.error ? String(body.error.message) : null;

    return message ?? `Google returned ${response.status}.`;
  } catch {
    return `Google returned ${response.status}.`;
  }
};

/** Authorized fetch against Google APIs; maps expired tokens and network loss to typed errors. */
export const googleFetch = async (auth: GoogleAuth, scope: string, url: string, init: RequestInit = {}): Promise<Response> => {
  const token = auth.accessToken(scope);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers }).catch(() => {
    throw new OfflineError();
  });

  if (response.status === 401) {
    auth.invalidate();

    throw new AuthRequiredError('Your Google session expired. Tap Reconnect to continue syncing.');
  }

  if (response.status === 403 && !auth.hasScope(scope)) {
    throw new AuthRequiredError('Google access for this feature has not been granted yet.');
  }

  if (!response.ok) {
    throw new GoogleApiError(response.status, await describeFailure(response));
  }

  return response;
};
