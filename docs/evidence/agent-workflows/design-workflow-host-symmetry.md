# Design workflow host symmetry evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 디자인 workflow 규칙의 owner가 아닙니다. 현재 규칙은
> [Visual design workflow](../../development/agent-workflows/visual-design/README.md)와
> [디자인 skill 경계](../../development/agent-workflows/visual-design/design-task-orchestration.md#디자인-skill-경계)가,
> 회귀 검사는 [adapter contract test](../../../scripts/ci/agents/common/agent-native-adapter-contract.test.mjs)가 소유합니다.

이 문서는 두 host(Claude Code·Codex)가 같은 디자인 요청에서 다른 경로를 타던 구조를 하나의 공통 계약으로 통일한 기록입니다.
측정 기준일은 2026-10-22이고, base는 `dev`의 `175b582e`, 변경은 issue #668 branch의 RED commit `14092c5f`와 GREEN commit
`f3f8a58d`입니다. 시각 품질·작업 시간의 개선은 비교군이 없어 주장하지 않고, 다시 산출할 수 있는 품질 신호만 씁니다.

## 1. 문제와 관측

- 같은 디자인 요청에서 Codex는 외부 skill 두 개(`design-taste-frontend`, `redesign-existing-projects`)로 routing했고 Claude는
  공통 계약의 direct path를 탔습니다. 공통 visual 문서의 작업 표에 host 이름으로 나눈 routing 줄 두 개가 있었고, 두 adapter에
  host 전용 visual 절이 하나씩 있었습니다.
- 그 routing의 근거가 약해졌습니다. 문서가 고정한 upstream revision `c184364c`는 2026-10-22 기준 upstream main(`6010f91a`)보다
  80 commit 뒤였고 upstream main에는 `skills/redesign-skill`이 없었습니다. 남은 효과 근거는 2026-09-25 합성 HTML fixture 관측
  하나였고, 사람의 선호는 수집하지 않았습니다.
- 회귀 test가 비대칭 문장 자체를 고정했습니다. 옛 test는 "Codex-only" 문장을 `assert.match` 세 개로 확인해, 통일하려면 test를
  고쳐야 했고 반대로 다른 문서에 host 전용 문장이 새로 들어와도 막지 않았습니다.

## 2. 측정 방법과 재현 명령

세 revision(base `175b582e`, RED `14092c5f`, GREEN `f3f8a58d`)을 저장소 밖 독립 clone에서 각각 checkout해 쟀습니다.

```bash
# 판정 grep: 제거한 skill id·upstream 경로·task-fit 표기가 남은 tracked 줄
git grep -n -I -E 'design-taste-frontend|redesign-existing-projects|taste-skill|redesign-skill|Codex 전용 visual|task-fit' \
  <rev> -- ':!pnpm-lock.yaml'
# 공통 orchestration 문서의 host 이름 routing 줄(`Codex:`·`Claude:`)
git grep -c -P '\b(?:Codex|Claude)\s*:' <rev> -- docs/development/agent-workflows/visual-design/design-task-orchestration.md
# guard와 관련 계약 test
node --test scripts/ci/agents/common/agent-native-adapter-contract.test.mjs \
  scripts/ci/agents/common/visual-design-workflow-contract.test.mjs \
  scripts/ci/agents/claude/claude-adapter-structure.test.mjs scripts/ci/agents/codex/codex-adapter-structure.test.mjs \
  scripts/ci/agents/common/agent-document-graph.test.mjs scripts/ci/contracts/readme-responsibility.test.mjs
# upstream 차이(2026-10-22)
gh api repos/Leonxlnx/taste-skill/compare/c184364c58658b2f131b4ae8bd3d206cabb3deee...main --jq .ahead_by
```

- guard ① 대상 줄 수는 RED commit에서 새 guard test가 옛 문서에 실패하며 보고한 줄 목록으로 셉니다.
- 변이는 GREEN commit의 독립 clone에 한 줄씩 넣고 위 여섯 test 파일을 돌려 실패한 test 이름을 기록했습니다. 한 변이마다
  clone을 되돌렸습니다.

## 3. Baseline

base `175b582e`의 값입니다.

| 신호                                                          | 값                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 판정 grep tracked 줄                                          | 27(문서 15, fixture 4, test 8)                                                                 |
| guard ① 대상 줄(visual-design 문서 8개·두 adapter·두 fixture) | 8(제거한 id hit 8, Codex 전용 visual 문장 hit 2)                                               |
| orchestration host 이름 routing 줄                            | 2                                                                                              |
| adapter의 host 전용 visual 절                                 | 2                                                                                              |
| 비대칭을 고정한 단언                                          | Codex-only 문구 `assert.match` 3개, `.claude/skills/<id>` 비존재·ignore 단언(2 skill × 3 파일) |
| 관련 test 여섯 파일                                           | 61개 통과                                                                                      |
| visual corpus                                                 | 44개                                                                                           |

## 4. 원인

- 2026-09 visual skill 채택이 Codex에 두 skill을 설치·routing하는 절과 그 관측 절을 공통 visual 문서에 넣었습니다
  (#476 `3b078b7e`). 이어 Claude adapter를 준비하며 orchestration 문서에 "Codex 전용" 문장이 들어갔고(#478 `9151a214`), Claude
  쪽 채택을 되돌린 PR이 그 비대칭을 회귀 의도로 test에 고정했습니다(#479 `dc9be439`).
- host 차이가 adapter가 아니라 공통 visual 문서의 routing 행으로 들어가, 공통 계약 문서가 host마다 다른 절차를 소유했습니다.
- 검사가 금지가 아니라 특정 문장의 존재를 확인했기 때문에, 비대칭이 문서 전체로 퍼지는 것은 막지 못하고 되돌리는 변경만 막았습니다.

## 5. 대안과 기각

| 대안                                               | 기각 이유                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 두 host 모두 taste-skill 최신판으로 이전           | 실행 환경 수준의 설치·Home 쓰기·정책 충돌이 생기고, upstream이 skill 하나를 이미 지웠습니다 |
| Claude에 frontend-design plugin 설치               | 비대칭을 방향만 바꿔 반복하고 Home 설정을 바꿉니다                                          |
| 관측 절을 몇 문장으로 축약하거나 evidence로 이동   | owner 문서는 현재 책임만 소유합니다. 원본 관측은 로컬 증거로 남습니다                       |
| corpus fixture 삭제(44→43)                         | "어떤 skill을 쓸까"라는 흔한 질문에 공통 계약으로 답하는 회귀 사례가 사라집니다             |
| 같은 문장을 두 adapter에 두고 pin                  | 문구 고정을 줄이려는 방향과 반대이고, adapter는 host binding만 소유합니다                   |
| 금지 목록 하나만                                   | 한 skill root에만 visual skill을 두는 회귀와 host 이름 routing 줄의 회귀를 막지 못합니다    |
| README 결정 목록에 원본 한 줄과 orchestration 상세 | 같은 뜻이 두 곳에 나뉩니다                                                                  |

고른 구조는 공통 orchestration 문서의 "디자인 skill 경계" 절 하나와 규칙별 구조 검사 셋입니다.

- ① 금지 목록: visual-design 문서·두 adapter·두 fixture에 제거한 두 id와 Codex 전용 visual 문장이 없습니다.
- ② skill root 대칭: `.claude/skills`·`.agents/skills`의 추적 skill 가운데 이름에 design·visual·ui·taste가 든 것은 두 root에 모두 있습니다.
- ③ host routing: 공통 orchestration 문서에 host 이름 뒤 쌍점으로 나눈 routing 줄이 없습니다.

## 6. 개선별 전후 측정

| 신호                               | base `175b582e` | RED `14092c5f`     | GREEN `f3f8a58d`                       |
| ---------------------------------- | --------------- | ------------------ | -------------------------------------- |
| 판정 grep tracked 줄               | 27              | 21                 | 2(guard test의 금지 목록·합성 사례 줄) |
| guard ① 대상 줄                    | 8               | 8(guard test 실패) | 0                                      |
| orchestration host 이름 routing 줄 | 2               | 2(guard test 실패) | 0                                      |
| adapter의 host 전용 visual 절      | 2               | 2                  | 0                                      |
| Codex-only 문구 `assert.match`     | 3               | 0                  | 0                                      |
| 규칙별 구조 검사 test              | 0               | 3                  | 3                                      |
| 관련 test 여섯 파일                | 61 통과         | 63 중 4 실패       | 63 통과                                |
| visual corpus                      | 44              | 44                 | 44                                     |

- RED에서 실패한 네 test는 guard ①(8줄), guard ③(2줄), 새 절 단언(heading 없음), corpus 행(fixture id 없음)이었고, guard ②와
  세 guard의 합성 사례는 통과했습니다.
- 문서 diff(base → GREEN)는 5개 파일 21줄 추가·81줄 삭제입니다. 이 문서가 더해진 뒤의 판정 grep은 이 문서의 전후 서술 줄을
  허용 잔여로 둡니다.
- 합성 사례: ① 5줄(규칙마다 실패해야 할 줄과 통과해야 할 줄), ② 목록 2개, ③ 4줄을 test 안에 둡니다.

규칙별 변이(GREEN commit의 독립 clone, 한 줄씩)입니다.

| 넣은 줄                                          | 파일                                         | 실패한 test                         |
| ------------------------------------------------ | -------------------------------------------- | ----------------------------------- |
| 제거한 id를 쓰는 visual 문장                     | `adapters/claude-code.md`                    | guard ①만                           |
| id 없이 "Visual 작업은 Codex 전용" 문장          | `adapters/codex.md`                          | guard ①만                           |
| visual 낱말 없는 "Codex 전용" 문장               | `visual-design/README.md`                    | guard ①만                           |
| `Codex:`로 시작하는 routing 줄                   | `visual-design/design-task-orchestration.md` | guard ③만                           |
| visual 낱말 없는 Codex 전용 명령 문장(음성 대조) | `adapters/claude-code.md`                    | 없음                                |
| README의 새 절 링크 anchor를 틀린 slug로         | `visual-design/README.md`                    | document graph의 link/anchor test만 |

merge 전 독립 리뷰의 회차·verdict·finding 처분은 issue #668 PR 본문의 Verification 절이 원본입니다.

## 7. 한계와 재측정 조건

- guard는 추적 문서의 문장과 skill 이름 집합만 봅니다. 두 host의 agent가 실제로 같은 경로를 타는지는 증명하지 않습니다.
- ①은 Owner가 고른 범위대로 id만 봅니다. 표시 이름(`Taste`·`Redesign`)만 다시 들어오면 잡지 않고, 판정 grep과 리뷰가 봅니다.
- ②의 `ui`는 부분 문자열이라 이름에 `ui`가 든 비시각 host 전용 skill(`guide`·`build` 등)도 걸립니다. 지금 추적 skill 이름에는 없습니다.
- 이 변경은 Home을 바꾸지 않습니다. 저장소 밖 Codex 개인 설치본을 옮기기 전까지 Codex는 그 skill 설명을 보고 스스로 고를 수
  있습니다. 다시 잴 조건은 다음 Codex 세션의 skill 목록입니다.
- 시각 품질·작업 시간·token의 변화는 비교군이 없어 재지 않았습니다.
- 다시 잴 때: 외부 디자인 skill을 저장소에 들일 때, skill root 위치가 바뀔 때, guard 범위를 넓힐 때.

## 8. Interview evidence map

| 질문                                                | 답의 근거       |
| --------------------------------------------------- | --------------- |
| 한 host에만 쓰던 디자인 skill routing을 왜 지웠는가 | §1, §4          |
| 문장 고정 test를 왜 규칙별 구조 검사로 바꿨는가     | §1, §5, §6 변이 |
| skill 도입 경계는 어디에 남았는가                   | §5, owner 링크  |
| 이 guard가 증명하지 않는 것은 무엇인가              | §7              |
