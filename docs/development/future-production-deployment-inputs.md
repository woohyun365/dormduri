# Production deployment implementation inputs

이 문서는 production 배포 자동화를 구현하기 전에 확정해야 하는 입력만 기록한다. 현재 repository는 CI, API container 후보, local compose rehearsal, health/readiness/metrics smoke를 제공하지만 production CD workflow나 원격 rollout 명령은 제공하지 않는다.

## 결정이 필요한 입력

### 1. Runtime topology

- API와 Web을 실행할 hosting target
- API, Web, BackOffice, observability의 process/container 분리 방식
- 단일 host에서 시작할지, 관리형 runtime 또는 다중 instance를 사용할지
- image/artifact registry와 immutable release identifier

### 2. Account and network boundary

- 운영 account와 region
- public ingress, private runtime, managed PostgreSQL 사이의 network boundary
- deployment principal과 runtime principal의 권한 분리
- secret materialization owner와 rotation 절차

### 3. Database change ownership

- migration principal과 실행 위치
- app rollout보다 먼저 migration/role grant를 적용하는 주체
- backup/PITR 확인과 restore 승인 owner
- schema change 실패 시 write 차단과 복구 의사결정 절차

### 4. Canonical HTTPS surface

- 사용자에게 공개할 canonical Web/API host
- ingress, DNS, TLS 발급·갱신 owner
- CORS, realtime origin, cookie domain 최종값
- health/readiness/metrics의 public/private exposure boundary

### 5. Release and rollback control

- 승인 주체와 최소 승인 단계
- rollout 방식과 traffic 전환 단위
- readiness 실패 시 자동 중단 기준
- 이전 안전 artifact로 복구하는 방식
- release·rollback SLO와 필수 evidence 보존 기간

## 구현 시작 조건

위 입력이 실제 resource와 운영 owner 기준으로 결정되면 별도의 bounded CD 계획을 작성한다. 그 계획은 선택한 provider와 runtime에 맞는 workflow, 최소 권한, artifact publish, rollout, smoke, rollback을 함께 검증해야 한다. 입력이 확정되기 전에는 provider별 workflow, IAM policy, 원격 실행 예시를 repository의 지원 기능으로 추가하지 않는다.
