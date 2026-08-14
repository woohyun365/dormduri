# Web Sentry managed observability runbook

## 범위와 owner

Sentry는 Web browser runtime error, unexpected Next.js server/edge exception, sampled performance를 소유한다. BFF outcome·latency·request correlation은 Sentry가 아니라 container stdout → Alloy → Loki → Grafana가 소유한다. 제품 funnel, Session Replay, DOM autocapture, 사용자 식별은 수집하지 않는다.

## Account-free 구현 검증

외부 계정·DSN·token 없이 다음 명령을 실행한다.

```bash
pnpm web:sentry:rehearsal
```

이 검증은 다음을 확인한다.

- client/node/edge 설정 선택과 production evidence gate
- privacy scrub, 같은 Error 중복 방지, provider rejection fail-open
- performance 0/10%/100% sampling과 bounded route group
- Sentry SDK 외부 feature import 금지
- upload-disabled production build와 public source map 부재
- Storybook 정적 산출물에 외부 Sentry intake 설정이 없는 상태
- Docker Engine 2CPU/4GB envelope 정보와 local resource snapshot

이 결과는 managed intake나 source-map symbolication 성공을 의미하지 않는다.

### 현재 local baseline

- 기준 commit `95b976b6` client static JS: raw `2,229,123B`, gzip `634,355B`
- Sentry 구현 working tree: raw `2,462,664B`, gzip `706,948B`
- 변화: raw `+233,541B` (`+10.48%`), gzip `+72,593B` (`+11.44%`)
- OrbStack 2CPU/4GB rehearsal: `30.14s`, focused 57 tests와 build·Storybook·standalone smoke 통과

이 값은 전체 `.next/static` JS 합계이며 특정 route의 initial transfer 크기와 같지 않다. Managed performance sample은 초기 10%로 시작하고 quota 압박이나 INP regression이 확인되면 performance sample을 먼저 낮춘다.

## Production public 설정

| 설정                                           |          기본 | 책임                              |
| ---------------------------------------------- | ------------: | --------------------------------- |
| `NEXT_PUBLIC_SENTRY_ENABLED`                   |           `0` | managed capture master switch     |
| `NEXT_PUBLIC_SENTRY_DSN`                       |          없음 | public ingest DSN. secret이 아님  |
| `NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED`    |           `1` | runtime exception kill switch     |
| `NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED`       |           `1` | performance kill switch           |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`        |         `0.1` | production initial trace sample   |
| `NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED`          |           `0` | repo privacy review evidence gate |
| `NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED` |           `0` | account/release evidence gate     |
| `NEXT_PUBLIC_WEB_RELEASE`                      | `development` | immutable release ID              |
| `NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT`    |       `local` | local/preview/production          |

`NEXT_PUBLIC_SENTRY_LOCAL_RECORDING`과 `NEXT_PUBLIC_SENTRY_RECORDING_TRANSPORT_REJECT`는 test/rehearsal 전용이며 production에서 사용하지 않는다.

## Build·CI secret 경계

| 설정                               | 공개 여부         | 규칙                                          |
| ---------------------------------- | ----------------- | --------------------------------------------- |
| `SENTRY_SOURCE_MAP_UPLOAD_ENABLED` | server/build only | 명시적 opt-in                                 |
| `SENTRY_RELEASE_EVIDENCE_APPROVED` | server/build only | managed release evidence 완료 후 `1`          |
| `SENTRY_ORG`, `SENTRY_PROJECT`     | server/build only | project identifier                            |
| `SENTRY_AUTH_TOKEN`                | secret            | 최소 release upload scope, CI secret로만 주입 |
| `SENTRY_RELEASE`                   | server/build only | client/server/map과 동일한 immutable ID       |

`SENTRY_AUTH_TOKEN`은 `NEXT_PUBLIC_*`, Docker build ARG, image ENV, log, evidence 파일에 넣지 않는다. Upload gate가 닫히면 browser source map을 생성하지 않는다. Gate가 열리면 build 단계에서 provider에 업로드한 뒤 local/public artifact를 삭제한다.

## Managed release evidence

이 문서는 현재 구현과 운영 경계를 설명한다. 미래 배포 세션은 먼저 [web-sentry-managed-release-readiness.md](../../release/components/web-sentry/readiness.md)에서 사용자 준비물과 실행 순서를 확인하고, 실제 검증 결과는 [web-sentry-managed-release-evidence.md](../../release/components/web-sentry/evidence.md)에 secret-free evidence로 남긴다.

배포 target이 없는 현재 상태는 `PENDING_RELEASE`이며 구현 실패를 의미하지 않는다. 최초 production enable 전에 다음 항목을 실제 환경에서 확인한다.

1. account/project region, retention, DPA/subprocessor
2. operator role, 2FA, token owner·rotation
3. provider-side IP/data scrub, no Replay, no user identity
4. client/server synthetic event ID와 release/environment/routeGroup
5. source-map symbolication의 원본 file/line 확인
6. performance sample과 quota/alert 기준
7. kill switch, provider outage fail-open
8. CSP와 배포 target secret injection

실제 DSN 전체 값, auth token, raw event payload, 사용자 데이터는 evidence에 기록하지 않는다. 이 evidence가 없으면 `NEXT_PUBLIC_SENTRY_ENABLED`와 source-map upload를 production에서 켜지 않는다. Repository handoff 완료를 managed release 성공으로 표현하지 않는다.

## Incident와 비활성화

1. 개인정보가 발견되면 runtime/performance master switch를 끄고 provider ingest·access·delete 절차를 시작한다.
2. provider 장애면 kill switch를 적용하되 Web navigation·form·BFF 동작이 유지되는지 확인한다.
3. 특정 release에서만 오류가 증가하면 release 기준으로 범위를 좁히고 rollback을 검토한다.
4. quota 압박 시 performance sample부터 낮추며 runtime exception owner는 유지한다.
