import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LegalDocumentKind, LegalVersionKey } from '@repo/shared/legal';
import { getLegalLastSuccessDirectory, webEnvDefaults } from '@/config/env';

// The last successful public reading response of each request, kept in one directory: the user host named volume
// (infra/deploy/user/compose.yml). It outlives Web restarts, rollbacks and new images, so a new Web that starts
// while the API is down still has the last text it read. Files hold public documents only.

/** Which public reading response a file holds: the endpoint, the kind and the version key it was asked with. */
export type LegalLastSuccessKey =
  | {
      readonly endpoint: 'page';
      readonly kind: LegalDocumentKind;
      readonly versionKey: LegalVersionKey | 'current';
    }
  | {
      readonly endpoint: 'comparison';
      readonly kind: LegalDocumentKind;
      readonly versionKey: LegalVersionKey;
    }
  | { readonly endpoint: 'revision-notices' };

export interface LegalLastSuccess<T> {
  readonly response: T;
  /** When the Web last read this response from the API (ISO). */
  readonly checkedAt: string;
}

interface ResponseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export interface LegalLastSuccessStoreOptions {
  readonly directory?: string;
}

/** The named volume target in the Web container (compose contract and Web image keep the same path). */
export const DEFAULT_LEGAL_LAST_SUCCESS_DIRECTORY = webEnvDefaults.legalLastSuccessDirectory;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

// The directory exists before the Web starts (the Web image creates the volume target for its runtime user), so the
// store never creates one.
function directoryOf(options: LegalLastSuccessStoreOptions): string {
  return options.directory ?? getLegalLastSuccessDirectory();
}

/**
 * One file per request key. Kinds come from the shared enum and version keys are checked `YYYY-MM-DD` dates (callers
 * never pass an unchecked value), so a name never leaves the directory and the file count stays the number of versions.
 */
export function legalLastSuccessFileName(key: LegalLastSuccessKey): string {
  if (key.endpoint === 'revision-notices') return 'revision-notices.json';
  return `${key.endpoint}.${key.kind}.${key.versionKey}.json`;
}

/**
 * Writes through a temporary file in the same directory and renames it over the final name, so a reader sees either
 * the previous complete file or the new one. A failure is the caller's to report; nothing is left half written.
 */
export async function writeLegalLastSuccess<T>(
  key: LegalLastSuccessKey,
  response: T,
  checkedAt: Date,
  options: LegalLastSuccessStoreOptions = {},
): Promise<void> {
  const directory = directoryOf(options);
  const target = join(directory, legalLastSuccessFileName(key));
  const temporary = `${target}.${randomUUID()}.tmp`;
  const body = JSON.stringify({ checkedAt: checkedAt.toISOString(), response });
  try {
    await writeFile(temporary, body, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

/** The kept response of a request, or null when there is none or it no longer passes the public contract. */
export async function readLegalLastSuccess<T>(
  key: LegalLastSuccessKey,
  schema: ResponseSchema<T>,
  options: LegalLastSuccessStoreOptions = {},
): Promise<LegalLastSuccess<T> | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(join(directoryOf(options), legalLastSuccessFileName(key)), 'utf8'),
    );
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { checkedAt, response } = parsed as { checkedAt?: unknown; response?: unknown };
  if (typeof checkedAt !== 'string' || !ISO_INSTANT.test(checkedAt)) return null;
  const checked = schema.safeParse(response);
  return checked.success ? { response: checked.data, checkedAt } : null;
}

/** Removes the kept response of a request; a missing file is not an error. */
export async function removeLegalLastSuccess(
  key: LegalLastSuccessKey,
  options: LegalLastSuccessStoreOptions = {},
): Promise<void> {
  await rm(join(directoryOf(options), legalLastSuccessFileName(key)), { force: true });
}
