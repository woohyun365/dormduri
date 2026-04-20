const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LocalDateString = string;
export type IsoDateTimeString = string;

export function toDateOnlyString(value: Date | string): LocalDateString {
  return typeof value === 'string' ? value : value.toISOString().slice(0, 10);
}

export function toIsoDateTimeString(value: Date | string): IsoDateTimeString {
  return typeof value === 'string' ? value : value.toISOString();
}

export function isLocalDateString(value: string): value is LocalDateString {
  return LOCAL_DATE_PATTERN.test(value);
}
