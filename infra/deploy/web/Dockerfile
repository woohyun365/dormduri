# syntax=docker/dockerfile:1.28@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b

ARG NODE_IMAGE=node:26.13.0-trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
COPY package.json ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_APP_URL=https://web.local.invalid
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SENTRY_ENABLED=0
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED=1
ARG NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED=1
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
ARG NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED=0
ARG NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED=0
ARG NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT=local
ARG NEXT_PUBLIC_WEB_RELEASE=local-rehearsal
ARG SENTRY_SOURCE_MAP_UPLOAD_ENABLED=0
ARG SENTRY_RELEASE_EVIDENCE_APPROVED=0
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SENTRY_ENABLED=${NEXT_PUBLIC_SENTRY_ENABLED}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED=${NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED}
ENV NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED=${NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED}
ENV NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE}
ENV NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED=${NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED}
ENV NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED=${NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED}
ENV NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT=${NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT}
ENV NEXT_PUBLIC_WEB_RELEASE=${NEXT_PUBLIC_WEB_RELEASE}
ENV SENTRY_SOURCE_MAP_UPLOAD_ENABLED=${SENTRY_SOURCE_MAP_UPLOAD_ENABLED}
ENV SENTRY_RELEASE_EVIDENCE_APPROVED=${SENTRY_RELEASE_EVIDENCE_APPROVED}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY scripts/ci/product/prepare-next-standalone.mjs scripts/ci/product/prepare-next-standalone.mjs
RUN pnpm --dir apps/web exec tsc -p ../../packages/shared/tsconfig.json
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
  pnpm --dir apps/web run ci:build
RUN node scripts/ci/product/prepare-next-standalone.mjs --web-root=apps/web

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN groupadd --system dormduri \
  && useradd --system --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri
COPY --from=build --chown=dormduri:dormduri /workspace/apps/web/.next/standalone ./
USER dormduri
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
