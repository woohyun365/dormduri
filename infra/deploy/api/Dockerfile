# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG NODE_IMAGE=node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03

FROM ${NODE_IMAGE} AS base
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

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system knu \
  && useradd --system --gid knu --home-dir /app --shell /usr/sbin/nologin knu
COPY --from=build --chown=knu:knu /workspace/runtime ./
COPY --from=build --chown=knu:knu /workspace/apps/api/dist ./dist
COPY --from=build --chown=knu:knu /workspace/apps/api/src/generated/prisma ./src/generated/prisma
COPY --from=build --chown=knu:knu /workspace/apps/api/prisma ./prisma
COPY --chown=knu:knu infra/deploy/api/entrypoint.sh ./entrypoint.sh
COPY --chown=knu:knu infra/deploy/api/healthcheck.sh ./healthcheck.sh
COPY --chown=knu:knu infra/deploy/api/env.manifest.json ./env.manifest.json
RUN chmod +x ./entrypoint.sh ./healthcheck.sh
USER knu
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["./healthcheck.sh"]
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
