# Architecture

장기 유지할 기술 결정과 현재 구현 경계를 기록합니다. 특정 작업의 실행 계획이나 비교 초안은
`.omx/plans/`, 과거 구현 기록과 개인 참고 자료는 `local-docs/`에 둡니다.

이 디렉터리에는 owner README나 policy만으로 설명할 수 없는 **현재 채택된 결정**만 유지합니다.
구현 위치를 찾기 위한 문서, Sprint 실행 기록, 폐기된 API·model·path는 architecture 문서로
중복 관리하지 않습니다.

## Backend

- [비밀번호 재설정 시작 경로 timing 방어](./backend/auth/auth-reset-timing-defense.md)
- [Opaque session transport 결정](./backend/auth/jwt-vs-opaque-session-transport-decision.md)
- [Auth business failure 응답·관측 경계](./backend/business/auth-business-failure-monitoring-strategy.md)

## Data

- [Campus·season·dormitory operation schema](./data/campus-season-and-dormitory-operation-schema.md)
- [Date-only 정규화 규칙](./data/date-only-normalization-rule.md)

## Frontend

- [Action capability source of truth](./frontend/action-capability-source-of-truth.md)
- [Web infra·CI·test config 경계](./frontend/web-infra-ci-test-config.md)

## Monorepo

- [Lifestyle contract 공유 경계](./monorepo/lifestyle-contract-sharing.md)

## Platform

- [Dependency automation architecture](./platform/dependency-automation.md)
- [Monorepo CI architecture](./platform/monorepo-ci.md)
- [Production runtime topology](./platform/production-runtime-topology.md)
- [Observability topology](./platform/observability-topology.md)
