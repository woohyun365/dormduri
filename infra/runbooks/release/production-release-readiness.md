# Production release readiness

## 책임과 현재 상태

이 문서는 미래 production release를 시작하는 단일 진입점이다. 준비 입력과 실행 순서를
소유하지만 실제 결과나 최종 `GO` 판정을 소유하지 않는다.

- Repository handoff: `READY`
- Release target: `PENDING_TARGET`
- Final decision owner:
  [production-release-evidence.md](./production-release-evidence.md)

`PENDING_TARGET`는 실패나 repository blocker가 아니다. Provider, account, domain, registry처럼
실제 배포 시점에만 정할 수 있는 입력이 아직 없다는 뜻이다.

## 미래 배포 담당자와 Codex의 읽기 순서

1. 이 문서에서 필수 입력과 중단 조건을 확인한다.
2. [Infrastructure target readiness](./components/infrastructure-target-release-readiness.md)에서
   hosting, registry, ingress, observability backup 입력을 닫는다.
3. [Observability collector readiness](./components/observability-collector-release-readiness.md)에서
   Alloy Docker socket 유지 여부와 대체 수집 방식을 결정한다.
4. 아래 component owner의 readiness와 실행 runbook을 따른다.
5. 각 component evidence를 실제 값으로 채운다. Secret 원문은 기록하지 않는다.
6. 모든 component 결과를
   [production-release-evidence.md](./production-release-evidence.md)에 연결하고 한 번만 최종 판정한다.

## 사용자에게 받아야 하는 입력

| 범위               | 필요한 입력                                                                    |
| ------------------ | ------------------------------------------------------------------------------ |
| Hosting            | provider, region, User App 4GiB topology, 월 예산, 운영자 접근 경계            |
| Database           | PostgreSQL 18 target, private network, backup/PITR, migration owner            |
| Registry           | registry, publish principal, pull principal, retention, attestation 검증 방식  |
| Public ingress     | canonical Web/API host, DNS owner, TLS 발급·갱신 owner, reverse proxy topology |
| Observability      | 운영 접근 경로, disk budget, retention, backup 또는 허용 손실, alert route     |
| External providers | SES, Sentry, Slack account/project/channel과 최소 권한 owner                   |
| Release control    | release operator, risk owner, rollback owner, previous safe digest             |

값을 추측하거나 임의의 cloud resource를 만들지 않는다. 입력이 없으면 해당 component를
`PENDING_TARGET`로 유지한다.

## Mandatory component owners

| Component                                     | Readiness / 실행 owner                                                                           | Actual evidence owner                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Hosting·registry·ingress·observability backup | [Infrastructure target readiness](./components/infrastructure-target-release-readiness.md)       | [Infrastructure target evidence](./components/infrastructure-target-release-evidence.md)     |
| Log collector trust boundary                  | [Observability collector readiness](./components/observability-collector-release-readiness.md)   | [Observability collector evidence](./components/observability-collector-release-evidence.md) |
| Collector incident·migration                  | [Collector troubleshooting](../incidents/observability-collector-troubleshooting.md)             | 해당 incident record와 collector evidence                                                    |
| Web Sentry                                    | [Sentry readiness](../web-sentry-managed-release-readiness.md)                                   | [Sentry evidence](../web-sentry-managed-release-evidence.md)                                 |
| Database backup·restore                       | [Backup/restore drill](../backup-restore-drill.md)                                               | drill evidence identifier                                                                    |
| Prometheus·Loki·Grafana·Alertmanager          | [Observability operations](../observability-production-operations.md)                            | target evidence와 dashboard/alert evidence identifier                                        |
| Password Reset                                | [Password Reset evidence](../auth-password-reset-release-evidence.md)                            | 같은 문서의 release별 결과                                                                   |
| Signup·credential lifecycle                   | [Credential lifecycle evidence](../auth-registration-credential-release-evidence.md)             | 같은 문서의 release별 결과                                                                   |
| Stress·capacity                               | [API stress release runbook](../../../docs/runbooks/observability/api-stress-release-runbook.md) | secret-free stress artifact identifier                                                       |
| Slack alert route                             | [Slack alert runbook](../../../docs/runbooks/observability/slack-alert-runbook.md)               | delivery smoke identifier                                                                    |
| Rollback                                      | [Incident rollback guide](../incident-rollback.md)                                               | previous digest와 target rehearsal identifier                                                |
| Future BackOffice                             | [BackOffice deployment handoff](./components/backoffice-deployment-readiness.md)                 | BackOffice 구현 후 별도 component evidence owner 추가                                        |

## Repository baseline 재검증

```bash
pnpm infra:check
pnpm api:check
pnpm api:build
pnpm web:check
pnpm web:build
```

실제 target에서는 component runbook에 있는 migration, role grant, restore, ingress, health,
metrics, log, alert, managed provider smoke를 별도로 수행한다. Local rehearsal 결과를 target
evidence로 복사하지 않는다.

## 중단 조건

다음 조건에서는 배포 실행을 멈추고 aggregate evidence를 `BLOCKED`로 둔다.

- release SHA와 immutable image digest의 연결을 증명할 수 없다.
- production secret 원문이 artifact, image, log, evidence에 노출된다.
- target network, TLS, DB backup/restore, rollback owner 중 하나가 결정되지 않았다.
- migration, role grant, readiness, public metrics guard 또는 필수 component smoke가 실패했다.
- collector가 신뢰 경계를 넘어 Docker socket을 사용하거나 관측 장애가 제품 요청을 막는다.

단순히 실제 target 입력을 아직 받지 못한 경우에는 중단 실패가 아니라 `PENDING_TARGET`다.

## Evidence 작성 원칙

- 실제 값과 결과는 component evidence 및 aggregate evidence에만 기록한다.
- URL credential, token, cookie, authorization header, verification code, HMAC material을 남기지 않는다.
- operator, UTC timestamp, commit SHA, immutable digest, risk owner, rollback owner를 기록한다.
- component 문서는 전체 release의 `GO`를 선언하지 않는다.
