# Web Sentry managed release evidence

## 사용 방법

이 문서는 실제 release마다 채우는 secret-free evidence template이다. 배포 준비와 실행 순서는 먼저 [web-sentry-managed-release-readiness.md](./readiness.md)를 따른다.

완료된 component 결과는
[production-release-evidence.md](../../production-release-evidence.md)에 연결한다. 이 문서는 전체
release의 최종 `GO`를 선언하지 않는다.

아직 Sentry account나 배포 target이 준비되지 않았다면 빈 필드는 실패가 아니다. 상태를 `PENDING_TARGET`로 유지하고 임의 값을 채우지 않는다.

## 현재 상태

| Field              | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| Status             | `PENDING_TARGET`                                                    |
| Reason             | Managed Sentry account/project와 deploy target이 아직 결정되지 않음 |
| Release            |                                                                     |
| Environment        |                                                                     |
| Operator           |                                                                     |
| Evidence timestamp |                                                                     |

허용 component 상태는 `PENDING_TARGET`, `READY_FOR_VALIDATION`, `PASS`, `FAIL`,
`ACCEPTED_RISK`다.

## 사용자 준비물 확인

| Check                                            | Evidence identifier | Decision |
| ------------------------------------------------ | ------------------- | -------- |
| Sentry organization과 Web project 생성 권한      |                     | Pending  |
| 실제 선택된 project region                       |                     | Pending  |
| 실제 적용되는 retention                          |                     | Pending  |
| DPA/subprocessor 검토 책임자                     |                     | Pending  |
| 운영자 role과 2FA                                |                     | Pending  |
| token 발급·rotation·폐기 책임자                  |                     | Pending  |
| Preview/Production hosting target과 HTTPS domain |                     | Pending  |
| 보호된 CI secret 주입 위치                       |                     | Pending  |
| Immutable release 기준                           |                     | Pending  |

## Account·privacy evidence

| Check            | 확인 위치                       | 합격 기준                 | Evidence identifier | Decision |
| ---------------- | ------------------------------- | ------------------------- | ------------------- | -------- |
| Project region   | Sentry account/project settings | 선택된 실제 region 기록   |                     | Pending  |
| Retention        | Sentry plan/project settings    | 실제 보존 기간 기록       |                     | Pending  |
| Operator access  | Organization member settings    | 최소 권한과 2FA 확인      |                     | Pending  |
| IP storage/scrub | Project privacy settings        | 저장 또는 scrub 결정 기록 |                     | Pending  |
| Data scrub       | Project privacy settings        | 금지 field scrub 확인     |                     | Pending  |
| Session Replay   | Project/SDK settings            | 비활성화                  |                     | Pending  |
| User identity    | Managed event inspection        | identity 미수집           |                     | Pending  |

## Release·artifact evidence

| Check                      | 확인 위치/명령                 | 합격 기준              | Evidence identifier | Decision |
| -------------------------- | ------------------------------ | ---------------------- | ------------------- | -------- |
| Public/server release 일치 | CI env identifier              | 같은 immutable release |                     | Pending  |
| Source-map upload          | CI/Sentry release artifact     | upload 성공            |                     | Pending  |
| Public source map          | `pnpm web:sentry:verify-build` | `.map` 0건             |                     | Pending  |
| CI secret boundary         | artifact/image/log scan        | token·sentinel 0건     |                     | Pending  |
| CSP                        | deployed response header       | ingest origin만 허용   |                     | Pending  |

## Managed intake evidence

| Check                      | 합격 기준                                   | Evidence identifier | Decision |
| -------------------------- | ------------------------------------------- | ------------------- | -------- |
| Client synthetic exception | release/environment/routeGroup으로 1건 조회 |                     | Pending  |
| Server synthetic exception | 동일 release에서 1건 조회                   |                     | Pending  |
| Performance sample         | bounded route/device와 Core Web Vitals 조회 |                     | Pending  |
| Source-map symbolication   | 원본 file/line 확인                         |                     | Pending  |
| Duplicate prevention       | 같은 Error의 불필요한 중복 없음             |                     | Pending  |
| Privacy negative search    | email/token/body/query 등 0건               |                     | Pending  |

## Fail-open·operation evidence

| Check                   | 합격 기준                          | Evidence identifier | Decision |
| ----------------------- | ---------------------------------- | ------------------- | -------- |
| Runtime kill switch     | 사용자 navigation·mutation 정상    |                     | Pending  |
| Performance kill switch | Runtime Error owner 유지           |                     | Pending  |
| Provider failure        | 사용자 flow 정상                   |                     | Pending  |
| Quota alert owner       | 운영 책임자 기록                   |                     | Pending  |
| Token rotation owner    | 운영 책임자 기록                   |                     | Pending  |
| Incident owner          | 개인정보·provider 장애 책임자 기록 |                     | Pending  |

## Owner 분리 evidence

| Check                             | 합격 기준               | Evidence identifier | Decision |
| --------------------------------- | ----------------------- | ------------------- | -------- |
| Browser/Next unexpected exception | Sentry에서만 조회       |                     | Pending  |
| Sampled browser performance       | Sentry에서만 조회       |                     | Pending  |
| Expected BFF outcome·latency      | Loki/Grafana에서만 조회 |                     | Pending  |
| Product funnel                    | Sentry에 수집하지 않음  |                     | Pending  |

## Component 결과

```txt
component_result: PENDING_TARGET
blocking_failures:
accepted_follow_ups:
operator:
evidence_timestamp:
```

### 판정 규칙

- 외부 준비물이 없는 상태에서는 `PENDING_TARGET`를 유지한다.
- 준비물은 있으나 managed smoke 전이면 `READY_FOR_VALIDATION`이다.
- 필수 managed intake, privacy, symbolication, secret boundary가 모두 통과해야 `PASS`다.
- 실제 검증에서 필수 항목이 실패하면 `FAIL`이다.
- 필수 안전 경계는 통과했으나 비차단 후속 조치가 있으면 `ACCEPTED_RISK`와 owner·기한을 함께 기록한다.
- 전체 release의 최종 판정은 aggregate evidence에 component 결과를 연결한 뒤 수행한다.
- DSN 전체 값, auth token, raw event payload, 실제 사용자 데이터는 기록하지 않는다.
