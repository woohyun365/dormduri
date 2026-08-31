# Branch readiness evidence

이 문서는 feature branch가 pull request를 열기 전에 **한 acceptance 경계로 review·검증·rollback 가능한지** 점검하는
방법을 정의합니다. 목적은 큰 diff를 금지하는 것이 아니라, 작아 보여도 서로 독립적인 outcome을 섞는 문제와 큰
mechanical change를 무조건 거절하는 문제를 함께 피하는 것입니다.

## Evidence와 disposition

`pnpm git:branch-readiness`는 두 층을 구분합니다.

1. **Deterministic evidence**
   - 확인된 base, merge-base, HEAD
   - changed path와 meaningful added/deleted lines
   - lockfile, generated path, deletion context
   - GitHub Actions와 같은 `classifyChanges()`가 선택한 CI lane
2. **Declared semantic disposition**
   - prospective outcome, acceptance, non-scope
   - Issue와 장기 plan 연결
   - `required-current`, `prerequisite-predecessor`, `independent-follow-up`, `unrelated-or-speculative`
   - independent outcome, rollback·migration·security·release boundary, blocker evidence

파일명이나 keyword로 owner를 추측하지 않습니다. Git evidence는 script가 수집하고, semantic owner 관계는 개발자 또는
repository-aware agent가 current code·contract·test를 읽은 뒤 명시적으로 선언합니다.

## 실행

간단한 변경은 command line에서 기본 계약을 선언할 수 있습니다.

```bash
pnpm git:branch-readiness -- \
  --base origin/dev \
  --issue '#123' \
  --outcome '한 가지 사용자 결과' \
  --acceptance 'targeted regression 통과' \
  --non-scope '독립 UI 개선' \
  --follow-up '#456: 독립 UI 개선' \
  --do-not-touch DESIGN.md \
  --json
```

여러 owner나 boundary를 판정해야 하면 Git에 추적하지 않는 task-local JSON을 `--input`으로 제공합니다.

```json
{
  "issue": "#123",
  "plan": "tracked owner document 또는 빈 값",
  "outcome": "하나의 공개 계약을 producer와 consumer에 적용한다",
  "acceptance": ["contract, API, Web 소비자 검증이 함께 통과한다"],
  "nonScope": ["독립 visual redesign"],
  "doNotTouch": ["DESIGN.md"],
  "ownerDisposition": {
    "requiredCurrent": ["공개 contract producer와 direct consumer"],
    "prerequisitePredecessor": [],
    "independentFollowUp": [{ "summary": "독립 visual redesign", "issue": "#456" }],
    "unrelatedOrSpeculative": []
  },
  "blockers": [],
  "semantic": {
    "independentOutcomes": 1,
    "sharedAcceptanceAcrossLanes": true,
    "refactorPlusUnrelatedBehavior": false,
    "acceptanceDependsOnUnmergedWork": false,
    "unownedScopeDrift": false,
    "boundaryConflicts": [],
    "mechanicalChange": "",
    "behaviorEvidence": []
  }
}
```

```bash
pnpm git:branch-readiness -- --base origin/dev --input /tmp/branch-readiness.json --json
```

`--base`는 필수입니다. Remote base가 없으면 command는 `git fetch origin dev`를 안내하고 fail-closed합니다. Command는
`git diff`, `git status`, `git ls-files`, `git rev-parse`, `git merge-base`만 사용하며 index와 working tree를 수정하지
않습니다. Uncommitted `doNotTouch` path는 존재 사실을 별도로 보고하고 branch 평가에서는 제외합니다. 이미 current
branch에 commit된 path는 `doNotTouch`로 숨기지 못하며 `scope-audit-required`로 보고합니다.

## Recommendation

| 결과                   | 의미                                                                | 다음 행동                                                     |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `cohesive`             | 선언된 outcome·acceptance·boundary에서 분리 신호가 없음             | selected local gate를 실행하고 PR evidence를 작성             |
| `scope-audit-required` | 여러 lane, 미선언 계약, unowned drift처럼 semantic 확인이 더 필요함 | code·contract·test를 다시 읽고 PR의 `Scope audit`에 결론 기록 |
| `stop-and-split`       | 독립 outcome, predecessor, 충돌 boundary 또는 불완전 blocker가 존재 | push를 멈추고 predecessor/successor Issue·branch·PR로 분리    |

