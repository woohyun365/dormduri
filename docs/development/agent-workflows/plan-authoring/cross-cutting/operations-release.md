# Operations and release plan lens

Provider, migration, production target, rollout/rollback, SLO, observability, capacity 또는 operator workflow가 범위에
포함될 때 primary domain guide와 함께 읽습니다.

## Required analysis

- deployable artifact, environment, config and secret owner
- retry behavior
- capacity assumptions, cost, quota and scale trigger

구현·리뷰 기준: [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인), [web-operations-release-release-gate.md O3](../../review-criteria/web-operations-release-release-gate.md#o3-완료-시계-구분과-provider-값-추측-금지), [web-operations-release-slo-signal.md O1](../../review-criteria/web-operations-release-slo-signal.md#o1-healthreadiness-신호-범위), [web-operations-release-slo-signal.md O2](../../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결), [web-operations-release-slo-signal.md O3](../../review-criteria/web-operations-release-slo-signal.md#o3-실패-동작과-성능가용성-budget)

## Account-free implementation and release gate

Repository에서 검증 가능한 config schema, adapter, privacy, fail-open/closed, fake/recording transport, local rehearsal을
먼저 구현할 수 있습니다.

계정 생성이나 metric 축적 대기를 repository implementation Phase로 만들지 않습니다.

구현·리뷰 기준: [web-operations-release-release-gate.md O1](../../review-criteria/web-operations-release-release-gate.md#o1-release-handoff와-증거-없는-go-금지), [web-operations-release-release-gate.md O3](../../review-criteria/web-operations-release-release-gate.md#o3-완료-시계-구분과-provider-값-추측-금지)
