import { z } from 'zod';
import type { InboxEmail, MailGateway } from '../../ports';
import { SCOPES } from './auth';
import type { GoogleAuth } from './auth';
import { googleFetch } from './http';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

/** Recent inbox mail that Gmail marked important, without promotions or social noise. Fixed: never built from user input. */
export const IMPORTANT_QUERY = 'in:inbox is:important newer_than:7d -category:promotions -category:social';

const listSchema = z.object({ messages: z.array(z.object({ id: z.string().min(1), threadId: z.string().min(1) })).default([]) });
const messageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  labelIds: z.array(z.string()).default([]),
  internalDate: z.string().regex(/^\d+$/u).optional(),
  payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })).default([]) }).optional(),
});

const header = (headers: ReadonlyArray<{ name: string; value: string }>, name: string): string => headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())?.value ?? '';

/** Display name from a From header such as `Dana Levi <dana@example.com>`. */
const senderName = (from: string): string => from.replace(/<[^>]*>/u, '').replace(/"/gu, '').trim() || from;

/** Reads new, important inbox messages (metadata only: subject, sender, time, unread) so they can become tasks. */
export class GmailGateway implements MailGateway {
  constructor(private readonly auth: GoogleAuth) {}

  async listImportant(limit: number): Promise<InboxEmail[]> {
    const query = new URLSearchParams({ q: IMPORTANT_QUERY, maxResults: String(limit) });
    const response = await googleFetch(this.auth, SCOPES.gmail, `${API}?${query.toString()}`);
    const listing = listSchema.parse(await response.json());

    const emails = await Promise.all(listing.messages.map(async ({ id }) => {
      const params = new URLSearchParams({ format: 'metadata' });
      params.append('metadataHeaders', 'Subject');
      params.append('metadataHeaders', 'From');
      const detail = messageSchema.parse(await (await googleFetch(this.auth, SCOPES.gmail, `${API}/${encodeURIComponent(id)}?${params.toString()}`)).json());
      const headers = detail.payload?.headers ?? [];

      return {
        id: detail.id,
        subject: header(headers, 'Subject').trim() || '(No subject)',
        from: senderName(header(headers, 'From')),
        receivedAt: detail.internalDate ? Number(detail.internalDate) : null,
        unread: detail.labelIds.includes('UNREAD'),
        link: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(detail.threadId)}`,
      };
    }));

    return emails.sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
  }
}
