# API stress fixture and safety guard

`apps/api/test/stress`는 k6/Artillery 부하 테스트가 사용할 **로컬/스테이징 전용 fixture 기반**을 둔다. 제품 API 런타임 코드와 분리된 테스트 도구이며, production target이나 production DB에 실수로 실행되지 않도록 fail-closed guard를 먼저 통과해야 한다.

## 구조

```txt
apps/api/test/stress/
  env.example
  fixtures/
    stress-fixture.config.ts      # cohort size, prefix, campus/season defaults
    stress-fixture.plan.ts        # deterministic actor/dormitory/cohort plan + safe summary
    stress-fixture.apply-guard.ts # DB mutation explicit opt-in guard
    stress-fixture.materializer.ts # local/staging fixture Prisma materializer/reset plan
    stress-fixture.auth-tokens.ts # seeded actor login token artifact helper
    seed-stress-fixture.ts        # default dry-run, explicit guard 통과 시 DB seed
    reset-stress-fixture.ts       # default dry-run, explicit guard 통과 시 marker-only reset
  safety/
    stress-target.guard.ts        # local/staging/production override guard
    stress-secret-redaction.ts    # report/log secret redaction helper
  http/k6/
    *.k6.js                       # k6 HTTP scenario scripts
    k6-http-scenarios.ts          # Node-side scenario metadata/static validation
    run-k6-scenario.mjs           # k6 CLI + summary parser runner
  realtime/artillery/
    *.yml                         # Artillery Socket.IO scenario scripts
    processor.cjs                 # ticket issue + subscribe ack metric hooks
    run-artillery-scenario.mjs    # Artillery CLI + summary parser runner
  reports/
    parse-k6-summary.ts           # k6 summary-export safe report parser
    parse-artillery-summary.ts    # Artillery summary safe report parser
```

Seed/reset runner는 기본적으로 **dry-run**이다. `STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE`가 있을 때만 local/staging target에서 marker-only fixture row를 만들거나 지운다. Phase 6 HTTP stress script는 k6 외부 CLI를 사용하며 npm dependency를 추가하지 않는다. Production API host에는 k6/Artillery를 설치하지 않고, local 개발 머신/CI/별도 runner에서 실행한다.

## Target guard

필수/주요 env:

- `STRESS_TARGET_URL`: seed/reset/stress 실행 대상 API URL. `http://127.0.0.1:4000`처럼 명시한다.
- `STRESS_ENV`: `local`, `staging`, `production`. 기본값은 `local`이다.
- `STRESS_ALLOWED_HOSTS`: 쉼표/공백 구분 allowlist. 스테이징 host는 여기에 명시한다.
- `STRESS_ALLOW_PRODUCTION`: production-like host 또는 `NODE_ENV=production` 실행은 `I_UNDERSTAND` 값 없이는 실패한다. 단, fixture DB mutation은 production override가 있어도 계속 거부된다.
- `STRESS_FIXTURE_APPLY`: `I_UNDERSTAND_STAGING_FIXTURE`일 때만 local/staging DB seed/reset/token login artifact 생성을 허용한다.
- `STRESS_ACTOR_TOKENS_PATH`: k6가 읽을 actor token artifact 경로. 기본 생성 경로는 `test/stress/reports/.tmp-stress-actor-tokens.json`이다.
- `STRESS_TOKEN_ACTOR_LIMIT`: token artifact에 로그인시킬 actor 수. 기본 32명이다.

기본 허용 대상은 localhost, `host.docker.internal`, RFC1918 private IPv4, 또는 `STRESS_ALLOWED_HOSTS`에 명시된 host다. public/production-like host는 explicit override 없이는 거부된다.

## Fixture plan

기본 plan은 다음 기준을 표현한다.

- 가장 큰 실제 cohort 기준: `largestCohortSize=237`
- stress 확장 cohort: `stressCohortSize=946`
- deterministic actor id: `stress-local-actor-0001` 형식
- deterministic user/participant/profile/dormitory id: stress prefix 기반

actor plan에는 seed에 필요한 email/password/token/session 값이 포함될 수 있지만, report/log에 출력할 때는 반드시 `buildStressFixtureSafeSummary` 또는 `redactStressFixtureSecrets`를 거친다.

## 허용되는 report/log 필드

허용:

- actor index, actor id, role
- dormitory id, gender, cohort label
- row count, cohort size, target host, stress env

금지:

- raw email
- password/passphrase
- access/refresh/session token
- `Authorization` header
- cookie/session value
- raw request/response payload 중 secret 포함 가능성이 있는 값

## Local k6 CLI

개발 머신에서는 k6 CLI를 로컬에 설치해 smoke를 바로 검증한다. 이 repo는 k6를 npm dependency로 추가하지 않는다.

```bash
brew install k6
k6 version
```

운영 API instance에 k6를 설치해서 자기 자신을 때리는 구조는 권장하지 않는다. Staging/release 부하는 CI 또는 별도 runner에서 `STRESS_TARGET_URL`을 지정해 실행한다.

## Local Artillery CLI

Realtime Socket.IO stress는 Artillery CLI를 외부 binary로 사용한다. 이 repo는 Artillery를 npm dependency로 추가하지 않는다.

```bash
npm install -g artillery@latest
artillery version
```

운영 API instance에 Artillery를 설치해서 자기 자신을 때리는 구조는 권장하지 않는다. Staging/release 부하는 CI 또는 별도 runner에서 실행한다.

## Authenticated fixture flow

```bash
# 1) 안전한 dry-run 계획 확인
pnpm --dir apps/api stress:fixture:plan
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:fixture:seed

# 2) local/staging 전용 실제 seed/reset/token. production target에서는 실패한다.
STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
pnpm --dir apps/api stress:fixture:seed

STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
STRESS_TOKEN_ACTOR_LIMIT=32 \
pnpm --dir apps/api stress:fixture:tokens

STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
pnpm --dir apps/api stress:fixture:reset
```

`stress:fixture:tokens`는 `/auth/login`을 호출해 access token artifact를 만들며, 파일은 `.tmp-*` local artifact로 git에 포함하지 않는다.

## Commands

```bash
pnpm --dir apps/api stress:fixture:plan
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:fixture:seed
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:fixture:reset

STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:http:smoke
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:baseline
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:peak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:spike
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:soak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:score-cohort
STRESS_TARGET_URL=http://127.0.0.1:4000 STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json pnpm --dir apps/api stress:realtime:smoke
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json pnpm --dir apps/api stress:realtime:baseline
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json pnpm --dir apps/api stress:realtime:peak
```

`stress:fixture:seed`와 `stress:fixture:reset`은 기본값에서는 DB를 변경하지 않고 guarded dry-run summary만 출력한다. 인증 기반 mix를 실행하려면 local/staging DB에 fixture를 seed하고 `stress:fixture:tokens`로 만든 artifact 경로를 `STRESS_ACTOR_TOKENS_PATH`에 지정한다. `stress:http:*`는 `k6` CLI가 설치되어 있어야 실행되며, summary-export 결과를 safe report로 변환한다. `stress:realtime:*`는 Artillery CLI와 actor token artifact가 있어야 실행되며, Socket.IO ticket/subscribe 결과를 safe report로 변환한다.
