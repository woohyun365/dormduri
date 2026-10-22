# Agent workflow evidence

Agent workflow 개선의 측정값, 설계 근거, 사례 기록입니다. Coding agent의 현재 실행 규칙은 owner 문서가 소유합니다.

- 공통 실행·검증 계약과 host adapter: [Agent workflow guides](../../development/agent-workflows/README.md)
- 설계 결정 기록(agent가 읽는 결정 원본): [Agentic architecture decisions](../../development/agent-workflows/agentic-architecture-decisions.md)

| 문서                                                                            | 기록                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Agent workflow improvement evidence](./agent-workflow-improvement-evidence.md) | 공통 계약·host adapter 개선 PR 28개(2026-09-27~10-03)의 리뷰 기록·계약 test 수·merge 뒤 결함      |
| [Agentic Engineering methodology](./agentic-engineering-methodology.md)         | AI 시대에 선택한 개발 방식, 적용 수준과 한계                                                      |
| [Agentic orchestration case study](./agentic-orchestration-case-study.md)       | evidence 기반 parent–subagent 설계의 문제·대안·구현·검증·한계(당시 Codex 사례)                    |
| [Review criteria calibration evidence](./review-criteria-calibration.md)        | 영역 리뷰 기준을 준 reviewer와 기준 없는 reviewer의 결함 재발견률·오탐 처분·비용 교정(2026-10-19) |
| [Design workflow host symmetry evidence](./design-workflow-host-symmetry.md)    | 두 host 디자인 workflow 통일의 대안 판정, 규칙별 구조 guard와 전후 품질 신호(2026-10-22)          |
