# HTTP stress scripts

`apps/api/test/stress/http`는 k6 CLI로 실행하는 HTTP/API stress scenario를 둔다. npm dependency를 추가하지 않고 외부 `k6` binary를 사용한다.

## 실행 전 조건

- API가 local/staging target에서 실행 중이어야 한다.
- `STRESS_TARGET_URL`은 필수다.
- public/production-like host는 `STRESS_ALLOWED_HOSTS` 또는 `STRESS_ALLOW_PRODUCTION=I_UNDERSTAND` 없이는 실패한다.
- write-heavy mix는 실제 fixture seed integration 전까지 `STRESS_ENABLE_WRITE_MIX=true`를 주더라도 no-op/skip marker만 남긴다.

## Commands

```bash
STRESS_TARGET_URL=http://127.0.0.1:4000 pnpm --dir apps/api stress:http:smoke
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:baseline
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:peak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:spike
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:soak
STRESS_TARGET_URL=https://staging.example.internal STRESS_ALLOWED_HOSTS=staging.example.internal pnpm --dir apps/api stress:http:score-cohort
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

local smoke를 짧게 돌릴 때는 `STRESS_SMOKE_DURATION=10s STRESS_SMOKE_VUS=1`처럼 override한다.
