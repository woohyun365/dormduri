# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
RUN pnpm --dir apps/api exec tsc -p ../../packages/shared/tsconfig.json
RUN test -f apps/api/src/generated/prisma/client.ts && test -f apps/api/src/generated/prisma/sql.ts
RUN pnpm --dir apps/api exec nest build
RUN pnpm deploy --legacy --filter api --prod /workspace/runtime

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system knu \
  && useradd --system --gid knu --home-dir /app --shell /usr/sbin/nologin knu
COPY --from=build --chown=knu:knu /workspace/runtime ./
COPY --from=build --chown=knu:knu /workspace/apps/api/dist ./dist
COPY --from=build --chown=knu:knu /workspace/apps/api/src/generated/prisma ./src/generated/prisma
COPY --from=build --chown=knu:knu /workspace/apps/api/prisma ./prisma
COPY --chown=knu:knu infra/deploy/api/entrypoint.sh ./entrypoint.sh
COPY --chown=knu:knu infra/deploy/api/healthcheck.sh ./healthcheck.sh
RUN chmod +x ./entrypoint.sh ./healthcheck.sh
USER knu
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["./healthcheck.sh"]
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
