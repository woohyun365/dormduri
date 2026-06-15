# API stress fixture and safety guard

`apps/api/test/stress`는 k6/Artillery 부하 테스트가 사용할 **로컬/스테이징 전용 fixture 기반**을 둔다. 제품 API 런타임 코드와 분리된 테스트 도구이며, production target이나 production DB에 실수로 실행되지 않도록 fail-closed guard를 먼저 통과해야 한다.

## 구조

```txt
apps/api/test/stress/
  env.example
  fixtures/
    stress-fixture.config.ts      # cohort size, prefix, campus/season defaults
    stress-fixture.plan.ts        # deterministic actor/dormitory/cohort plan + safe summary
    seed-stress-fixture.ts        # target guard 통과 후 dry-run seed summary
    reset-stress-fixture.ts       # target guard 통과 후 marker-only reset dry-run summary
  safety/
    stress-target.guard.ts        # local/staging/production override guard
    stress-secret-redaction.ts    # report/log secret redaction helper
```

Phase 5의 seed/reset runner는 **dry-run skeleton**이다. Prisma write/delete 연결은 후속 stress runtime phase에서 같은 guard와 marker-only scope 뒤에 붙인다.

## Target guard

필수/주요 env:

- `STRESS_TARGET_URL`: seed/reset/stress 실행 대상 API URL. `http://127.0.0.1:4000`처럼 명시한다.
- `STRESS_ENV`: `local`, `staging`, `production`. 기본값은 `local`이다.
- `STRESS_ALLOWED_HOSTS`: 쉼표/공백 구분 allowlist. 스테이징 host는 여기에 명시한다.
- `STRESS_ALLOW_PRODUCTION`: production-like host 또는 `NODE_ENV=production` 실행은 `I_UNDERSTAND` 값 없이는 실패한다.

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

## Commands

```bash
pnpm --dir apps/api stress:fixture:plan
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:fixture:seed
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:fixture:reset
```

`stress:fixture:seed`와 `stress:fixture:reset`은 Phase 5에서는 DB를 변경하지 않고 guarded dry-run summary만 출력한다.
