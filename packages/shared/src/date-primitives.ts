import { z } from 'zod';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const localDateStringSchema = z.string().regex(LOCAL_DATE_PATTERN);
export const isoDateTimeStringSchema = z.iso.datetime({ offset: true });

export type LocalDateString = z.infer<typeof localDateStringSchema>;
export type IsoDateTimeString = z.infer<typeof isoDateTimeStringSchema>;

export function isLocalDateString(value: string): value is LocalDateString {
  return localDateStringSchema.safeParse(value).success;
}

export function parseLocalDateString(value: unknown): LocalDateString | null {
  const result = localDateStringSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseIsoDateTimeString(value: unknown): IsoDateTimeString | null {
  const result = isoDateTimeStringSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function toDateOnlyString(value: Date | string): LocalDateString {
  const normalized = typeof value === 'string' ? value : value.toISOString().slice(0, 10);
  const parsed = parseLocalDateString(normalized);

  if (!parsed) {
    throw new Error(`[date-primitives] invalid LocalDateString: ${String(value)}`);
  }

  return parsed;
}

export function toIsoDateTimeString(value: Date | string): IsoDateTimeString {
  const normalized = typeof value === 'string' ? value : value.toISOString();
  const parsed = parseIsoDateTimeString(normalized);

  if (!parsed) {
    throw new Error(`[date-primitives] invalid IsoDateTimeString: ${String(value)}`);
  }

  return parsed;
}
