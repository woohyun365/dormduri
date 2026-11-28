# syntax=docker/dockerfile:1.29@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

# 백오피스 Web image(backoffice-foundation D-BF1). Next.js standalone server가 admin ingress 뒤 internal network에서만 듣고,
# backoffice-api는 BACKOFFICE_API_URL(internal network 주소)로만 부른다. origin `http://localhost:4300`과 Host는 code 상수다.
# build context는 저장소 root다. browser에 나가는 build 값(NEXT_PUBLIC_*)이 없다.
ARG NODE_IMAGE=node:26.13.1-trixie-slim@sha256:abe7e5a82b61a8ef67b315b85497c9e65173387ccf2f4a029248184b8e020be5

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace
COPY package.json ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")" \
  && npm cache clean --force

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backoffice-web/package.json apps/backoffice-web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/backoffice-web apps/backoffice-web
COPY packages/shared packages/shared
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
RUN pnpm --dir apps/backoffice-web exec tsc -p ../../packages/shared/tsconfig.json
RUN pnpm --dir apps/backoffice-web run ci:build
# standalone server는 `.next/static`을 그 옆에서 찾는다(public 디렉터리는 없다).
RUN test -f apps/backoffice-web/.next/standalone/apps/backoffice-web/server.js \
  && cp -R apps/backoffice-web/.next/static apps/backoffice-web/.next/standalone/apps/backoffice-web/.next/static

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Seoul
WORKDIR /app
RUN groupadd --system --gid 10002 dormduri \
  && useradd --system --uid 10002 --gid dormduri --home-dir /app --shell /usr/sbin/nologin dormduri
COPY --from=build --chown=root:root /workspace/apps/backoffice-web/.next/standalone ./
USER dormduri
EXPOSE 3000
# 로그인 화면은 session cookie가 없으면 API를 부르지 않는다. 화면이 그려지면 server가 떠 있다.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/backoffice-web/server.js"]
