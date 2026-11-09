import { afterEach, expect, it, vi } from 'vitest';
import type { GoogleAuth } from './auth';
import { GmailGateway, IMPORTANT_QUERY } from './gmail';

const auth = { accessToken: () => 'token', hasScope: () => true, invalidate: () => undefined } as unknown as GoogleAuth;

afterEach(() => vi.unstubAllGlobals());

it('lists new important inbox mail, newest first, with unread state and arrival time', async () => {
  const fetch = vi.fn(async (url: string) => {
    if (url.includes('/messages?')) {
      return Response.json({ messages: [{ id: 'old', threadId: 't1' }, { id: 'new', threadId: 't2' }] });
    }

    if (url.includes('/messages/old?')) {
      return Response.json({ id: 'old', threadId: 't1', labelIds: ['INBOX', 'IMPORTANT'], internalDate: '1000', payload: { headers: [{ name: 'Subject', value: 'Invoice' }, { name: 'From', value: '"Dana Levi" <dana@example.com>' }] } });
    }

    return Response.json({ id: 'new', threadId: 't2', labelIds: ['INBOX', 'IMPORTANT', 'UNREAD'], internalDate: '2000', payload: { headers: [{ name: 'From', value: 'ops@example.com' }] } });
  });
  vi.stubGlobal('fetch', fetch);

  const emails = await new GmailGateway(auth).listImportant(8);

  expect(new URL(String(fetch.mock.calls[0]?.[0])).searchParams.get('q')).toBe(IMPORTANT_QUERY);
  expect(emails).toEqual([
    { id: 'new', subject: '(No subject)', from: 'ops@example.com', receivedAt: 2000, unread: true, link: 'https://mail.google.com/mail/u/0/#all/t2' },
    { id: 'old', subject: 'Invoice', from: 'Dana Levi', receivedAt: 1000, unread: false, link: 'https://mail.google.com/mail/u/0/#all/t1' },
  ]);
});
