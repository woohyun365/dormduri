# Runtime composition and process state

이 문서는 현재 API process의 serving/background 구성과 process-local state의 책임·한계를 설명한다. Host 배치와 ingress
정책은 [Production runtime topology](../platform/production-runtime-topology.md), 배포 후보는
[Deploy owner](../../../infra/deploy/README.md)가 소유한다. 코드 구성은 실제 배포·capacity·multi-instance 안전성의 증거가 아니다.

## Current combined runtime

[main.ts](../../../apps/api/src/main.ts)는 하나의 `NestFactory.create(AppModule)` application을 만들고 같은 DI settings로
HTTP와 `ChatRealtimeIoAdapter`를 구성한 뒤 listen한다. [AppModule](../../../apps/api/src/app.module.ts)은
`ScheduleModule`, `AuthModule`, `ChatModule`, `LifecycleModule`을 함께 조합한다.

```text
one API process / AppModule
  ├── HTTP + Socket.IO serving
  ├── LifecycleSweepService: enabled periodic/boundary sweeps
  ├── AuthMailDispatcherService: enabled mail outbox dispatch
  ├── ChatRealtimeDispatcherService: enabled local fanout dispatch
  ├── NotificationOutboxDispatcherService: enabled local fanout dispatch
  └── purpose-specific local admission/state
```

[API Compose](../../../infra/deploy/compose.api.yml)와
[ingress trust overlay](../../../infra/deploy/compose.ingress-trust.yml)는 별도 worker가 아닌 하나의 API service를 대상으로 한다.
현재 headless worker capability는 **NO-GO**다. WorkerModule, 별도 worker entrypoint/binary, runtime-role selector는 없다.
Combined는 설명 용어이며 새 enum·환경변수·Boolean role matrix를 추가하는 설계가 아니다.

### Owner-local enable switches

| Owner                      | 설정과 기본값                                                                                    | 적용 범위                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Lifecycle                  | `LIFECYCLE_SWEEP_ENABLED`: test=false, 그 외=true; interval은 production=300000ms, 그 외=60000ms | 이 API instance의 bootstrap automatic sweep과 schedule 등록                                      |
| Auth mail                  | `AUTH_MAIL_DISPATCHER_ENABLED`: true; interval=1000ms                                            | 이 API instance의 mail dispatch timer; test 환경에서도 기본 true이므로 fixture가 명시적으로 제어 |
| Chat + notification outbox | `CHAT_REALTIME_DISPATCHER_ENABLED`: test=false, 그 외=true; interval=1000ms                      | 두 dispatcher의 자동 timer; notification용 독립 enable 환경변수는 없음                           |

기본값과 env override의 owner는 [lifecycle config](../../../apps/api/src/lifecycle/config/lifecycle.config.ts),
[auth config](../../../apps/api/src/auth/config/auth.config.ts),
[chat realtime config](../../../apps/api/src/chat/realtime/chat-realtime.config.ts)다. 설정은 bootstrap 시 읽은 값이며 여기서는
hot reload를 보장하지 않는다. 이 스위치를 끄는 것은 자동 실행을 끄는 것이지 manual entrypoint의 권한을 차단하거나
다른 process로 작업을 이전하는 것이 아니다. HTTP/Socket.IO serving을 없애는 스위치도 아니다.

[Chat provider composition](../../../apps/api/src/chat/composition/chat.providers.ts)은
`REALTIME_DISPATCHER_CONFIG_PORT`를 chat settings에, `REALTIME_USER_ROOM_PUBLISHER_PORT`를 `ChatRealtimePublisher`에 연결한다.
Notification은 기존 notification publisher adapter와 이 설정/관측 port를 사용한다. Owner가 다른 purpose-specific port는
유지하며, 이를 generic store/broker/event bus로 바꾸지 않는다.

### Workload affinity

| Background owner              | 현재 실행 위치                                                                                                             | 분리 판단의 경계                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle sweeps              | Combined API; [LifecycleModule](../../../apps/api/src/lifecycle/lifecycle.module.ts)이 8개 owner module과 11개 task를 조합 | 일부 task가 미래 후보일 수 있지만 현재 graph를 그대로 headless app에 복제하는 것은 narrow worker capability가 아님         |
| Auth mail dispatcher          | Combined API의 auth owner; provider 호출은 기존 email sender가 소유                                                        | Local Socket.IO binding은 필요 없지만 named workload/value, secret/pool graph와 retry/shutdown 검증 전 분리하지 않음       |
| Chat/notification dispatchers | Gateway가 publisher를 bind한 serving process                                                                               | **Serving-affine**: 미결합 publisher에서는 claim 전 `PUBLISHER_UNBOUND`로 skip; live client가 없는 process로 이동하지 않음 |

## Process-local state inventory

컨테이너가 `Map`인지보다 그 상태가 제공하는 semantic과 scope가 우선이다. 아래 내용은 현재 source의 책임 계약이며
모든 경쟁 조건이 테스트됐다는 뜻은 아니다. Service instance, adapter closure, module singleton을 같은 reset 경계로
취급하지 않는다.

