# Infrastructure runbooks

`infra/runbooks`는 실제 infrastructure operation, rehearsal, incident response와 production release
handoff를 소유한다. 제품 정책과 architecture 결정은 `docs/`에 두며 이 디렉터리는 실행 순서와
secret-free evidence 경계만 기록한다.

## 읽기 순서

1. Production release는 [`release/production-release-readiness.md`](./release/production-release-readiness.md)에서 시작한다.
2. 실제 결과와 최종 판정은 [`release/production-release-evidence.md`](./release/production-release-evidence.md)에만 기록한다.
3. 일상 운영 절차는 [`operations/`](./operations/)에서 찾는다.
4. 장애 대응은 [`incidents/`](./incidents/)의 alert/runbook 연결을 따른다.
5. Local evidence는 [`rehearsal/`](./rehearsal/)에서 생성하며 실제 target evidence로 대체하지 않는다.

## 책임 구조

| 디렉터리      | 책임                                                   | 상태/결과 소유 여부                     |
| ------------- | ------------------------------------------------------ | --------------------------------------- |
| `release/`    | 배포 준비 입력, component evidence, aggregate decision | 실제 release 결과 소유                  |
| `operations/` | DB와 observability의 반복 운영 절차                    | 운영 기록 identifier만 연결             |
| `incidents/`  | 장애 확인, 격리, 복구, rollback                        | incident record는 외부 운영 기록에 남김 |
| `rehearsal/`  | account-free local 검증과 cleanup                      | local evidence만 소유                   |

## 주요 진입점

- DB backup·restore: [`operations/database/backup-restore.md`](./operations/database/backup-restore.md)
- Production observability: [`operations/observability/production-stack.md`](./operations/observability/production-stack.md)
- Slack delivery 설정: [`operations/observability/slack-delivery.md`](./operations/observability/slack-delivery.md)
- 관측 alert 장애 대응: [`incidents/observability-alert-delivery.md`](./incidents/observability-alert-delivery.md)
- API·관측 연결 rehearsal: [`rehearsal/api-observability.md`](./rehearsal/api-observability.md)
- Full-stack local rehearsal: [`rehearsal/full-stack.md`](./rehearsal/full-stack.md)

## 파일 배치 원칙

- readiness와 evidence는 같은 component owner 디렉터리에 둔다.
- alert annotation은 `incidents/`의 실제 대응 문서를 가리킨다.
- provider 계정이나 secret 값을 Markdown에 기록하지 않는다.
- 단순 설명 문서는 `docs/architecture` 또는 `docs/policies`가 소유한다.
- 새로운 root-level runbook을 추가하지 않고 lifecycle owner 아래에 배치한다.
