# Infra 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-10-27
**확인 근거**: [#696](https://github.com/woohyun365/dormduri/issues/696)의 Web 단계 결정 기록 댓글(topology-runtime-config의 `infra.topo.runtime-platform`: Lightsail 4 GB host 하나, ci-cd의 `infra.ci.deploy-authority`: 승인 뒤 배포 전용 job)
**근거**: [Production runtime topology](../platform/production-runtime-topology.md), [Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md), [Production environment](../../deploy/production-environment.md), [Domain/SWE/Web/infra pack](../../development/agent-workflows/domain/swe-web/infra.md)

`Domain/SWE/Web/infra` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## topology-runtime-config

배치와 이후 목표는 [Production runtime topology](../platform/production-runtime-topology.md)가, 지금 resource는
[Production environment](../../deploy/production-environment.md)가 소유합니다.

#### infra.topo.runtime-platform

- 판정: Inspect
- 상태: validated
- 고른 선택지: 단일 host의 container compose(topology의 기존 결정). Web 단계에서 Owner가 provider와 크기를 서울 Lightsail
  Linux 4 GB host 하나로 정했고, 그 host에서 ingress(nginx)와 Web을 compose(`infra/deploy/user/compose.yml`)로 띄운다. API
  단계는 같은 host에 API를 더하고 managed PostgreSQL은 host 밖에 둔다
- 근거: 출시 전이라 이용자가 적어 host 한 대로 충분하고 월 비용이 작다(실제 금액은 [서버 비용](../../deploy/server-costs.md)).
  Host가 멈추면 서비스 전체가 멈추지만 Web 단계는 공개 출시 전이라 점검 mode와 외부 가용성 경보로 받아들인다. 배포·network·
  secret·관측 경로를 모두 다시 구성해야 해서 되돌리기 어렵다(`one-way`)
- 기각한 대안: 관리형 container 서비스와 orchestration cluster(topology의 기존 결정), Lightsail 2 GB로 시작한 뒤 확장(snapshot으로
  새 instance를 만들고 host를 다시 검증해야 한다), EC2 `t4g.medium`(월 비용이 더 크고 ARM64 image 증거가 필요하며 저장소의
  Lightsail 기준을 바꾼다)
- 재검토 조건: 측정한 CPU·memory·latency 포화가 [Capacity 근거와 변경 trigger](../platform/production-runtime-topology.md#capacity-근거와-변경-trigger)를
  넘을 때, API 단계의 managed PostgreSQL 연결 방식이 host 선택과 충돌할 때, Lightsail bundle·가격이 바뀔 때
- 출처: #696, Owner 확인 2026-10-27
- pack 결정: [infra.topo.runtime-platform](../../development/agent-workflows/domain/swe-web/infra.md#infratoporuntime-platform)

## ci-cd

CI와 CD의 책임 경계는 [Monorepo CI](../platform/monorepo-ci.md#책임)가, 실행 절차는
[Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md)가 소유합니다.

#### infra.ci.deploy-authority

- 판정: Ask
- 상태: validated
- 고른 선택지: 사람 승인 뒤 배포 전용 job. 규칙은 [Production runtime safety](../../policies/production-runtime-safety.md)
  `PRS-R47`(CI는 production deploy 권한이 없다)·`PRS-R48`(단계 범위 CD)이다. Web 단계는 `web-cd.yml`의 deploy job이
  environment `production`(required reviewer Owner, `main`만)의 승인 뒤에만 OIDC deploy role을 받고, build·tag job은 publish
  role만, record job은 `contents: write`만 갖는다
- 근거: 검증 권한과 배포 권한이 갈리고, 되돌릴 수 없는 적용 전에 Owner가 build log의 mask와 실행을 본다. 승인은 직무 분리가
  아니라 의도적으로 멈추는 지점이라 self-approval을 허용한다. Long-lived access key 없이 OIDC 단기 credential만 쓴다
- 기각한 대안: 검증 job이 바로 배포(검증 단계가 운영 쓰기 권한을 갖는다), `main` push 자동 배포(승인 없이 적용된다), 모든
  `main` merge마다 build(배포 입력이 바뀌지 않은 merge도 image를 만든다), release tag push trigger, 장기 key나 SSH로 배포
- 재검토 조건: 배포하는 사람이 Owner 밖으로 늘어 직무 분리가 필요할 때, API 단계가 DB migration을 CD에 넣을 때
- 출처: #696, Owner 확인 2026-10-27
- pack 결정: [infra.ci.deploy-authority](../../development/agent-workflows/domain/swe-web/infra.md#infracideploy-authority)
