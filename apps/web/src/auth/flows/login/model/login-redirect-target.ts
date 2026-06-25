export const DEFAULT_LOGIN_REDIRECT_TARGET = '/main';

const ALLOWED_LOGIN_REDIRECT_TARGETS = new Set<string>([DEFAULT_LOGIN_REDIRECT_TARGET]);

export function normalizeLoginRedirectTarget(value: string | null | undefined): string {
  if (!value) return DEFAULT_LOGIN_REDIRECT_TARGET;

  const target = value.trim();
  if (!target || target.startsWith('//') || target.includes('://')) {
    return DEFAULT_LOGIN_REDIRECT_TARGET;
  }

  if (target.startsWith('/api/') || target.startsWith('/auth/')) {
    return DEFAULT_LOGIN_REDIRECT_TARGET;
  }

  return ALLOWED_LOGIN_REDIRECT_TARGETS.has(target) ? target : DEFAULT_LOGIN_REDIRECT_TARGET;
}