| Owner / source                                                                                                             | Semantic                                                            | Correctness scope                                                          | Failure/reset implication                                                                             | Scale trigger                                                            | Multi-instance limitation                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [ChatRealtimeTicketService](../../../apps/api/src/chat/realtime/chat-realtime-ticket.service.ts)                           | TTL authentication ticket, async actor 재검증 전에 consume/delete   | 하나의 service instance; 실패한 재검증도 ticket을 복원하지 않음            | Restart/새 instance는 outstanding ticket을 잃음                                                       | 승인된 multi-serving 또는 명시된 restart-loss 허용 한계 위반             | 다른 instance/process에서 발급 ticket을 consume할 수 없음                        |
| [ChatRealtimeRateLimiterService.buckets](../../../apps/api/src/chat/realtime/chat-realtime-rate-limiter.service.ts)        | 모든 bucket을 검사한 뒤 함께 소비하는 local abuse quota             | instance 안의 user/pair/IP/socket key별 window                             | Restart/reset은 quota와 window를 초기화                                                               | Cross-instance quota consistency 요구                                    | Serving instance끼리 budget을 공유하지 않음                                      |
| [userSocketCounts / gateway registration](../../../apps/api/src/chat/realtime/chat-realtime.gateway.ts)                    | user별 local admission count와 같은 socket의 등록 해제 bookkeeping  | limiter instance의 userId counter, gateway의 registeredRealtimeUserId      | Restart 시 count 소실; userId-only decrement는 socket identity를 판별하지 못함                        | 승인된 multi-serving 또는 전역 concurrent admission 계약                 | Cluster-wide socket cap이나 counter 자체의 duplicate-socket idempotence는 없음   |
| [ChatRealtimeIoAdapter pre-auth closure](../../../apps/api/src/chat/realtime/chat-realtime-io.adapter.ts)                  | Root Engine.IO에서 auth 이전 IP admission                           | adapter가 만든 limiter closure; DI에서 받은 동일 origin/proxy settings     | 새 closure를 만들면 budget reset                                                                      | Cross-root/instance abuse correctness 또는 sticky 의존 발생              | 다른 adapter/process와 quota를 공유하지 않음; gateway service의 bucket과도 별개  |
| [ChatRealtimePublisher](../../../apps/api/src/chat/realtime/chat-realtime-publisher.ts)                                    | Bound local Socket.IO user/thread-room fanout                       | gateway afterInit이 결합한 publisher instance                              | 새 instance는 unbound; local emit 성공은 client receipt가 아님                                        | 측정된 fanout/isolation 필요 또는 multiple serving 승인                  | 다른 process의 client room을 직접 fanout하지 못함                                |
| [AuthMailDispatcherService](../../../apps/api/src/auth/mail/auth-mail-dispatcher.service.ts)                               | running suppression, periodic timer                                 | 같은 dispatcher instance의 dispatchOnce; DB claim/lease와 별도             | finally에서 running 해제; destroy는 timer 제거이지 active work drain이 아님                           | 측정된 mail lag/isolation 또는 stronger shutdown 요구                    | 다른 instance와 running flag를 공유하지 않으며 전체 exactly-once를 보장하지 않음 |
| [ChatRealtimeDispatcherService](../../../apps/api/src/chat/realtime/chat-realtime-dispatcher.service.ts)                   | running/timer와 local lastPrunedAt cadence                          | bound publisher를 가진 instance; prune 시각은 coordination lock이 아님     | Restart 시 flags/cadence 소실; destroy는 timer 제거                                                   | Outbox lag/fanout isolation, cross-instance execution 또는 shutdown 계약 | Running/prune budget은 공유되지 않으며 DB lease가 fanout routing을 해결하지 않음 |
| [NotificationOutboxDispatcherService](../../../apps/api/src/notifications/outbox/notification-dispatcher.service.ts)       | running suppression, timer, serving-affine publication              | notification dispatcher instance; 기존 chat-backed settings/port 사용      | Restart resets flags; timer 제거는 in-flight cancel/drain이 아님                                      | Notification lag/isolation 또는 multiple serving 요구                    | DB outbox가 durable해도 local publisher는 다른 process의 client를 소유하지 않음  |
| [LifecycleSweepService](../../../apps/api/src/lifecycle/lifecycle-sweep.service.ts)                                        | scheduled periodic/boundary overlap suppression, interval/cron 소유 | 같은 service의 scheduled entry만 보호; public/manual runner는 우회         | 새 instance는 상태 초기화; destroy는 closing 전환·timer 제거·pending refresh의 late registration 차단 | Multi-instance scheduler 또는 stronger shutdown 계약                     | Global singleton/DB lease가 아니며 manual·다른 instance 실행을 배제하지 않음     |
| [ProcessPasswordHashAdmission](../../../apps/api/src/auth/credentials/password-hashing/password-hash-admission.service.ts) | hash/verify CPU·memory admission과 bounded queue                    | module-level process singleton; Nest service들이 같은 instance를 configure | Restart resets queue/budget; 새 Nest service가 독립 budget을 만들지 않음                              | Admission saturation 또는 여러 process의 aggregate capacity 판단         | 각 process가 별도 budget을 가지므로 process 합산 CPU/memory 제한은 아님          |

