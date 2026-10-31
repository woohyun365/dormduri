# Domain/SWE/Web/operations-release

[Domain/SWE/Web pack](./README.md)의 cross-cutting operations-release layer입니다. release 증거와 GO 판정, 배포 순서·되돌림·
운영 적용 권한, 완료 보고, health·readiness와 운영 신호, 의존 서비스 실패 동작과 성능·가용성 목표를 다룹니다. 다른 layer의
하위 layer는 그 기준 문서 머리말에 적은 이 layer의 항목을 상속합니다. 하위 layer마다 상속, 결정 목록, 구현 지침(기준 항목
인용), 검증 기준(항목 id), 위험, binding 키를 둡니다.

## release-gate

`Domain/SWE/Web/operations-release/release-gate`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### ops.release.go-decision

- 수준: `policy`
- 질문: release를 내보낼지(GO) 무엇으로 판정할까?
- 선택지:
  - 증거 checklist(빠지면 NO-GO): artifact 식별자·대상 owner·secret 목록 상태·smoke·관측·되돌림 판단을 항목마다 확인한다. 무엇이 확인됐는지 남지만 release마다 증거를 모아야 한다. 단계 배포(최종 판정 전에 일부 구성요소만 올리는 rollout)는 그 단계 구성요소의 항목만 확인하고, GO·NO-GO는 전체 release의 최종 판정에서 한다
  - 담당자 판단: 담당자가 상황을 보고 정한다. 빠르지만 판단 근거가 남지 않는다. 증거 없이 GO를 적으면 연결된 기준 항목 `web-operations-release-release-gate.md O1`이 결함으로 본다
  - 자동 지표만: 오류율·지연 같은 지표가 기준 안이면 내보낸다. 사람 손이 적지만 지표가 보지 않는 owner·secret·되돌림 판단이 빠진다. 연결된 기준 항목 `web-operations-release-release-gate.md O1`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 판정 절차를 바꾼다
