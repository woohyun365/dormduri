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

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 dormduri \
  && useradd --system --uid 10001 --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri
COPY --from=build --chown=dormduri:dormduri /workspace/runtime ./
COPY --from=build --chown=dormduri:dormduri /workspace/apps/api/dist ./dist
COPY --from=build --chown=dormduri:dormduri /workspace/apps/api/src/generated/prisma ./src/generated/prisma
COPY --from=build --chown=dormduri:dormduri /workspace/apps/api/prisma ./prisma
COPY --chown=dormduri:dormduri infra/deploy/api/entrypoint.sh ./entrypoint.sh
COPY --chown=dormduri:dormduri infra/deploy/api/healthcheck.sh ./healthcheck.sh
COPY --chown=dormduri:dormduri infra/deploy/api/env.manifest.json ./env.manifest.json
RUN chmod +x ./entrypoint.sh ./healthcheck.sh
USER dormduri
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["./healthcheck.sh"]
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
