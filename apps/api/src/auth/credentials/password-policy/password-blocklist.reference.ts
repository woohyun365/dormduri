export const AUTH_PASSWORD_COMMON_VALUE_REFERENCE = [
  '1234567890',
  'abcdefghij',
  'admin12345',
  'changeme123',
  'iloveyou123',
  'letmein1234',
  'password1!',
  'password123',
  'qwerty1234',
  'welcome123',
] as const;

export const AUTH_PASSWORD_SERVICE_VALUE_REFERENCE = [
  'dormduri123',
  'dormduri2026',
  'kangwon2026',
  'kangwonroom',
  'knuroommate',
  'knuroommate2026',
  'roommate123',
] as const;

export const AUTH_PASSWORD_BLOCKLIST_REFERENCE = [
  ...AUTH_PASSWORD_COMMON_VALUE_REFERENCE,
  ...AUTH_PASSWORD_SERVICE_VALUE_REFERENCE,
] as const;

export function validateAuthPasswordBlocklistReference(): void {
  const values = [...AUTH_PASSWORD_BLOCKLIST_REFERENCE];
  if (new Set(values).size !== values.length) {
    throw new Error('Auth password blocklist values must be unique');
  }
  if (values.some((value) => value !== value.toLowerCase())) {
    throw new Error('Auth password blocklist values must use lowercase risk keys');
  }
  if (values.some((value) => /\p{White_Space}/u.test(value))) {
    throw new Error('Auth password blocklist values must not contain whitespace');
  }
  if (values.some((value) => !/^[\u0021-\u007e]+$/u.test(value))) {
    throw new Error('Auth password blocklist values must use printable ASCII');
  }
}
