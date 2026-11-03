# Onboarding

이 저장소에 처음 참여하는 개발자의 입구입니다. 각 항목의 내용은 링크한 owner 문서가 소유하고, 이 문서는 읽는 순서와 위치만
안내합니다.

## 1. 저장소 구조

- 디렉터리 구조: root README의 [저장소 구조](../../README.md#저장소-구조)
- 디렉터리별 책임: [`AGENTS.md`](../../AGENTS.md#2-repository-map)의 Repository map
- 제품이 무엇을 하는지: [서비스 소개](../../SERVICE.md)

## 2. 로컬 실행

- 필요 환경, 로컬 실행 명령, 기본 검증: root README의 [시작하기](../../README.md#시작하기)
- 로컬 Docker 환경 선택과 자원·검증 경계: [Local environments](../../infra/runbooks/rehearsal/local-environments.md)
- 개발 환경에서 반복되는 문제: [Troubleshooting index](./troubleshooting/README.md)

## 3. 검사 명령

- 변경 범위별 표준 검사 명령: [`AGENTS.md`](../../AGENTS.md#3-canonical-commands)의 Canonical commands
- CI가 바뀐 경로를 lane으로 나누는 방식과 새 경로 추가 절차: [CI development](./ci/README.md)

## 4. 문서 위치

- 전체 문서 색인: [`docs/README.md`](../README.md)
- 제품 정책: [`docs/policies/`](../policies/README.md), 기술 결정: [`docs/architecture/`](../architecture/README.md)
- 지금 운영 환경과 서버 비용: [`docs/deploy/`](../deploy/README.md)
- 배포·운영 절차: [`infra/runbooks/`](../../infra/runbooks/README.md)

## 5. 협업 규칙

- GitHub 협업·commit·PR 규칙: [GitHub collaboration](./github/README.md)
- Branch와 PR 전략: [Branch and PR strategy](./github/branch-and-pr-strategy.md)
- 기여 안내: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

## 6. AI agent와 함께 작업할 때

- 처음 쓰는 요청 예시: [Agent workflow getting started](./agent-workflows/getting-started.md)
- 공통 저장소 계약: [`AGENTS.md`](../../AGENTS.md)
