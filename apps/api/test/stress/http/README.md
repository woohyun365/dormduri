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
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:auth-recovery
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal STRESS_AUTH_CAPACITY_ARTIFACT_PATH=/absolute/path/to/.tmp-auth-password-capacity.json STRESS_AUTH_CAPACITY_PROFILE=h1 pnpm --dir apps/api stress:http:auth-password-capacity
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

| Command                              | 기본 profile    | 기본 duration/VU   | 목적                                                           |
| ------------------------------------ | --------------- | ------------------ | -------------------------------------------------------------- |
| `stress:http:smoke`                  | local/staging   | 1m / 5 VUs         | `/health`, `/health/ready`, `/api/seasons/current` 최소 생존성 |
| `stress:http:baseline`               | staging         | 10m / 250 VUs      | 250 concurrent equivalent read baseline                        |
| `stress:http:peak`                   | staging         | 15m / 500 VUs      | 500 peak latency/error budget                                  |
| `stress:http:spike`                  | staging         | 0→500 ramp         | spike/recovery failure budget                                  |
| `stress:http:soak`                   | staging         | 30m / 250 VUs      | 장시간 steady degradation 관찰                                 |
| `stress:http:score-cohort`           | staging         | 10m / 237 VUs      | 946 score cohort search/read path gate                         |
| `stress:http:auth-login`             | staging         | 2m / 10 VUs        | 실제/미존재 계정 Argon2id verify와 login 응답 안정성           |
| `stress:http:auth-recovery`          | staging         | 2m / 2 RPS         | reset neutral request·invalid code·throttle abuse 경계         |
| `stress:http:auth-password-capacity` | production-like | H1~H9 arrival-rate | 실제 login/signup/reset/change 19MiB endpoint capacity gate    |

local smoke를 짧게 돌릴 때는 `STRESS_SMOKE_DURATION=10s STRESS_SMOKE_VUS=1`처럼 override한다.

`stress:http:auth-login`은 seed된 actor의 올바른 비밀번호와 존재하지 않는 계정의 dummy verify를 1:1로 섞는다. 기본 10 VU는 2 vCPU API 후보 스펙에서 먼저 안전한 경향을 확인하기 위한 시작점이며, 25 VU까지 단계적으로 올린 뒤 p95 1.5초·p99 3초·check 99% 기준을 확인한다. 19MiB Argon2id 최종 승격 판단은 password capacity plan의 별도 stress gate가 소유한다.

`stress:http:auth-recovery`는 실제 계정이나 메일 발송을 만들지 않는 학교 이메일 형식의 미존재 subject를 사용한다. 동일 subject/IP, 여러 subject가 하나의 campus NAT IP를 공유하는 정상 흐름, 분산 subject/IP를 섞어 public neutral response, verify throttle, 5xx 부재와 응답 내 email/code 비노출을 확인한다. 기본 release rate에서 campus NAT 흐름에 429가 발생하면 실패한다. 유효 grant single-use와 outbox worker claim 경쟁은 PostgreSQL auth integration lane이 담당한다.

`stress:http:auth-password-capacity`는 fixture runner가 만든 ignored credential artifact를 요구한다. 기본 mix는 login success 80%, 기존 계정 login failure 15%, signup 3%, reset 1.5%, change 0.5%이며 H6/H7/H8/H9는 목적별 mix를 별도로 사용한다. H9는 동일 계정/IP 실패와 분산 계정/IP 실패를 교차 실행한다. 이 script는 artifact를 만들거나 DB를 정리하지 않으므로 직접 실행보다 Docker capacity runner 사용을 우선한다.