- 기본값: 증거 checklist. 무엇이 확인됐는지 남고 빠진 증거가 GO로 넘어가지 않는다. 지표가 쌓인 뒤 자동 지표를 checklist 항목으로 더한다
- 확인 단서: `{{binding:policy.production-runtime-safety}}`, `{{binding:repo-structure.release-runbooks}}`의 release 절차
- 기준 항목: [web-operations-release-release-gate.md O1](../../review-criteria/web-operations-release-release-gate.md#o1-release-handoff와-증거-없는-go-금지), [web-operations-release-release-gate.md O3](../../review-criteria/web-operations-release-release-gate.md#o3-완료-시계-구분과-provider-값-추측-금지)

#### ops.release.rollback-mode

- 수준: `operational`
- 질문: 배포가 잘못되면 어떻게 돌아갈까?
- 선택지:
  - 이전 artifact로 되돌림: 직전 release의 artifact를 다시 배포한다. 가장 빨리 안전한 상태로 돌아가지만 artifact를 보관해야 하고 이미 바뀐 schema·data와 맞아야 한다
  - 앞으로 고쳐 다시 배포(forward-fix): 고친 새 release를 낸다. 되돌릴 수 없는 schema 변경 뒤에도 쓸 수 있지만 고치는 동안 문제가 이어진다
  - 기능 끄기(feature flag): 새 기능을 설정으로 끈다. 배포 없이 빠르지만 flag로 끌 수 없는 schema·data 변경에는 쓸 수 없고 flag 관리가 늘어난다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 배포 절차·artifact 보관·schema 변경 방식이 함께 바뀐다
- 기본값: 이전 artifact로 되돌리고, 되돌릴 수 없는 schema 변경은 forward-fix로 고친다. 가장 빨리 안전한 상태로 돌아간다. 이미 바뀐 data와 맞지 않으면 forward-fix만 남는다
- 확인 단서: `{{binding:repo-structure.release-runbooks}}`의 rollback 절차, `{{binding:repo-structure.release-artifacts}}`
- 기준 항목: [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

### 구현 지침

- [web-operations-release-release-gate.md O1](../../review-criteria/web-operations-release-release-gate.md#o1-release-handoff와-증거-없는-go-금지)
- [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)
- [web-operations-release-release-gate.md O3](../../review-criteria/web-operations-release-release-gate.md#o3-완료-시계-구분과-provider-값-추측-금지)

### 검증 기준

- `web-operations-release-release-gate.md O1`
- `web-operations-release-release-gate.md O2`
- `web-operations-release-release-gate.md O3`

### 위험

- 식별자 없는 release, 증거 없는 GO와 단계 기록의 GO·NO-GO 선언(O1), 함께 도는 옛·새 app을 깨는 schema·data 배포와 되돌림 경로 없는 release(O2), rehearsal 통과를 운영 성공으로 쓰기와 추측한 provider 값(O3)
- 비가역 선택: `ops.release.rollback-mode`(`costly`. schema·data 변경 방식과 배포 절차가 이 결정을 따른다)
- 사람 승인 지점: 되돌릴 수 없는 운영 적용(파괴적 schema 변경·data 삭제)은 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다(O2)

### binding 키

- `{{binding:repo-structure.release-runbooks}}`: release·rollback 절차 문서의 위치
- `{{binding:repo-structure.release-artifacts}}`: release artifact 목록·schema와 그 생성 script의 위치
- `{{binding:policy.production-runtime-safety}}`: 운영 runtime 안전 정책 원본

## slo-signal

`Domain/SWE/Web/operations-release/slo-signal`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### ops.slo.health-split

- 수준: `code-pattern`
- 질문: health 확인을 하나로 둘까 나눌까?
- 선택지:
  - liveness·readiness 분리: 살아 있음(liveness)과 요청을 받을 준비(readiness)를 따로 알린다. 의존 서비스의 일시 장애로 재시작이 번지지 않지만 진입점과 판정 규칙이 둘이 된다
  - health 하나: 한 진입점이 모든 상태를 알린다. 단순하지만 orchestrator(container를 띄우고 재시작하는 관리 도구)나 load balancer가 재시작할지와 traffic을 보낼지를 구분하지 못한다. orchestrator·load balancer가 재시작·traffic 판단에 쓰면 연결된 기준 항목 `web-operations-release-slo-signal.md O1`이 결함으로 본다
  - 의존 서비스까지 깊게 확인: DB·외부 서비스 연결까지 확인한다. 실제로 처리할 수 있는지를 잘 알리지만 의존 서비스가 잠깐 멈추면 모든 instance가 실패로 보인다. liveness 확인에 넣으면 연결된 기준 항목 `web-operations-release-slo-signal.md O1`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 진입점을 더하거나 옮긴다
- 기본값: liveness·readiness 분리. 살아 있음과 요청을 받을 준비를 따로 알려 의존 서비스의 일시 장애로 재시작이 번지지 않는다. 단일 process 개발 환경이면 하나로 시작한다
- 확인 단서: `{{binding:repo-structure.be-health}}`의 health 진입점과 그 test
- 기준 항목: [web-operations-release-slo-signal.md O1](../../review-criteria/web-operations-release-slo-signal.md#o1-healthreadiness-신호-범위)

#### ops.slo.objective

- 수준: `operational`
- 질문: 서비스 목표(가용성·지연)를 지금 정할까?
- 선택지:
  - 핵심 흐름 몇 개에 목표와 측정: 중요한 사용자 흐름 몇 개에 목표와 측정 방법을 둔다. 성능 주장을 확인할 수 있지만 측정을 운영해야 한다
  - 목표 없이 관측만: 지표만 모은다. 부담이 적지만 충분한지·나아졌는지 판단할 기준이 없다. 성능·가용성을 주장하면 연결된 기준 항목 `web-operations-release-slo-signal.md O3`이 결함으로 본다
  - 모든 진입점에 목표: 진입점마다 목표를 둔다. 빠짐이 없지만 목표와 alert가 많아 운영 비용이 크다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 목표를 더하거나 조정한다
- 기본값: 핵심 흐름 몇 개에 목표와 측정. 목표와 측정이 함께 있어 성능 주장을 확인할 수 있다. traffic이 없는 초기에는 측정 방법만 두고 수치는 첫 측정 뒤 정한다. 값은 정책이 소유한다
- 확인 단서: `{{binding:policy.operational-observability}}`, `{{binding:repo-structure.obs-config}}`의 alert 규칙
- 기준 항목: [web-operations-release-slo-signal.md O2](../../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결), [web-operations-release-slo-signal.md O3](../../review-criteria/web-operations-release-slo-signal.md#o3-실패-동작과-성능가용성-budget)

### 구현 지침

- [web-operations-release-slo-signal.md O1](../../review-criteria/web-operations-release-slo-signal.md#o1-healthreadiness-신호-범위)
- [web-operations-release-slo-signal.md O2](../../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)
- [web-operations-release-slo-signal.md O3](../../review-criteria/web-operations-release-slo-signal.md#o3-실패-동작과-성능가용성-budget)

### 검증 기준

- `web-operations-release-slo-signal.md O1`
- `web-operations-release-slo-signal.md O2`
- `web-operations-release-slo-signal.md O3`

### 위험

- 재시작·traffic 판단에 쓰는 health에서 나누지 않은 liveness·readiness와 liveness에 넣은 의존 서비스 확인, 내부 상세를 드러내는 health 응답(O1), 대응 행동·runbook 없는 alert와 운영 질문 없는 metric(O2), 목표·측정 없는 성능·가용성 주장(O3)
- 비가역 선택: 없음

### binding 키

- `{{binding:repo-structure.be-health}}`: health·readiness 진입점의 위치
- `{{binding:repo-structure.obs-config}}`: 관측 수집·alert 설정과 그 script의 위치
- `{{binding:policy.operational-observability}}`: 운영 관측 정책 원본
