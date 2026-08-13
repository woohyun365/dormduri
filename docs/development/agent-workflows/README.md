# Agent workflow guides

이 디렉터리는 모든 세션에 주입할 필요는 없지만 반복 작업에서 일관성이 필요한 절차를 소유합니다.
저장소 공통 불변 규칙은 root `AGENTS.md`가 소유하며, 여기의 문서는 해당 작업을 수행할 때만 읽습니다.

## Guides

- [Agentic architecture decisions](./agentic-architecture-decisions.md): agent pattern, 검증, 권한과 orchestration 결정
- [Getting started](./getting-started.md): 처음 참여한 개발자의 fresh/resume/analysis/plan/implementation 요청 예시
- [Agent execution contract](./agent-execution-contract.md): coding agent의 classify→inspect→route→act→verify→handoff 계약
- [Session continuity](./session-continuity.md): fresh/resume, checkpoint, active plan과 closeout 규칙
- [Orchestration](./orchestration.md): single-agent 기본값, bounded fan-out과 reasoning effort routing
- [QA](./qa.md): 인수 조건 도출, 코드 리뷰, 완료 검증의 근거와 판정 방식
- [Refactor analysis](./refactor-analysis.md): 책임 경계와 분리 순이익을 분석하는 방식

처음 참여한 개발자는 [Getting started](./getting-started.md)부터 읽습니다. Coding agent는 root `AGENTS.md`와
[Agent execution contract](./agent-execution-contract.md)를 기준으로 현재 작업에 필요한 guide만 추가로 읽습니다.

## Freshness

- 현재 사용자 요청, working tree의 코드·계약·테스트, tracked policy·architecture를 과거 문서보다 우선합니다.
- historical root 원문은 `local-docs/repo-root/`에 보존하지만 현재 판단 근거로 직접 사용하지 않습니다.
- workflow를 변경하면 현재 repository script와 CI 명령을 함께 확인합니다.
- `.omx/`의 checkpoint와 memory는 tracked guide를 대체하지 않습니다.
