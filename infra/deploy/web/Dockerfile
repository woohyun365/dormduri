# syntax=docker/dockerfile:1.29@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

ARG NODE_IMAGE=node:26.13.1-trixie-slim@sha256:abe7e5a82b61a8ef67b315b85497c9e65173387ccf2f4a029248184b8e020be5

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
# Landing 방문 통계 site token(공개 HTML에 들어가는 값). 비어 있으면 Landing이 script를 넣지 않는다.
ARG NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN
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
ENV NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=${NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN}
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
# 법적 문서 마지막 성공본 디렉터리(user host의 named volume target). 새 volume은 첫 기동 때 이 디렉터리의 소유·권한을 받아
# read_only root에서도 runtime 사용자만 쓴다.
RUN groupadd --system dormduri \
  && useradd --system --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri \
  && install -d -o dormduri -g dormduri -m 0700 /var/lib/dormduri/legal
COPY --from=build --chown=dormduri:dormduri /workspace/apps/web/.next/standalone ./
USER dormduri
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
