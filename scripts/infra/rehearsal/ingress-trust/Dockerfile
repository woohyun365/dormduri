# Account-free test runtime only; never a production image.
FROM node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY apps/web apps/web
COPY scripts/infra/rehearsal/ingress-trust /fixture
RUN node /fixture/source-manifest.mjs
RUN pnpm --dir apps/api exec tsc -p ../../packages/shared/tsconfig.json && pnpm --dir apps/api exec nest build
ENV NODE_ENV=test
CMD ["node", "/fixture/api.fixture.mjs"]
# Build the real production Web surface without local env files or telemetry credentials.
RUN NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_APP_URL=https://web.s1.test \
    NEXT_PUBLIC_API_URL=/api API_URL=http://127.0.0.1:8081 WEB_APP_URL=https://web.s1.test \
    NEXT_PUBLIC_SENTRY_ENABLED=0 SENTRY_SOURCE_MAP_UPLOAD_ENABLED=0 \
    pnpm --dir apps/web run ci:build
