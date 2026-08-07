# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
RUN corepack enable

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
ARG NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED=0
ARG NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED=1
ARG NEXT_PUBLIC_WEB_VITALS_ENABLED=1
ARG NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT=local
ARG NEXT_PUBLIC_WEB_RELEASE=local-rehearsal
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED=${NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED}
ENV NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED=${NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED}
ENV NEXT_PUBLIC_WEB_VITALS_ENABLED=${NEXT_PUBLIC_WEB_VITALS_ENABLED}
ENV NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT=${NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT}
ENV NEXT_PUBLIC_WEB_RELEASE=${NEXT_PUBLIC_WEB_RELEASE}
ENV API_URL=http://web-upstream:4100
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY scripts/ci/prepare-next-standalone.mjs scripts/ci/prepare-next-standalone.mjs
RUN pnpm --dir apps/web exec tsc -p ../../packages/shared/tsconfig.json
RUN pnpm --dir apps/web run ci:build
RUN node scripts/ci/prepare-next-standalone.mjs --web-root=apps/web

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN groupadd --system knu \
  && useradd --system --gid knu --home-dir /app --shell /usr/sbin/nologin knu
COPY --from=build --chown=knu:knu /workspace/apps/web/.next/standalone ./
USER knu
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
