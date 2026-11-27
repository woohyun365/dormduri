# Infra 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-27
**확인 근거**: [#696](https://github.com/woohyun365/dormduri/issues/696)의 Web 단계 결정 기록 댓글(topology-runtime-config의 `infra.topo.runtime-platform`: Lightsail 4 GB host 하나, ci-cd의 `infra.ci.deploy-authority`: 승인 뒤 배포 전용 job), [#886의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/886#issuecomment-6769539474)(`infra.topo.runtime-platform`의 managed PostgreSQL 위치, data-durability-recovery의 `infra.dr.backup-mode`), [#890의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/890#issuecomment-6785250115)(ci-cd의 `infra.ci.deploy-authority` API 단계 재검토), [#974의 결정 기록 근거 댓글](https://github.com/woohyun365/dormduri/issues/974#issuecomment-7081174825)(topology-runtime-config의 `infra.topo.runtime-platform/backoffice`, ci-cd의 `infra.ci.deploy-authority` 백오피스 재검토, 2026-11-04·2026-11-22), [#1023의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/1023#issuecomment-7216168685)(topology-runtime-config의 `infra.arch.repository-shape`·`infra.arch.code-unit`, ci-cd의 `infra.arch.test-placement`, 2026-11-26·2026-11-27)
**근거**: [Production runtime topology](../platform/production-runtime-topology.md), [Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md), [API 단계 배포](../../../infra/runbooks/release/api-stage-deploy.md), [백오피스 단계 배포](../../../infra/runbooks/release/backoffice-stage-deploy.md), [Production environment](../../deploy/production-environment.md), [Domain/SWE/Web/infra pack](../../development/agent-workflows/domain/swe-web/infra.md)

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
  PostgreSQL 18이고, 같은 Region default VPC에 public access 없이 두고 Lightsail VPC peering으로 붙인다(security group은 5432를 user host와 백오피스 host 주소 둘(/32)에서만 받음)
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

#### infra.topo.runtime-platform/backoffice

- 판정: Ask
- 상태: validated
- 고른 선택지: 백오피스는 user host와 따로 둔 Lightsail Linux 2 GB host 하나의 container compose(`infra/deploy/backoffice/compose.yml`:
  admin ingress·Web·API·Alloy)다. 공개 port·도메인을 두지 않고 운영자는 SSM 포트 포워딩으로 `http://localhost:4300`에만 닿는다. Host
  publish는 admin ingress의 `127.0.0.1:4300` 한 줄이고(compose 계약 test), Lightsail 방화벽 규칙은 없고 sshd는 mask했다. 같은 계정
  사설 IP traffic을 방화벽이 거르지 않으므로 loopback publish를 다른 host의 직접 route에서 막는 Docker Engine 28 이상을 배포 document가
  매번 확인한다. 같은 RDS에 백오피스 LOGIN user 둘로 붙고 RDS security group은 두 host의 `/32`만 받는다. 관측은 백오피스 Alloy가 user
  host API 묶음의 수신 gateway로 밀어 넣는 한 방향이고, gateway는 백오피스 host 주소와 token만 받으며 Prometheus 대신 API 지표를 긁어
  API container가 Prometheus에 닿지 않게 한다
- 근거: 관리자 기능에 공개 주소가 없어 들어오는 길이 SSM 인증(Identity Center 단기 credential·MFA) 하나로 준다. user host의 장애·
  memory 압박·침해가 운영자 기능과 갈린다. 백오피스 host에 들어오는 port가 없으므로 user host가 긁지 않고 백오피스가 보낸다. 받는
  쪽은 API 묶음 service라 `api-cd`가 배포하고 직전 묶음으로 되돌린다
- 기각한 대안: 공개 서브도메인과 인증서·IP 허용(공개 주소가 드러나고 운영자 IP 변경에 약함), Cloudflare Access(DNS zone 이전 또는 별도
  도메인), user host에 container로 함께 실행(host 장애·권한 침해가 격리되지 않음), host의 모든 interface에 publish(같은 계정 resource가
  닿음), user host Prometheus가 백오피스 host를 scrape(백오피스 host에 port를 열어야 함), 수신 경로를 user 공개 ingress listener에
  둠(공개 ingress 묶음이 관측 수신을 갖고 되돌림 단위가 갈림), Prometheus가 remote write를 받으면서 API network에 남음(API container가
  백오피스 지표를 위조하거나 버리게 할 수 있음)
- 재검토 조건: 운영자가 둘 이상이 되거나 browser 직접 접속이 필요할 때(Cloudflare Access·VPN), Docker가 loopback publish 보호를 바꾸거나
  nftables backend로 옮길 때, 백오피스 container 실측 memory가 [시작값](../../../infra/runbooks/release/components/infrastructure-target/readiness.md#backoffice-2gib-resource-시작값)을
  넘을 때
- 출처: #974, Owner 확인 2026-11-04(공개 ingress 없이 SSM 포트 포워딩)·2026-11-22(수신 gateway를 API 묶음에 두고 API 지표를 대신 긁음)
- pack 결정: [infra.topo.runtime-platform](../../development/agent-workflows/domain/swe-web/infra.md#infratoporuntime-platform)

#### infra.arch.repository-shape

- 판정: Ask
- 상태: validated
- 고른 선택지: 한 저장소와 배포 단위 app. 배포 단위 app 넷(`apps/web`·`apps/api`·`apps/backoffice-web`·`apps/backoffice-api`)과
  host 묶음 둘(`infra/deploy/user`·`infra/deploy/backoffice`)을 한 저장소의 workspace에 두고, 공유 code는 `packages/`에 둔다.
  디렉터리 목표는 [Repository와 deploy 구조 목표](../platform/production-runtime-topology.md#repository와-deploy-구조-목표)다
- 근거: 팀 경계가 하나이고 여러 app에 걸친 변경(공유 계약, BFF와 API)을 한 PR로 검토한다. 배포 단위는 넷이고 service별 독립
  확장 요구가 없다. 저장소·build pipeline·권한·경계 계약을 모두 다시 나눠야 해서 되돌리기 어렵다(`one-way`)
- 기각한 대안: 저장소 여러 개(팀 경계가 하나이고 여러 app에 걸친 변경을 한 PR로 검토한다), service마다 독립 배포와 data(배포
  단위가 넷이고 독립 확장 요구가 없다)
- 재검토 조건: 팀 경계가 둘 이상이 되거나 service별 독립 배포·확장이 측정한 요구가 될 때
- 출처: #1023, Owner 확인 2026-11-26(code 구조와 도구 "Nx + domain library")·2026-11-27(한 저장소와 app 넷 확정)
- pack 결정: [infra.arch.repository-shape](../../development/agent-workflows/domain/swe-web/infra.md#infraarchrepository-shape)

#### infra.arch.code-unit

- 판정: Ask
- 상태: validated
- 고른 선택지: app은 배포 shell, 기능은 domain별 종류 library. app 넷은 진입점·설정·route·조립만 두고, 기능은
  `packages/<domain>/<type>` library(feature·ui·data-access·util)로 옮긴다. 두 domain 이상이 쓸 때만 `packages/shared/<type>`에
  두고, 지금 `packages/shared`의 domain별 contract는 그 domain을 옮길 때 `packages/<domain>/contract`로 나눈다. 옮기기는 영역을
  다시 만들 때 하고 Legal이 첫 영역이다. 그때까지 app 안에는 domain 폴더와 기술 폴더가 섞여 있다
- 근거: 바뀐 library만 검사해 CI가 가벼워지고, domain 경계를 tag 규칙 lint가 막는다. library마다 설정 파일이 늘어나므로 Legal
  시범 뒤 나머지 영역의 type 표를 정한다. code·import 경로·build 입력을 다시 써야 해서 되돌리는 비용이 크다(`costly`)
- 기각한 대안: app 안 기능 폴더(바뀐 부분만 검사하는 단위가 app이라 CI가 줄지 않고 경계는 손으로 쓴 lint뿐이다), domain마다
  app(`apps/<domain>/{web,api}`. 배포 단위가 domain 수만큼 늘어 route·인증 공유와 CD 비용이 크다)
- 재검토 조건: Legal library 시범에서 library 설정·build 비용이 바뀐 부분만 검사하는 이득보다 클 때, 저장소 모양을 다시 정할 때
- 출처: #1023, Owner 확인 2026-11-26(code 구조와 도구 "Nx + domain library")
- pack 결정: [infra.arch.code-unit](../../development/agent-workflows/domain/swe-web/infra.md#infraarchcode-unit)

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
소유합니다. 백오피스 CD 절차는 [백오피스 단계 배포](../../../infra/runbooks/release/backoffice-stage-deploy.md)가 소유합니다. CD는 서비스마다 workflow·경로 filter·environment·role·dispatch rollback을 따로 둡니다.

#### infra.ci.deploy-authority

- 판정: Ask
- 상태: validated
- 고른 선택지: 사람 승인 뒤 배포 전용 job. 규칙은 [Production runtime safety](../../policies/production-runtime-safety.md)
  `PRS-R47`(CI는 production deploy 권한이 없다)·`PRS-R48`(단계 범위 CD)이다. 서비스마다 같은 job 구조다. Web 단계는
  `web-cd.yml`의 deploy job이 environment `production`의, API 단계는 `api-cd.yml`의 deploy job이 environment
  `production-api`의 승인(required reviewer Owner, `main`만) 뒤에만 그 서비스의 OIDC deploy role을 받는다. build·tag job은 그
  서비스의 publish role만, record job은 `contents: write`만 갖는다. API 단계의 migrate·grant·role smoke는 승인 뒤 host의 SSM
  document가 rollout 전에 one-off container로 돌리고, secret은 host role이 꺼내므로 workflow는 secret과 DB에 닿지 않는다. 백오피스
  단계는 `backoffice-cd.yml`의 deploy job이 environment `production-backoffice`의 승인 뒤에만 백오피스 deploy role을 받는다. 백오피스
  API는 migration을 돌리지 않는다. 같은 DB schema를 쓰므로 승인 전에 schema gate job(`actions: read`)이 이 commit의
  `packages/database/prisma`가 마지막으로 host 배포에 성공한 `api-cd` push commit과 같은지 보고, 다르면 같은 commit의 `api-cd` 배포
  성공을 기다리며(상한 90분) 실패·취소·없음이면 멈춘다
- 근거: 검증 권한과 배포 권한이 갈리고, 되돌릴 수 없는 적용 전에 Owner가 build log의 mask와 실행을 본다. 승인 지점 하나가 image
  rollout과 migration을 함께 지킨다. Migration은 앞으로만 가므로(forward-fix) 되돌리는 대신 승인 전에 변경을 본다. 승인은 직무
  분리가 아니라 의도적으로 멈추는 지점이라 self-approval을 허용한다. Long-lived access key 없이 OIDC 단기 credential만 쓴다
- 기각한 대안: 검증 job이 바로 배포(검증 단계가 운영 쓰기 권한을 갖는다), `main` push 자동 배포(승인 없이 적용된다), 모든
  `main` merge마다 build(배포 입력이 바뀌지 않은 merge도 image를 만든다), release tag push trigger, 장기 key나 SSH로 배포,
  migrate만 따로 승인하는 job·environment(승인과 host 명령이 둘로 나뉜다), 서비스 사이 environment·role 공유(서비스별 승인과
  최소 권한이 없다)
- 재검토 조건: 배포하는 사람이 Owner 밖으로 늘어 직무 분리가 필요할 때, 다른 서비스 CD가 같은 DB schema를 쓰게 될 때(migrate
  완료 확인과 순서), 사용자 release 선언 뒤 expand-contract가 한 배포를 여러 단계로 나눌 때
- 출처: #696, #890(재검토 조건 "API 단계가 DB migration을 CD에 넣을 때"가 걸려 다시 보고 같은 선택지를 유지), #974(재검토 조건
  "다른 서비스 CD가 같은 DB schema를 쓰게 될 때"가 걸려 다시 보고 같은 선택지를 유지하고 schema gate를 더함), Owner 확인
  2026-10-27·2026-11-04(서비스별 workflow, schema가 바뀐 push는 `api-cd` migrate 뒤 백오피스 rollout)·2026-11-11
- pack 결정: [infra.ci.deploy-authority](../../development/agent-workflows/domain/swe-web/infra.md#infracideploy-authority)

#### infra.arch.test-placement

- 판정: Ask
- 상태: validated
- 고른 선택지: [Repo binding의 고른 값](../../development/agent-workflows/domain/knu-binding.md#고른-값) `infra.arch.test-placement` 행
- 근거: 바뀐 code와 그 test가 함께 보이고, 기능을 library로 옮기면 그 test도 같은 project로 옮겨져 바뀐 부분만 검사한다. 여러
  app·DB를 잇는 흐름은 app 하나에 속하지 않아 최상위 workspace에 둔다. test 파일을 옮기고 수집 범위를 고치면 되므로 되돌리기
  쉽다(`easy`)
- 기각한 대안: app마다 source와 같은 모양의 별도 test tree(파일을 옮길 때 두 tree를 함께 옮겨야 하고 test가 빠져도 잘 보이지
  않는다), 저장소 최상위 test 디렉터리 하나(어느 app·library의 test인지 경로로 알 수 없어 바뀐 부분만 검사하기 어렵다),
  service·저장소마다 자기 test와 경계 계약 test(저장소 모양이 한 저장소다)
- 재검토 조건: 저장소 모양이 저장소 여러 개나 service마다 독립 배포로 바뀔 때
- 출처: #1023, Owner 확인 2026-11-26(unit·component test 위치 "소스 옆, 영역별로 옮김", 교차 e2e "최상위 e2e/ workspace")
- pack 결정: [infra.arch.test-placement](../../development/agent-workflows/domain/swe-web/infra.md#infraarchtest-placement)
