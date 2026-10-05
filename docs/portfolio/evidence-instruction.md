# Portfolio evidence instruction

> **Audience:** 개선 작업을 계획·구현하는 coding agent와 작성자. 이 문서는 `docs/evidence/` 문서를 만드는 **절차**와 절 형식(§4)을
> 소유합니다. 수치의 재산출·표본·측정 시점 같은 작성 기준(사람 대상)은 [Evidence README](../evidence/README.md)가 소유하고, 이 문서는
> 그 기준을 다시 쓰지 않고 링크합니다. `docs/portfolio/`는 public portfolio 추출에서 디렉터리째 제외합니다(§7).

## 1. 적용 판정

다음 중 하나에 해당하면 **개선 작업**으로 보고 이 절차를 따릅니다.

- before/after를 수치로 비교할 수 있는 변경: 시간, 비용, 결함, 신뢰성, 규모, 운영 부담
- 대안을 비교해 고른 설계 결정

단순 기능 추가, 오탈자, 일상 dependency bump처럼 비교할 전후나 대안이 없는 변경은 대상이 아닙니다.

이 절차를 따르는 plan은 header에 판정을 한 줄로 적습니다. 모든 plan의 필수 header는 아니며, plan 구조는
[Plan authoring core](../development/agent-workflows/plan-authoring/core.md)가 소유합니다.

```text
- Evidence: required | not-applicable(이유)
```

## 2. Phase별 기록

- 위치: 계획 증거이므로 [`.artifacts` 배치 규칙](../../.artifacts/README.md)의 phase·날짜 디렉터리에 둡니다. 초안은
  `evidence-draft.md`, 원자료는 같은 디렉터리의 TSV·JSON·명령 출력입니다.
- Phase를 시작할 때 직전 phase의 초안을 새 phase 디렉터리로 복사해 다시 읽고, 바뀐 수치를 고칩니다. merge 뒤 plan과 artifact가
  archive로 옮겨지면 근거를 다시 모으기 어렵기 때문입니다.
- 기록 항목: 문제 수치, 측정 명령, run ID·commit, 표본 수, 기각한 대안과 근거, 리뷰 finding과 수정 commit, 한계.
- plan 없이 한 PR로 끝나는 개선 작업은 phase 기록을 두지 않고, 그 PR에서 §3·§4대로 evidence 문서를 바로 씁니다.

## 3. 승격

- 시점: 개선이 merge되는 PR, 또는 plan의 마지막 문서 Phase에서 초안을 다듬어 `docs/evidence/<영역>/`로 옮기고, 영역 README의 문서 표와
  [Evidence README](../evidence/README.md) 영역 표의 문서 목록을 함께 갱신합니다.
- 기준: [Evidence README의 작성 기준](../evidence/README.md#작성-기준)을 따릅니다. p50·p95를 게시할 때의 표본 수는
  [Monorepo CI restructuring evidence의 표본 규칙](../evidence/ci/monorepo-ci-restructuring-evidence.md#표본-규칙)을 선례로 따릅니다.
- 승격 문서에는 ignored 경로, plan 파일명, Phase 번호, session ID를 쓰지 않습니다. 다시 산출하는 조건은 위 작성 기준을 따릅니다.

## 4. 문서 형식

Audience 줄 → §1 문제와 관측 → §2 측정 방법과 재현 명령 → §3 baseline → §4 원인 → §5 대안과 기각 → §6 개선별 전후 측정 →
§7 한계와 재측정 조건 → §8 interview map 순서로 씁니다. 예시는
[CI change classification evidence](../evidence/ci/ci-change-classification-evidence.md)와
[Monorepo CI restructuring evidence](../evidence/ci/monorepo-ci-restructuring-evidence.md)입니다.

## 5. 측정할 수 없을 때

- 시간·비용 비교군이 없으면 다시 산출할 수 있는 품질 신호로 대신합니다. 예: 독립 리뷰가 merge 전에 잡은 결함, 회귀를 막는 test 수,
  merge 뒤 결함.
- 생산성, 작업 시간 절감, token 절감, 동등 품질은 비교군 없이 주장하지 않습니다. 측정할 수 없는 이유는 evidence 문서의 §7(한계와 재측정 조건)에 적습니다.

## 6. 사실 대조

- 인용한 PR·SHA·run은 `gh`로 대조합니다.
- 개선 전과 후의 지표 정의(job 단위·workflow 단위, p95 계산법, test 범위)가 같은지 확인합니다. 다르면 직접 비교하지 않고 한계에
  적습니다.

## 7. Public 추출 때 제거할 것

- `docs/portfolio/` 디렉터리
- 이 디렉터리를 가리키는 참조 줄 3개: `AGENTS.md` §4 연결 줄, `docs/README.md` 항목, `docs/evidence/README.md` 안내 줄

참조가 늘었는지는 아래 명령으로 다시 열거합니다. 결과가 위 3줄과 다르면 이 목록을 고칩니다.

```bash
git grep -n 'portfolio/' -- ':!docs/portfolio/**'
```
