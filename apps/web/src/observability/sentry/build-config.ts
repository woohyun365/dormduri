import type { SentryBuildOptions } from '@sentry/nextjs';

export type SentryBuildConfig = Readonly<{
  uploadRequested: boolean;
  uploadEnabled: boolean;
  release: string;
  options: SentryBuildOptions;
}>;

type SentryBuildEnv = Readonly<Record<string, string | undefined>>;

function value(rawEnv: SentryBuildEnv, key: string): string | undefined {
  const candidate = rawEnv[key]?.trim();
  return candidate && candidate.length > 0 ? candidate : undefined;
}

export function resolveSentryBuildConfig(rawEnv: SentryBuildEnv = process.env): SentryBuildConfig {
  const uploadRequested = rawEnv.SENTRY_SOURCE_MAP_UPLOAD_ENABLED === '1';
  const evidenceApproved = rawEnv.SENTRY_RELEASE_EVIDENCE_APPROVED === '1';
  const org = value(rawEnv, 'SENTRY_ORG');
  const project = value(rawEnv, 'SENTRY_PROJECT');
  const authToken = value(rawEnv, 'SENTRY_AUTH_TOKEN');
  const serverRelease = value(rawEnv, 'SENTRY_RELEASE');
  const publicRelease = value(rawEnv, 'NEXT_PUBLIC_WEB_RELEASE');
  const release = serverRelease ?? publicRelease ?? 'development';
  const uploadEnabled = Boolean(
    uploadRequested &&
    evidenceApproved &&
    org &&
    project &&
    authToken &&
    serverRelease &&
    publicRelease &&
    serverRelease === publicRelease &&
    release !== 'development',
  );

  return {
    uploadRequested,
    uploadEnabled,
    release,
    options: {
      telemetry: false,
      silent: true,
      org: uploadEnabled ? org : undefined,
      project: uploadEnabled ? project : undefined,
      authToken: uploadEnabled ? authToken : undefined,
      release: { name: release },
      sourcemaps: {
        disable: !uploadEnabled,
        deleteSourcemapsAfterUpload: true,
      },
      webpack: {
        treeshake: {
          removeDebugLogging: true,
          excludeReplayIframe: true,
          excludeReplayShadowDOM: true,
          excludeReplayCompressionWorker: true,
        },
        reactComponentAnnotation: { enabled: false },
      },
    },
  };
}
