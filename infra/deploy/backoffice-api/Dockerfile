# syntax=docker/dockerfile:1.29@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

# 백오피스 API image(backoffice-foundation D-BF1·D-BF13·D-BF16). migration을 실행하지 않고(D-SF5, migration owner는 api-cd의
# migrate image), runtime과 one-off `bootstrap-owner`(dist/cli)를 같은 image로 띄운다. build context는 저장소 root다.
ARG NODE_IMAGE=node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
# RDS 서버 인증서를 검증하는 CA(D-AB5). 사용자 API image와 같은 서울 regional bundle과 같은 sha256 원본
# (infra/deploy/api/rds-ca-bundle.sha256)으로 대조해 단일 루트만 넣는다. 원본이 바뀌면 두 image가 함께 바뀐다.
ARG RDS_CA_BUNDLE_URL=https://truststore.pki.rds.amazonaws.com/ap-northeast-2/ap-northeast-2-bundle.pem

FROM ${NODE_IMAGE} AS rds-ca
ARG RDS_CA_BUNDLE_URL
WORKDIR /rds-ca
ADD ${RDS_CA_BUNDLE_URL} ap-northeast-2-bundle.pem
COPY infra/deploy/api/rds-ca-bundle.sha256 rds-ca-bundle.sha256
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
RUN npm install --global "$(node -p "require('./package.json').packageManager")" \
  && npm cache clean --force

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backoffice-api/package.json apps/backoffice-api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/backoffice-api apps/backoffice-api
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
# 생성 client와 TypedSQL은 Git 밖이라 CD가 일회용 PostgreSQL에서 만들어 build context에 둔다(backoffice-cd.yml).
RUN test -f packages/database/src/generated/prisma/client.ts && test -f packages/database/src/generated/prisma/sql.ts
RUN pnpm --dir apps/backoffice-api exec tsc -p ../../packages/shared/tsconfig.json
RUN pnpm --dir apps/backoffice-api exec tsc -p ../../packages/database/tsconfig.json
RUN pnpm --dir apps/backoffice-api exec nest build
RUN pnpm deploy --legacy --filter backoffice-api --prod /workspace/runtime

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV BACKOFFICE_API_PORT=4310
ENV TZ=Asia/Seoul
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 dormduri \
  && useradd --system --uid 10001 --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri \
  && install -d -m 0755 /etc/dormduri/rds-ca
# pnpm deploy 결과에서는 실행에 쓰는 package.json과 node_modules만 가져온다(source·test·개발 설정은 넣지 않는다).
COPY --from=build --chown=root:root /workspace/runtime/package.json ./package.json
COPY --from=build --chown=root:root /workspace/runtime/node_modules ./node_modules
COPY --from=build --chown=root:root /workspace/apps/backoffice-api/dist ./dist
COPY --chown=root:root --chmod=0755 infra/deploy/backoffice-api/entrypoint.sh ./entrypoint.sh
COPY --chown=root:root --chmod=0444 infra/deploy/backoffice-api/secret-mount.contract.json ./secret-mount.contract.json
COPY --from=rds-ca --chmod=0444 /rds-ca/root.pem /etc/dormduri/rds-ca/root.pem
USER dormduri
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.BACKOFFICE_API_PORT||'4310')+'/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