Gateway의 admission registration과 [connected-socket gauge](../../../apps/api/src/chat/realtime/chat-realtime.metrics.ts)는
다른 상태다. Admission은 join 전에 등록하고 gauge는 await join 후 증가한다. Gateway는 socket별 counted 상태를
기록하고 disconnect에서 한 번만 소비하므로 중복·미계수 disconnect가 다른 연결의 gauge를 감소시키지 않는다.
Disconnect가 기록된 socket은 pending auth 성공 뒤 user quota/admission/join을 새로 진행하지 않고, pending join 뒤에도
gauge를 증가시키지 않는다. 이미 시작한 auth의 취소나 일반적인 join 실패의 정리까지 보장하는 것은 아니다.
Metric service 자체는 socket identity가 없는 instance-local 집계이며, 누적 connection counter와 bridge fail-open은 유지한다.

## Scheduling, shutdown and durable delivery

- [Lifecycle public/manual runner](../../../apps/api/src/lifecycle/lifecycle-sweep-runner.ts)는 scheduled-running guard를 거치지
  않는다. Scheduled overlap suppression을 모든 manual/task 실행의 mutex로 설명하지 않는다.
- Destroy hook은 현재 interval/cron을 제거한다. Lifecycle scheduler는 closing 상태를 확인하여 pending DB-time/schedule
  계산 뒤의 새 timer 등록과 종료 후 scheduled entry를 차단한다. 이미 진입한 sweep/dispatch의 drain/cancel은 보장하지
  않는다. Bootstrap의 shutdown hook 등록만으로 process 전체의 graceful drain을 보장하지 않는다.
- Durable outbox producer는 PostgreSQL transaction에 속한다. DB claim/lease/retry는 해당 row/task의 경계이고
  process-local running flag나 local Socket.IO fanout과 다르다. Claim 보호를 cluster-wide 모든 작업의 exactly-once로
  확대하지 않는다. Retention worker Prisma role도 credential boundary이지 별도 process가 아니다.
- Chat/notification의 publisher가 unbound면 DB claim 전에 skip한다. Bound publisher의 emit과 outbox published 기록은
  client receipt 또는 모든 serving instance에 대한 전송 완료를 보장하지 않는다. DB의 durable row가 local server binding을
  대신할 수 없다.
- 미래 broker 검토에서도 기본 producer 경로는 **domain transaction → PostgreSQL outbox → relay → consumers**다.
  Domain mutation에서 DB와 broker로 직접 dual-write하는 방식은 별도 atomicity 설계·증거 없이 채택하지 않는다.

## Revisit triggers

단순 사용자 수, framework 평판, dependency freshness, 미래 확장 가능성만으로 topology/dependency를 추가하지 않는다.
아래 trigger가 관측되면 current revision/config/workload와 evidence window, owner, bottleneck/failure, 대안,
correctness/security, 비용, migration/rehearsal/rollback, GO/NO-GO를 가진 bounded analysis/plan을 먼저 작성한다.

| 대상                           | 시작할 근거                                                                                      | 비교·검증 범위                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shared ephemeral state         | 승인된 multi-serving, cross-instance correctness, sticky 의존 또는 명시한 restart-loss 계약 위반 | 현 local state 유지, sticky, DB, managed shared state; ticket/auth/quota 의미별 failure와 consistency 비용                         |
| Broker / realtime process 분리 | 측정된 lag/throughput/fanout scaling·isolation·failure-domain 필요                               | PostgreSQL outbox polling, provider-managed pub/sub·broker, current local fanout; ordering/replay/idempotency/DLQ 요구             |
| Headless worker capability     | 안전하게 분리할 named workload와 관측 가능한 value                                               | 좁은 module/provider/secret graph, idempotency/lease/retry/shutdown/health, executable smoke, resource/pool 예상과 rehearsal owner |

Trigger 검토는 기술 도입·rehearsal·production activation 승인이 아니다. Worker capability를 승인하더라도 deployment target,
resource budget, release evidence는 infra owner가 별도로 검증한다. `LifecycleModule` 전체를 두 번째 Nest process로 띄우는
것이나 serving-affine dispatcher를 unbound worker로 옮기는 것은 현재 해법이 아니다.

## Verification ownership

- [Runtime architecture guard](../../../apps/api/test/architecture/platform/runtime-process-state-boundary.spec.ts): executable
  composition과 폐기한 worker 권고, 필수 상태 inventory의 정적 정합성. 자연어 전반이나 실제 배포 안전성을 증명하지 않는다.
- [Lifecycle owner](../../../apps/api/src/lifecycle/README.md): scheduler/adapter/task 경계와 대상별 검증 명령.
- State semantics는 각 owner의 기존 ticket/rate/pre-auth/publisher/dispatcher/lifecycle/hash-admission spec이 검증한다.
  미검증 동시성은 deterministic deferred/fake-clock regression으로 별도 확인하며 static documentation PASS로 대체하지 않는다.
