# Infrastructure plan authoring

`infra`, deployment/runtime topology, CI/CD, cloud/provider, database operations, observability가 primary owner인 계획에
사용합니다. [Core](./core.md)를 먼저 읽습니다.

## Current and target topology

- user product, backoffice, observability의 trust and failure boundary를 구분합니다.

구현·리뷰 기준: [web-infra-topology-runtime-config.md I1](../review-criteria/web-infra-topology-runtime-config.md#i1-현재목표-topology와-환경-차이-구분), [web-infra-observability.md I2](../review-criteria/web-infra-observability.md#i2-관측-ui와-제품-운영-화면-분리)

## Runtime, artifact, and configuration

구현·리뷰 기준: [web-infra-topology-runtime-config.md I2](../review-criteria/web-infra-topology-runtime-config.md#i2-불변-artifact와-configsecret-주입-흐름), [web-infra-topology-runtime-config.md I3](../review-criteria/web-infra-topology-runtime-config.md#i3-runtime-강화)

## Network, identity, and supply chain

- private network를 확인합니다.
- rollback artifact를 명시합니다.
- production identifier를 plan/evidence/log에 기록하지 않습니다.

구현·리뷰 기준: [web-infra-topology-runtime-config.md I4](../review-criteria/web-infra-topology-runtime-config.md#i4-networkidentity-최소-권한과-운영자-접근), [web-infra-capacity-cost-supply-chain.md I3](../review-criteria/web-infra-capacity-cost-supply-chain.md#i3-공급망-갱신출처sbom취약점-정책), [web-security-privacy-data-privacy-secret.md P4](../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)

## Stateful data and recovery

- DB/storage owner를 구분합니다.

구현·리뷰 기준: [web-infra-data-durability-recovery.md I1](../review-criteria/web-infra-data-durability-recovery.md#i1-restore-증거로-증명하는-backuprporto), [web-infra-data-durability-recovery.md I2](../review-criteria/web-infra-data-durability-recovery.md#i2-disposable-db와-운영-유사-endpoint-안전-gate), [web-infra-data-durability-recovery.md I3](../review-criteria/web-infra-data-durability-recovery.md#i3-stateful-변경과-rollout-호환-구간), [web-operations-release-release-gate.md O2](../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

## Capacity, cost, and degradation

구현·리뷰 기준: [web-infra-capacity-cost-supply-chain.md I1](../review-criteria/web-infra-capacity-cost-supply-chain.md#i1-첫-포화-지점과-degradation-matrix), [web-infra-capacity-cost-supply-chain.md I2](../review-criteria/web-infra-capacity-cost-supply-chain.md#i2-확장-도입-근거와-비용-가정-출처)

## Observability and operations

- provider, rollout, production evidence가 포함되면 [Operations and release](./cross-cutting/operations-release.md)를 추가합니다.

구현·리뷰 기준: [web-infra-observability.md I1](../review-criteria/web-infra-observability.md#i1-수집저장질의alertprivacy-경계), [web-infra-observability.md I2](../review-criteria/web-infra-observability.md#i2-관측-ui와-제품-운영-화면-분리), [web-operations-release-slo-signal.md O2](../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)

## CI/CD and automation

구현·리뷰 기준: [web-infra-ci-cd.md I1](../review-criteria/web-infra-ci-cd.md#i1-변경-경로-분류cachelane), [web-infra-ci-cd.md I2](../review-criteria/web-infra-ci-cd.md#i2-검증배포-권한-분리와-사람-승인-지점), [web-infra-ci-cd.md I3](../review-criteria/web-infra-ci-cd.md#i3-target-없는-cd-금지와-owner-하나)

## Ownership, IaC, integration, and lifecycle

- `docs`, `infra`, `scripts`, workflow, provider console 중 한 책임의 canonical source를 명시합니다.
- FE/API/BackOffice/provider는 public network, runtime config, health, artifact와 failure contract로 통합합니다.

구현·리뷰 기준: [swe.md S4](../review-criteria/swe.md#s4-책임-경계와-결합도), [web-infra-topology-runtime-config.md I5](../review-criteria/web-infra-topology-runtime-config.md#i5-선언형-configiac-owner와-drift), [web-infra-capacity-cost-supply-chain.md I4](../review-criteria/web-infra-capacity-cost-supply-chain.md#i4-upgradedeprecation-owner)

## Infrastructure verification

- config/schema/static policy tests
- Dockerfile build and container non-root/read-only checks
- `docker compose config`, dependency and health/readiness smoke
- env/secret inventory and leakage negative test
- disposable DB migration/restore test
- resource-constrained local rehearsal and selected failure injection
- rollback/forward-fix rehearsal
- target-specific network/TLS/provider/alert evidence at release time

Plan은 current/target topology, environment/config/secret model, data durability, capacity/cost, failure matrix,
IaC/drift, lifecycle, rehearsal boundary, release evidence와 operator handoff를 명시합니다.

구현·리뷰 기준: [swe.md S6](../review-criteria/swe.md#s6-보호-test)
