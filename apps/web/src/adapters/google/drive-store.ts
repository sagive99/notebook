import { parseDocument } from '@notebook/core';
import type { NotebookDocument } from '@notebook/core';
import { z } from 'zod';
import { ConflictError } from '../../ports';
import type { RemoteDocumentStore, StoredDocument } from '../../ports';
import { SCOPES } from './auth';
import type { GoogleAuth } from './auth';
import { GoogleApiError, googleFetch } from './http';

const FILE_NAME = 'notebook.json';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const fileMetaSchema = z.object({ id: z.string().min(1), version: z.string().min(1) });
const fileListSchema = z.object({ files: z.array(fileMetaSchema) });

type FileMeta = z.infer<typeof fileMetaSchema>;

/**
 * Keeps the whole notebook as one JSON file in the Drive app-data folder: private to this app,
 * invisible in the user's Drive, and readable from every device signed in to the same account.
 * Drive's monotonically increasing file `version` is the optimistic-concurrency token.
 */
export class DriveDocumentStore implements RemoteDocumentStore {
  private fileId: string | null = null;

  constructor(private readonly auth: GoogleAuth) {}

  async load(): Promise<StoredDocument | null> {
    const meta = await this.findFile();

    if (!meta) {
      return null;
    }

    const response = await googleFetch(this.auth, SCOPES.drive, `${DRIVE}/${encodeURIComponent(meta.id)}?alt=media`);
    const parsed = parseDocument(await response.json());

    if (!parsed.ok) {
      throw new Error(`The notebook stored in Google Drive is not readable (${parsed.error}). Your device copy was kept.`);
    }

    return { document: parsed.document, version: meta.version };
  }

  async save(document: NotebookDocument, expectedVersion: string | null): Promise<StoredDocument> {
    const current = await this.findFile();

    if ((current?.version ?? null) !== expectedVersion) {
      throw new ConflictError();
    }

    const body = JSON.stringify(document);
    const meta = current ? await this.update(current.id, body) : await this.create(body);
    this.fileId = meta.id;

    return { document, version: meta.version };
  }

  private async findFile(): Promise<FileMeta | null> {
    if (this.fileId) {
      const response = await googleFetch(this.auth, SCOPES.drive, `${DRIVE}/${encodeURIComponent(this.fileId)}?fields=id,version,trashed`).catch((error: unknown) => {
        if (error instanceof GoogleApiError && error.status === 404) {
          return null;
        }

        throw error;
      });

      if (response) {
        const parsed = fileMetaSchema.extend({ trashed: z.boolean().optional() }).safeParse(await response.json());

        if (parsed.success && !parsed.data.trashed) {
          return { id: parsed.data.id, version: parsed.data.version };
        }
      }

      this.fileId = null;
    }

    const query = new URLSearchParams({ spaces: 'appDataFolder', q: `name = '${FILE_NAME}' and trashed = false`, fields: 'files(id,version)', orderBy: 'modifiedTime desc', pageSize: '10' });
    const response = await googleFetch(this.auth, SCOPES.drive, `${DRIVE}?${query.toString()}`);
    const listing = fileListSchema.parse(await response.json());
    const [first] = listing.files;
    this.fileId = first?.id ?? null;

    return first ?? null;
  }

  private async create(body: string): Promise<FileMeta> {
    const boundary = `notebook-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata, `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', body, `--${boundary}--`, ''].join('\r\n');
    const response = await googleFetch(this.auth, SCOPES.drive, `${UPLOAD}?uploadType=multipart&fields=id,version`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });

    return fileMetaSchema.parse(await response.json());
  }

  private async update(id: string, body: string): Promise<FileMeta> {
    const response = await googleFetch(this.auth, SCOPES.drive, `${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,version`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body });

    return fileMetaSchema.parse(await response.json());
  }
}
