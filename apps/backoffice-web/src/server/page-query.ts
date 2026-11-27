import 'server-only';

/** Reads Next.js search params as flat strings for a shared query schema. */
export function flatSearchParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
}

export function toSearchParams(
  values: Record<string, string | number | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
// Legal version ids: UUIDs for approved versions and kind-date slugs for the development seed (backoffice-api).
const LEGAL_VERSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/u;

/** A path id a page puts in an API path; anything else is a page that does not exist. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isLegalVersionId(value: string): boolean {
  return LEGAL_VERSION_ID_PATTERN.test(value);
}
