# Background job metrics

이 문서는 `apps/api/src/background-jobs`가 소유하는 공통 정리 작업 metric 경계를 설명한다. 사용자 API instance
하나에서 도는 예약 작업(정리 sweep, outbox dispatcher)이 멈추거나 계속 실패하는 것을 경보 규칙 하나로 보기 위한
leaf module이다.

## Public boundary

- `BackgroundJobsModule`: metric definition 등록과 `BackgroundJobMetricsService` export.
- `BackgroundJobMetricsService.recordSucceeded(job)`, `recordFailed(job)`: 작업 owner가 예약 실행 결과를 기록한다.
- `runBackgroundJobTick(metrics, job, tick)`: interval tick 하나를 실행하고 결과를 기록한다. 던진 실패는 다시 던져
  호출부의 기존 log가 그대로 남는다. owner가 log를 남기고 이어 간 단계 실패는 `failed`로 돌려 실패 수만 올린다(chat
  realtime의 replay window prune). 일부러 일하지 않은 tick(이미 실행 중, publisher 미연결)은 `skipped`로 돌려 아무것도
  기록하지 않는다.
- `drainBackgroundJob(work, timeoutMs)`: 종료 hook이 실행 중인 예약 작업을 `timeoutMs`까지 기다린다. 작업이 성공하든
  실패하든 상한 안에 끝나면 `true`, 상한이 먼저 오면 `false`이고 작업 자체는 취소하지 않는다. 정리 sweep(20초)과 table
  통계 읽기(5초)가 쓴다.

## Metric

| 이름                                                | 종류    | label | 뜻                                    |
| --------------------------------------------------- | ------- | ----- | ------------------------------------- |
| `api_background_job_last_success_timestamp_seconds` | gauge   | `job` | 마지막으로 성공한 예약 실행의 Unix 초 |
| `api_background_job_failures_total`                 | counter | `job` | 실패한 예약 실행 수                   |

`job` 값은 고정된 다섯이다.

| `job`                      | owner                                                     | 한 번의 실행                                           |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `lifecycle_sweep`          | `lifecycle/lifecycle-sweep.service.ts`                    | 주기·경계 sweep 한 번(task 전체)                       |
| `auth_mail_dispatcher`     | `auth/mail/auth-mail-dispatcher.service.ts`               | dispatch tick 한 번                                    |
| `notification_dispatcher`  | `notifications/outbox/notification-dispatcher.service.ts` | dispatch tick 한 번                                    |
| `chat_realtime_dispatcher` | `chat/realtime/chat-realtime-dispatcher.service.ts`       | dispatch와 replay window prune tick(prune 실패도 실패) |
| `database_table_stats`     | `platform/database/database-table-stats.service.ts`       | watched table 통계 읽기와 gauge 갱신 한 번             |

경보 규칙(마지막 성공이 작업 주기보다 오래 멈춤, 실패 수 증가)은 observability 경보 owner가 이 두 metric으로 만든다.
작업별 결과 metric(처리 건수, lag, dispatch outcome)은 각 owner에 남는다. 실행 안 항목 하나의 실패(RRPD 검토 job 하나가
재시도·수동 검토로 넘어감, event 하나의 dispatch 실패)는 실행 실패가 아니고 그 owner의 record 상태와 metric이 맡는다.

## Hard rules

- 이 module은 제품 module을 import하지 않는다. 작업 owner가 이 module을 import한다(LifecycleModule이 작업 owner를
  import하므로 반대 방향은 순환이 된다).
- label에 user, thread, event id나 오류 문구를 넣지 않는다. 새 작업은 `BackgroundJobName`에 값을 더하고 이 표를 고친다.
- 수동 실행(`dispatchOnce`, `runSweep` 직접 호출, test)은 기록하지 않는다. 기록은 예약 실행만 한다.
- metric bridge 오류는 작업 결과에 영향을 주지 않는다(`recordDomainMetricSafely`).

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/background-jobs \
  src/lifecycle/lifecycle-sweep.service.spec.ts \
  test/architecture/platform/metric-definition-ownership.spec.ts
pnpm exec prettier --check apps/api/src/background-jobs/README.md
```
