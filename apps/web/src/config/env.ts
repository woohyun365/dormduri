import {
  normalizeWebRuntimeMode,
  parseLegalLastSuccessDirectory,
  parseWebServerEnv,
  type WebServerEnv,
} from './env.schema';

export {
  normalizeWebRuntimeMode,
  parseWebSentryEnv,
  parseWebServerEnv,
  webEnvDefaults,
  WebEnvValidationError,
} from './env.schema';
export type { WebRuntimeMode, WebServerEnv } from './env.schema';
export type { WebOperationalTelemetryEnv, WebSentryEnv } from './env.schema';

export function getWebEnv(rawEnv: NodeJS.ProcessEnv = process.env): WebServerEnv {
  return parseWebServerEnv(rawEnv, normalizeWebRuntimeMode(rawEnv.NODE_ENV));
}

/** The legal last success directory, without validating the rest of the server env. */
export function getLegalLastSuccessDirectory(rawEnv: NodeJS.ProcessEnv = process.env): string {
  return parseLegalLastSuccessDirectory(rawEnv);
}

export const webEnv = new Proxy({} as WebServerEnv, {
  get(_target, property: string | symbol): WebServerEnv[keyof WebServerEnv] | undefined {
    if (typeof property !== 'string') {
      return undefined;
    }

    const parsedEnv = getWebEnv();
    return parsedEnv[property as keyof WebServerEnv];
  },
});
