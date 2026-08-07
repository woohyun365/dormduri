import { normalizeWebRuntimeMode, parseWebServerEnv, type WebServerEnv } from './env.schema';

export {
  normalizeWebRuntimeMode,
  parseWebServerEnv,
  webEnvDefaults,
  WebEnvValidationError,
} from './env.schema';
export type { WebRuntimeMode, WebServerEnv } from './env.schema';
export type { WebOperationalTelemetryEnv } from './env.schema';

export function getWebEnv(rawEnv: NodeJS.ProcessEnv = process.env): WebServerEnv {
  return parseWebServerEnv(rawEnv, normalizeWebRuntimeMode(rawEnv.NODE_ENV));
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
