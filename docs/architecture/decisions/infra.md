# Infra 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-11
**확인 근거**: [#696](https://github.com/woohyun365/dormduri/issues/696)의 Web 단계 결정 기록 댓글(topology-runtime-config의 `infra.topo.runtime-platform`: Lightsail 4 GB host 하나, ci-cd의 `infra.ci.deploy-authority`: 승인 뒤 배포 전용 job), [#886의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/886#issuecomment-6769539474)(`infra.topo.runtime-platform`의 managed PostgreSQL 위치, data-durability-recovery의 `infra.dr.backup-mode`), [#890의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/890#issuecomment-6785250115)(ci-cd의 `infra.ci.deploy-authority` API 단계 재검토)
**근거**: [Production runtime topology](../platform/production-runtime-topology.md), [Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md), [API 단계 배포](../../../infra/runbooks/release/api-stage-deploy.md), [Production environment](../../deploy/production-environment.md), [Domain/SWE/Web/infra pack](../../development/agent-workflows/domain/swe-web/infra.md)

`Domain/SWE/Web/infra` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## topology-runtime-config

배치와 이후 목표는 [Production runtime topology](../platform/production-runtime-topology.md)가, 지금 resource는
[Production environment](../../deploy/production-environment.md)가 소유합니다.

#### infra.topo.runtime-platform

- 판정: Inspect
- 상태: validated
- 고른 선택지: 단일 host의 container compose(topology의 기존 결정). Web 단계에서 Owner가 provider와 크기를 서울 Lightsail
  Linux 4 GB host 하나로 정했고, 그 host에서 ingress(nginx)와 Web을 compose(`infra/deploy/user/compose.yml`)로 띄운다. API
  단계는 같은 host에 API 조각(`infra/deploy/user/api/compose.yml`)을 더한다. Managed PostgreSQL은 host 밖의 RDS for
  PostgreSQL 18이고, 같은 Region default VPC에 public access 없이 두고 Lightsail VPC peering으로 붙인다(security group은 host
  주소 하나만 받음)
- 근거: 출시 전이라 이용자가 적어 host 한 대로 충분하고 월 비용이 작다(실제 금액은 [서버 비용](../../deploy/server-costs.md)).
  Host가 멈추면 서비스 전체가 멈추지만 Web 단계는 공개 출시 전이라 점검 mode와 외부 가용성 경보로 받아들인다. 배포·network·
  secret·관측 경로를 모두 다시 구성해야 해서 되돌리기 어렵다(`one-way`)
- 기각한 대안: 관리형 container 서비스와 orchestration cluster(topology의 기존 결정), Lightsail 2 GB로 시작한 뒤 확장(snapshot으로
  새 instance를 만들고 host를 다시 검증해야 한다), EC2 `t4g.medium`(월 비용이 더 크고 ARM64 image 증거가 필요하며 저장소의
  Lightsail 기준을 바꾼다), DB로 Lightsail 관리형 DB(PostgreSQL 16 이하라 저장소 기준 18을 내려야 하고, 운영 도구를 EC2로
  옮길 때 peering이 안 된다), DB를 위해 host를 EC2로 이전(host·CD 재작성과 비용 증가)
- 재검토 조건: 측정한 CPU·memory·latency 포화가 [Capacity 근거와 변경 trigger](../platform/production-runtime-topology.md#capacity-근거와-변경-trigger)를
  넘을 때, Lightsail VPC peering이나 RDS 연결 방식이 host 선택과 충돌할 때, Lightsail bundle·가격이 바뀔 때
- 출처: #696, #886, Owner 확인 2026-10-27(host)·2026-11-04(RDS + Lightsail VPC peering)
- pack 결정: [infra.topo.runtime-platform](../../development/agent-workflows/domain/swe-web/infra.md#infratoporuntime-platform)

## data-durability-recovery

RPO·RTO 목표는 [DB 결정 기록](./db.md#dbintegrityrecovery-target)이, 설정 값과 restore drill 절차는
[RDS setup checklist](../../../infra/aws/rds-setup-checklist.md)와
[Backup and restore drill runbook](../../../infra/runbooks/operations/database/backup-restore.md)이 소유합니다.

#### infra.dr.backup-mode

- 판정: Ask
- 상태: validated
- 고른 선택지: 관리형 자동 backup + 시점 복구. RDS Single-AZ, 자동 백업 14일·PITR·삭제 방지·storage autoscaling 상한,
  restore drill은 첫 production 전 한 번과 분기마다
- 근거: 출시 전이라 이용자가 적고 사용자 release 전에는 가용성 목표가 없어 Single-AZ로 비용을 줄인다. PITR로 잃는 데이터의
  범위가 짧고 운영 부담이 작다. 늘린 storage는 줄일 수 없고 major upgrade는 되돌릴 수 없다(`costly`)
- 기각한 대안: 주기 dump를 다른 저장소에(마지막 dump 뒤 데이터를 잃고 보관·restore를 직접 운영), Multi-AZ·read replica·RDS
  Proxy·AWS Backup·cross-region을 처음부터(지금 요구가 없고 비용이 든다)
- 재검토 조건: 사용자 release 뒤 가용성 목표가 생길 때(Multi-AZ), 읽기 부하가 instance 한계에 닿을 때(read replica), connection
  예산이 넘칠 때(RDS Proxy), Region 장애 대비가 요구될 때(AWS Backup·cross-region), resource가 늘어 console 기록으로 재현이
  어려울 때(IaC)
- 출처: #886, Owner 확인 2026-11-04
- pack 결정: [infra.dr.backup-mode](../../development/agent-workflows/domain/swe-web/infra.md#infradrbackup-mode)

## ci-cd

CI와 CD의 책임 경계는 [Monorepo CI](../platform/monorepo-ci.md#책임)가, 실행 절차는
[Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md)와 [API 단계 배포](../../../infra/runbooks/release/api-stage-deploy.md)가
소유합니다. CD는 서비스마다 workflow·경로 filter·environment·role·dispatch rollback을 따로 둡니다.

#### infra.ci.deploy-authority

- 판정: Ask
- 상태: validated
- 고른 선택지: 사람 승인 뒤 배포 전용 job. 규칙은 [Production runtime safety](../../policies/production-runtime-safety.md)
  `PRS-R47`(CI는 production deploy 권한이 없다)·`PRS-R48`(단계 범위 CD)이다. 서비스마다 같은 job 구조다. Web 단계는
  `web-cd.yml`의 deploy job이 environment `production`의, API 단계는 `api-cd.yml`의 deploy job이 environment
  `production-api`의 승인(required reviewer Owner, `main`만) 뒤에만 그 서비스의 OIDC deploy role을 받는다. build·tag job은 그
  서비스의 publish role만, record job은 `contents: write`만 갖는다. API 단계의 migrate·grant·role smoke는 승인 뒤 host의 SSM
  document가 rollout 전에 one-off container로 돌리고, secret은 host role이 꺼내므로 workflow는 secret과 DB에 닿지 않는다
- 근거: 검증 권한과 배포 권한이 갈리고, 되돌릴 수 없는 적용 전에 Owner가 build log의 mask와 실행을 본다. 승인 지점 하나가 image
  rollout과 migration을 함께 지킨다. Migration은 앞으로만 가므로(forward-fix) 되돌리는 대신 승인 전에 변경을 본다. 승인은 직무
  분리가 아니라 의도적으로 멈추는 지점이라 self-approval을 허용한다. Long-lived access key 없이 OIDC 단기 credential만 쓴다
- 기각한 대안: 검증 job이 바로 배포(검증 단계가 운영 쓰기 권한을 갖는다), `main` push 자동 배포(승인 없이 적용된다), 모든
  `main` merge마다 build(배포 입력이 바뀌지 않은 merge도 image를 만든다), release tag push trigger, 장기 key나 SSH로 배포,
  migrate만 따로 승인하는 job·environment(승인과 host 명령이 둘로 나뉜다), 서비스 사이 environment·role 공유(서비스별 승인과
  최소 권한이 없다)
- 재검토 조건: 배포하는 사람이 Owner 밖으로 늘어 직무 분리가 필요할 때, 다른 서비스 CD가 같은 DB schema를 쓰게 될 때(migrate
  완료 확인과 순서), 사용자 release 선언 뒤 expand-contract가 한 배포를 여러 단계로 나눌 때
- 출처: #696, #890(재검토 조건 "API 단계가 DB migration을 CD에 넣을 때"가 걸려 다시 보고 같은 선택지를 유지), Owner 확인
  2026-10-27·2026-11-04(서비스별 workflow)·2026-11-11
- pack 결정: [infra.ci.deploy-authority](../../development/agent-workflows/domain/swe-web/infra.md#infracideploy-authority)
