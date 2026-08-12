import type { CookieOptions } from 'express';
import type { HttpCookieSameSite } from './http.config.js';

export interface HttpCookiePolicySettings {
  readonly secure: boolean;
  readonly sameSite: HttpCookieSameSite;
  readonly domain: string | null;
}

export function buildHttpCookieOptions(settings: HttpCookiePolicySettings): CookieOptions {
  if (settings.sameSite === 'none' && !settings.secure) {
    throw new Error('[http] SameSite=None cookies require secure=true.');
  }

  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: '/',
    ...(settings.domain ? { domain: settings.domain } : {}),
  };
}
