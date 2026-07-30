# HTTP stress scripts

`apps/api/test/stress/http`는 k6 CLI로 실행하는 HTTP/API stress scenario를 둔다. npm dependency를 추가하지 않고 외부 `k6` binary를 사용한다.

## 실행 전 조건

- API가 local/staging target에서 실행 중이어야 한다.
- `STRESS_TARGET_URL`은 필수다.
- public/production-like host는 `STRESS_ALLOWED_HOSTS` 또는 `STRESS_ALLOW_PRODUCTION=I_UNDERSTAND` 없이는 실패한다.
- 인증 기반 read/write mix는 `stress:fixture:seed`와 `stress:fixture:tokens`로 만든 local `.tmp-*` token artifact를 `STRESS_ACTOR_TOKENS_PATH`에 지정했을 때만 실행된다.
- write-heavy mix는 `STRESS_ENABLE_WRITE_MIX=true`를 추가로 지정한 local/staging 실행에서만 활성화한다. token artifact가 없으면 public smoke와 skip marker 중심으로 동작한다.

## Commands

```bash
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:http:smoke
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:baseline
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:peak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:spike
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:soak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:score-cohort
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:auth-login
```

인증 기반 mix를 실행할 때는 먼저 marker-only fixture를 만들고 actor token artifact를 생성한다.

```bash
STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
pnpm --dir apps/api stress:fixture:seed

STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
pnpm --dir apps/api stress:fixture:tokens

STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
STRESS_ENABLE_WRITE_MIX=true \
pnpm --dir apps/api stress:http:baseline
```

각 command는 `k6 run --summary-export ...` 실행 후 `parse-k6-summary.ts`로 p95/p99/error/check/threshold report를 출력한다. threshold 실패나 k6 non-zero exit은 command failure로 보존한다.

## Scenario matrix

| Command                    | 기본 profile  | 기본 duration/VU | 목적                                                           |
| -------------------------- | ------------- | ---------------- | -------------------------------------------------------------- |
| `stress:http:smoke`        | local/staging | 1m / 5 VUs       | `/health`, `/health/ready`, `/api/seasons/current` 최소 생존성 |
| `stress:http:baseline`     | staging       | 10m / 250 VUs    | 250 concurrent equivalent read baseline                        |
| `stress:http:peak`         | staging       | 15m / 500 VUs    | 500 peak latency/error budget                                  |
| `stress:http:spike`        | staging       | 0→500 ramp       | spike/recovery failure budget                                  |
| `stress:http:soak`         | staging       | 30m / 250 VUs    | 장시간 steady degradation 관찰                                 |
| `stress:http:score-cohort` | staging       | 10m / 237 VUs    | 946 score cohort search/read path gate                         |
| `stress:http:auth-login`   | staging       | 2m / 10 VUs      | 실제/미존재 계정 Argon2id verify와 login 응답 안정성           |

local smoke를 짧게 돌릴 때는 `STRESS_SMOKE_DURATION=10s STRESS_SMOKE_VUS=1`처럼 override한다.

`stress:http:auth-login`은 seed된 actor의 올바른 비밀번호와 존재하지 않는 계정의 dummy verify를 1:1로 섞는다. 기본 10 VU는 2 vCPU API 후보 스펙에서 먼저 안전한 경향을 확인하기 위한 시작점이며, 25 VU까지 단계적으로 올린 뒤 p95 1.5초·p99 3초·check 99% 기준을 확인한다. 19MiB Argon2id 최종 승격 판단은 password capacity plan의 별도 stress gate가 소유한다.