`decisionSource=deterministic`는 명시된 독립 outcome이나 불완전 blocker처럼 입력만으로 결론이 고정된 경우입니다.
`decisionSource=model-mediated`는 lane spread처럼 repository semantics를 읽은 owner review가 필요한 경우입니다. 이때
agent의 제안은 advisory이며 branch owner의 최종 disposition을 대체하지 않습니다.

Policy input이 유효하면 recommendation과 관계없이 exit code는 `0`입니다. 이 command는 arbitrary size gate가 아니기
때문입니다. Base 확인 실패나 malformed input은 `1`, follow-up Issue 또는 blocker evidence가 불완전한 경우는 `2`를
반환합니다.

## 숫자를 gate로 쓰지 않는 이유

- line count와 changed path 수는 review cost를 설명하지만 outcome cohesion을 증명하지 않습니다.
- lockfile과 generated output은 큰 diff를 만들지만 하나의 dependency acceptance일 수 있습니다.
- verified codemod는 큰 diff여도 stable behavior evidence와 한 rollback boundary를 가질 수 있습니다.
- 반대로 몇 줄뿐인 Web/API/Infra 변경도 서로 독립적인 outcome이면 나눠야 합니다.
- commit count는 history context일 뿐 verdict 입력이 아닙니다.

따라서 이 저장소는 quantitative signal을 **context**로 표시하고, split 여부는 acceptance, independent review,
rollback·migration·security·release boundary로 결정합니다.

## Scope audit evidence

`scope-audit-required`가 나오면 PR body에 다음을 한 번 기록합니다.

- signal: 어떤 lane, path 또는 미선언 owner가 audit을 만들었는가
- facts: current code·contract·test에서 확인한 direct dependency
- disposition: 같은 acceptance인지, predecessor인지, follow-up인지
- exclusion: branch에서 제외한 독립 작업과 linked Issue
- confidence/gap: 추론과 미검증 범위

`stop-and-split`을 무시하고 push하지 않습니다. `cohesive`라도 implementation 중 acceptance가 달라지면 다시 실행합니다.

## 사람과 agent의 Git ownership

Branch readiness는 collaboration permission을 만들지 않습니다. 현재 checkout에는 write-capable owner가 하나만 존재하고,
read-only agent만 같은 checkout을 공유할 수 있습니다. 별도 비동기 writer는 fresh branch와 가능하면 별도 worktree를
사용하며 leader가 fan-in과 merge 순서를 소유합니다. 미래에 반복적인 production owner인 인간 contributor가 추가될 때만
CODEOWNERS와 non-author approval을 검토합니다.

## Evidence map

| 질문                                                | Tracked evidence                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 왜 fresh branch를 사용하는가                        | [`branch-and-pr-strategy.md`](./branch-and-pr-strategy.md)의 implementation preflight                |
| 왜 작은 PR을 선호하면서 숫자 제한은 두지 않는가     | 이 문서의 evidence/disposition과 숫자 비-gate 원칙                                                   |
| scope drift는 어떻게 다루는가                       | [`branch-and-pr-strategy.md`](./branch-and-pr-strategy.md)의 four dispositions                       |
| blocker와 follow-up은 어디에 남기는가               | [`issues-and-work-tracking.md`](./issues-and-work-tracking.md)                                       |
| agent 병렬 작업이 branch를 오염시키지 않는가        | branch strategy와 [`orchestration.md`](../agent-workflows/orchestration.md)의 single-writer boundary |
| 어떤 CI를 실행할지 어떻게 정하는가                  | `scripts/ci/classify-changes.mjs`와 pre-PR CI lane preflight                                         |
| guardrail이 size gate로 변하지 않는 근거는 무엇인가 | `scripts/git/branch-readiness.test.mjs`의 semantic·mechanical negative fixtures                      |
