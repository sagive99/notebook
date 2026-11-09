import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { href, parseRoute } from './router';

describe('parseRoute', () => {
  it('round-trips every route', () => {
    const routes = [{ name: 'today' }, { name: 'spaces' }, { name: 'space', id: 'abc-1' }, { name: 'space-settings', id: 'abc-1' }, { name: 'new-space' }, { name: 'people' }, { name: 'search' }, { name: 'customize' }] as const;

    routes.forEach((route) => expect(parseRoute(href(route))).toEqual(route));
  });

  it('falls back safely on unknown or malformed hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#/nope')).toEqual({ name: 'today' });
    expect(parseRoute('#/space/<script>')).toEqual({ name: 'spaces' });
  });
});

describe('loadConfig', () => {
  it('selects local-only mode without a client id and validates one when present', () => {
    expect(loadConfig({})).toEqual({ googleClientId: null });
    expect(loadConfig({ VITE_GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com' })).toEqual({ googleClientId: '123-abc.apps.googleusercontent.com' });
    expect(() => loadConfig({ VITE_GOOGLE_CLIENT_ID: 'not-a-client-id' })).toThrow();
  });
});
