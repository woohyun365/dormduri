# syntax=docker/dockerfile:1.28@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b

ARG NODE_IMAGE=node:26.13.0-trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39
# RDS 서버 인증서를 검증하는 CA(D-AB5). AWS 공식 truststore의 서울 regional bundle을 받아, 저장소에 둔 sha256과 대조한 뒤
# 그 안의 단일 루트(RSA2048 G1)만 image에 넣는다. 값이 바뀌면 rds-ca-bundle.sha256을 고치는 PR로 갱신한다.
ARG RDS_CA_BUNDLE_URL=https://truststore.pki.rds.amazonaws.com/ap-northeast-2/ap-northeast-2-bundle.pem

FROM ${NODE_IMAGE} AS rds-ca
ARG RDS_CA_BUNDLE_URL
WORKDIR /rds-ca
ADD ${RDS_CA_BUNDLE_URL} ap-northeast-2-bundle.pem
COPY infra/deploy/api/rds-ca-bundle.sha256 rds-ca-bundle.sha256
# bundle의 인증서를 하나씩 나눠 sha가 `root.pem` 줄과 같은 것을 고르고, bundle과 root를 함께 검증한다.
RUN awk '/-----BEGIN CERTIFICATE-----/ { n++; file = "cert-" n ".pem" } n { print > file } /-----END CERTIFICATE-----/ { close(file) }' ap-northeast-2-bundle.pem \
  && root_sha=$(awk '$2 == "root.pem" { print $1 }' rds-ca-bundle.sha256) \
  && for cert in cert-*.pem; do \
    if [ "$(sha256sum "$cert" | cut -d ' ' -f 1)" = "$root_sha" ]; then cp "$cert" root.pem; fi; \
  done \
  && sha256sum --check --strict rds-ca-bundle.sha256

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
COPY package.json ./
# npm cache는 migrate image(이 stage에서 시작)에 남지 않게 지운다(image secret scan이 cache의 예시 URL을 잡는다).
RUN npm install --global "$(node -p "require('./package.json').packageManager")" \
  && npm cache clean --force

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
RUN pnpm --dir apps/api exec tsc -p ../../packages/shared/tsconfig.json
RUN test -f packages/database/src/generated/prisma/client.ts && test -f packages/database/src/generated/prisma/sql.ts
RUN pnpm --dir apps/api exec tsc -p ../../packages/database/tsconfig.json
RUN pnpm --dir apps/api exec nest build
RUN pnpm deploy --legacy --filter api --prod /workspace/runtime

# migrate target(D-AB10)이 쓰는 prisma CLI tree. `packages/database`의 devDependency(prisma CLI)를 포함한다.
FROM deps AS migrate-build
COPY packages/database packages/database
RUN pnpm deploy --legacy --filter @repo/database /workspace/migrate-runtime

# migrate·grant·role smoke·auth mail outbox 확인 one-off image. listener가 없고 non-root(10001)로 돈다. runtime image와
# 같은 commit·build에서 만들고 API release 묶음으로 함께 배포·rollback한다.
FROM base AS migrate
ENV NODE_ENV=production
ENV CHECKPOINT_DISABLE=1
ENV TZ=Asia/Seoul
WORKDIR /app
# PostgreSQL 18 client(PGDG). 저장소 key는 Debian 서명 package postgresql-common 안의 것을 쓴다. postgresql-common이 끌어오는
# ssl-cert가 설치 때 만드는 자체 서명 snakeoil key·인증서는 server를 띄우지 않는 이 image에 필요 없어 지운다.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates postgresql-common tzdata \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/ssl/private/ssl-cert-snakeoil.key /etc/ssl/certs/ssl-cert-snakeoil.pem \
  && groupadd --system --gid 10001 dormduri \
  && useradd --system --uid 10001 --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri \
  && install -d -m 0755 /etc/dormduri/rds-ca
COPY --from=migrate-build --chown=root:root /workspace/migrate-runtime /app/packages/database
COPY --chown=root:root packages/database/prisma /app/packages/database/prisma
COPY --chown=root:root packages/database/prisma.config.ts /app/packages/database/prisma.config.ts
COPY --chown=root:root infra/db/ /app/infra/db/
COPY --chown=root:root --chmod=0755 infra/deploy/api/migrate-entrypoint.sh /app/migrate-entrypoint.sh
COPY --from=rds-ca --chmod=0444 /rds-ca/root.pem /etc/dormduri/rds-ca/root.pem
USER dormduri
ENTRYPOINT ["/app/migrate-entrypoint.sh"]

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 dormduri \
  && useradd --system --uid 10001 --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri \
  && install -d -m 0755 /etc/dormduri/rds-ca
# pnpm deploy 결과에서는 실행에 쓰는 package.json과 node_modules만 가져온다(apps/api의 source·test·개발 설정은 넣지 않는다).
COPY --from=build --chown=dormduri:dormduri /workspace/runtime/package.json ./package.json
COPY --from=build --chown=dormduri:dormduri /workspace/runtime/node_modules ./node_modules
COPY --from=build --chown=dormduri:dormduri /workspace/apps/api/dist ./dist
COPY --from=build --chown=dormduri:dormduri /workspace/packages/database/prisma ./prisma
COPY --from=build --chown=dormduri:dormduri /workspace/apps/api/prisma ./prisma
COPY --chown=dormduri:dormduri infra/deploy/api/entrypoint.sh ./entrypoint.sh
COPY --chown=dormduri:dormduri infra/deploy/api/healthcheck.sh ./healthcheck.sh
COPY --chown=dormduri:dormduri infra/deploy/api/env.manifest.json ./env.manifest.json
COPY --from=rds-ca --chmod=0444 /rds-ca/root.pem /etc/dormduri/rds-ca/root.pem
RUN chmod +x ./entrypoint.sh ./healthcheck.sh
USER dormduri
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["./healthcheck.sh"]
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
