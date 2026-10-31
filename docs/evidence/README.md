# Evidence

> **Audience:** 사람 대상 portfolio, onboarding, engineering discussion reference. Coding agent의 작업 지침이나 규칙의
> owner가 아닙니다.

`docs/evidence/`는 개선 작업이 남긴 측정값(수치 근거), 설계 근거, 문제 해결 이유를 영역별로 보존합니다. 각 문서는 문제를
어떤 수치로 확인했는지, 원인을 어떻게 좁혔는지, 왜 다른 방법을 쓰지 않았는지, 개선 효과를 어떻게 검증했는지를 다시 산출할
수 있는 형태로 기록합니다.

| 영역                                           | 문서                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CI](./ci/README.md)                           | [Monorepo CI restructuring evidence](./ci/monorepo-ci-restructuring-evidence.md), [CI change classification evidence](./ci/ci-change-classification-evidence.md), [Monorepo CI baseline](./ci/monorepo-ci-baseline.md)                                                                                                                                                                                                                                                                                                                                                                      |
| [Agent workflows](./agent-workflows/README.md) | [Agent workflow improvement evidence](./agent-workflows/agent-workflow-improvement-evidence.md), [Agentic Engineering methodology](./agent-workflows/agentic-engineering-methodology.md), [Agentic orchestration case study](./agent-workflows/agentic-orchestration-case-study.md), [Review criteria calibration evidence](./agent-workflows/review-criteria-calibration.md), [Design workflow host symmetry evidence](./agent-workflows/design-workflow-host-symmetry.md), [Claude Haiku extraction routine cohort evidence](./agent-workflows/claude-haiku-extraction-routine-cohort.md) |
| [Dependencies](./dependencies/README.md)       | [Dependency supported-line epochs](./dependencies/dependency-supported-line-epochs.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [Matches](./matches/README.md)                 | [Accept lock order evidence](./matches/accept-lock-order-evidence.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [Frontend](./frontend/README.md)               | [Landing rebuild evidence](./frontend/landing-rebuild-evidence.md), [React Compiler evidence](./frontend/react-compiler-evidence.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## 다른 문서와의 경계

- 현재 규칙·동작은 owner 문서가 소유합니다. 정책은 `docs/policies/`, 설계 결정은 `docs/architecture/`, 개발 기준과 재발 가능한
  문제의 troubleshooting은 `docs/development/`, 운영 절차는 `docs/runbooks/`입니다. Evidence 문서는 owner 문서를 링크하고,
  규칙을 복제하거나 바꾸지 않습니다.
- 재발할 수 있는 장애의 증상·원인·해결·회귀 검증은
  [Troubleshooting](../development/troubleshooting/README.md)에 둡니다. 여기에는 개선 하나의 전후 기록을 둡니다.
- 개인 분석, 계획에 묶이지 않은 초안, PR review 원문, 첨부 자료는 ignored `.local-docs/`, 계획 진행 중의 evidence 초안·원자료와 실행 로그·원시 출력은 ignored `.artifacts/`에 둡니다.

## 작성 기준

- 모든 수치는 공개 run ID, commit, 재현 명령 중 하나로 다시 산출할 수 있어야 합니다. 추정·회고 수치는 그렇다고 표시합니다.
- 표본이 모이기 전의 통계는 주장하지 않고 "표본 n/5"처럼 수집 상태를 적습니다.
- 측정 시점(commit·날짜)을 함께 적습니다. 이후 동작이 바뀌어도 당시 측정은 고치지 않고, 새 측정을 추가합니다.
- 개인 장비 경로, ignored 계획 파일 경로, secret 원문을 쓰지 않습니다.
- 개선 작업 중에 evidence 초안을 남기고 이 디렉터리로 옮기는 절차는 [Portfolio evidence instruction](../portfolio/evidence-instruction.md)이 소유합니다.
