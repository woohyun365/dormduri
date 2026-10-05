# Agent workflow improvement evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 agent workflow 규칙의 owner가 아닙니다. 현재 실행·검증 계약과 host adapter는
> [Agent workflow guides](../../development/agent-workflows/README.md), 결정 기록은
> [Agentic architecture decisions](../../development/agent-workflows/agentic-architecture-decisions.md)가 소유합니다. 설계 서사는
> [Agentic orchestration case study](./agentic-orchestration-case-study.md), 방법론은
> [Agentic Engineering methodology](./agentic-engineering-methodology.md), agent PR의 CI 비용은
> [CI change classification evidence](../ci/ci-change-classification-evidence.md)에 둡니다.

이 문서는 2026-09-27~10-03(#547 merge 전)에 merge된 agent workflow 개선 PR 28개의 품질 신호를 단위별로 기록합니다. 시간·비용의 전후 비교군이
없으므로 생산성이나 작업 시간 절감을 주장하지 않고, 공개 PR 본문·commit·tracked 명령으로 다시 산출할 수 있는 신호만 씁니다.

## 1. 문제와 관측

- Agent workflow는 Codex 한 host를 전제로 자라 왔습니다. 공통 계약과 host adapter를 나누는 작업은 2026-09-26의 준비 PR(#478~#483)
  뒤 공통 계약을 처음 도입한 #484(2026-09-27)부터 여러 PR로 이어졌고, 각 PR의 리뷰 회차·발견한 결함·검증 결과는 PR 본문에만 흩어져 있었습니다.
- 계획 문서와 실행 기록은 추적되지 않는 로컬 파일이라, 완료 뒤 보관 위치로 옮겨지면 근거를 다시 모으기 어렵습니다.
- 그래서 이 문서는 공개 근거만으로 다음 세 가지를 단위별로 다시 산출합니다.
  1. 독립 리뷰가 merge 전에 잡은 결함(PR 본문 기록)
  2. 계약 test의 범위(repository policy test 수)
  3. Merge 뒤 결함(이전 PR을 고친 `fix` PR)

## 2. 측정 방법과 재현 명령

### 대상 PR 집합

2026-09-27부터 #547 merge(2026-10-03T12:31:28Z)까지 `dev`로 merge된 PR 32개 중 다음 28개입니다.

- Title scope가 `agents`·`claude`·`codex`인 25개
- Agent workflow 구조를 바꾼 다른 scope 3개: #494(`workspace`, host runtime state 배치), #541(`github`, agent 독립 검토
  시점), #543(`ci`, agent test 배치)
- 제외 4개: #535·#537·#545(CI 분류·formatting, CI evidence가 소유), #547(`portfolio`, evidence 작성 절차)

```bash
gh pr list --base dev --state merged --search "merged:2026-09-26..2026-10-03" --limit 200 \
  --json number,title,mergedAt,mergeCommit
# mergedAt 2026-09-27T00:00:00Z ~ 2026-10-03T12:31:28Z(#547 merge)로 자르면 32개, 그중 title scope로 25개를 고른다.
```

시작일은 공통 계약을 처음 도입한 #484의 merge일입니다. 그 전날 merge된 준비 PR(#478~#483: 도구 중립 계약 준비, 교차 모델 QA
handoff, 호스트별 script 경계 분리 등)은 범위 밖이고, §3 baseline도 그 뒤 시점입니다.

변경 경로(`scripts/agents/**` 등)로 고르면 test·문서만 바꾼 #491을 놓치고 CI PR #545가 들어오므로 쓰지 않았습니다.

### 독립 리뷰 기록

- 원천은 각 PR 본문의 "Review evidence" 항목입니다. 28개 모두 GitHub review 기능 기록과 comment가 0개이고, 리뷰 기록은
  본문 텍스트에만 있습니다. 명령: `gh pr view <n> --json body,reviews,comments`.
- 구현 리뷰(source·문서 diff)와 readiness 리뷰(구현 전 계획 검토)를 나눕니다.
- 첫 구현 회차가 FAIL·REVISE·coverage gap FAIL이면 non-PASS로 셉니다. 판정어 없이 finding 보정 뒤 delta PASS만 적힌 경우는
  non-PASS(추정)으로 표시합니다.
- Severity는 본문에 medium·high·critical로 **적힌 것만** 셉니다. 적히지 않았거나 다른 척도(#484 "P2")를 쓴 경우는 "미기재"로
  표기합니다.

### 계약 test 범위

단위 경계 commit마다 일회용 worktree에서 그 commit의 repository policy test를 실행합니다.

```bash
git worktree add --detach /tmp/rp-<sha> <sha>
ln -s "$PWD/node_modules" /tmp/rp-<sha>/node_modules
(set -o pipefail; cd /tmp/rp-<sha> && node scripts/ci/run-repo-policy.mjs | grep -E '^ℹ (tests|pass|fail) '); echo "exit=$?"
rm /tmp/rp-<sha>/node_modules && git worktree remove --force /tmp/rp-<sha>
```

모든 시점에서 exit 0, fail 0입니다. 교차 확인: `d534b32d`의 906은 #485 본문의 "repo-policy 906/906", `ba0ea71a`의 1,238은
[CI change classification evidence](../ci/ci-change-classification-evidence.md)의 1,238/1,238과 같습니다.

### Merge 뒤 결함(escape)

- 대상 28개 안의 `fix` type PR(#500, #506, #508, #532)과 연결 issue(`gh issue view 499|505|507|531`)에서 결함을 읽고, 원인 commit을
  추적합니다.

  ```bash
  git log -S"SendMessage" b6f484ec..5e17bd55^ -- scripts/agents/claude
  git log b6f484ec..8f1b9dd0^ -- scripts/agents/claude/native-task-helper.mjs
  git log --follow -- scripts/agents/common/intake-policy.mjs
  git show --name-status -M d534b32d
  ```

- 이전 merge PR이 도입한 동작을 merge 뒤 관측으로 고쳤으면 escape입니다. 원인 PR이 merge 시점 본문에 그 gap을 한계로
  공개했으면 escape가 아닙니다. 대상 밖 `fix` PR(#537, CI 분류기의 규칙 없는 경로 fail-open)은 CI evidence가 소유하며 이
  집계에 넣지 않습니다. 원인이 window(2026-09-27) 이전이면 "window 밖 기원"으로 따로 셉니다.
- 원인 PR이 여럿이면 fix PR 기준 1건으로 세고, §6에서 원인 PR마다 표시합니다.

## 3. Baseline

| 시점                      | Commit     | Repository policy test |
| ------------------------- | ---------- | ---------------------: |
| 공통 계약 도입 직전(#483) | `b6f484ec` |                    703 |

이 시점의 agent workflow는 Codex 전용 규칙과 공통 규칙이 같은 문서에 섞여 있었습니다. 그 구조와 당시 실패 사례는
[Agentic orchestration case study](./agentic-orchestration-case-study.md)에 있습니다.

## 4. 원인

- 근거가 흩어진 원인: 리뷰 결과를 GitHub review 기능이 아니라 agent가 작성하는 PR 본문에 남기는 운영이고, 회차·severity 표기
  형식이 PR마다 달랐습니다(§2 독립 리뷰 기록의 "미기재" 처리).
- 단위별 설계 문제(host 의존 규칙, 위임·정산 경로 우회 등)와 해결 과정의 서사는 case study가 소유하며 여기서 다시 쓰지 않습니다.

## 5. 대안과 기각

### 기각

- **Session transcript의 token 집계를 비용 근거로 사용:** transcript는 로컬에만 있고 provider metadata가 비어 있어 다시 산출할
  수 없습니다.
- **Host keyword 후보 수를 누수 정리 지표로 사용:** §7에 이유가 있습니다.
- **Evidence 생략:** 시간·비용 비교군이 없어도 리뷰 기록·test 수·escape는 공개 근거로 다시 산출할 수 있습니다.

### 채택한 운영 선택(효과는 주장하지 않음)

- 구현 전 readiness 리뷰: 계획 단계에서 contract를 독립 검토합니다(#494, #510~#520, #526).
- 연속 non-PASS의 quality stop: 같은 대상이 연속으로 PASS가 아니면 Owner가 다음 행동을 정합니다(#504).
- 첫 push 전 독립 검토: CI를 다시 돌리는 비용을 줄이려고 리뷰를 push 앞에 둡니다(#541).

## 6. 개선별 전후 측정

열 설명: **구현 회차**는 구현 리뷰 수, **첫 회차**는 첫 구현 리뷰 결과, **medium+**는 본문에 적힌 구현 리뷰 medium 이상
finding 수, **readiness**는 readiness 리뷰 회차(괄호 안은 non-PASS 회차 / 적힌 medium 이상), **escape**는 이 PR이 원인이 된 merge 뒤 결함입니다.
리뷰 열은 단위를 가로지르는 합계·백분위를 싣지 않습니다(§7).

### 호스트 중립 공통 계약(#484)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+                   | readiness | escape |
| ---- | ---------- | --------: | -------- | ------------------------- | --------- | ------ |
| #484 | `2b77f769` |         2 | non-PASS | 미기재(P2 3건, 다른 척도) | -         | -      |

Repository policy test: 703 → 832(`2b77f769`).

### Codex 공통 계약 접합(#485)

| PR   | Merge      | 구현 회차      | 첫 회차        | medium+ | readiness | escape |
| ---- | ---------- | -------------- | -------------- | ------- | --------- | ------ |
| #485 | `d534b32d` | 미기재(2 이상) | non-PASS(추정) | 미기재  | -         | -      |

Repository policy test: 832 → 906(`d534b32d`).

### Claude 공통 workflow adapter(#487, #489)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+ | readiness | escape     |
| ---- | ---------- | --------: | -------- | ------- | --------- | ---------- |
| #487 | `4acd279c` |         8 | non-PASS | 미기재  | -         | #508(hook) |
| #489 | `2e7f37b8` |      생략 | -        | -       | -         | -          |

- Repository policy test: 906 → 1,119(`4acd279c`).
- #489는 문서·test 목록만 바꿔 독립 리뷰를 생략했습니다. 그 troubleshooting 서술 하나를 다음 날 #491이 날짜가 있는 관측으로
  정정했습니다. `fix` type이 아니라 escape 수에는 넣지 않습니다.

### Claude adapter 운영 계층(#491~#506)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+ | readiness   | escape             |
| ---- | ---------- | --------: | -------- | ------: | ----------- | ------------------ |
| #491 | `b0d3c348` |         3 | non-PASS |       2 | -           | -                  |
| #494 | `40967a13` |         1 | PASS     |       0 | 4(4/미기재) | -                  |
| #496 | `795367e9` |         3 | non-PASS |       0 | -           | #506, #508(helper) |
| #498 | `f74c0211` |         2 | non-PASS |       1 | -           | -                  |
| #500 | `04949ea7` |         2 | non-PASS |       1 | -           | -                  |
| #502 | `c4763a8e` |         3 | non-PASS |       1 | -           | -                  |
| #504 | `15a3e00c` |         4 | non-PASS |       3 | -           | -                  |
| #506 | `8f1b9dd0` |         4 | non-PASS |  미기재 | -           | -                  |

- Repository policy test: 1,119 → 1,068(`8f1b9dd0`). 감소는 #498이 legacy headless qualification test 파일 3개를 경로와 함께
  삭제한 결과입니다(`git diff --diff-filter=D --name-only b0d3c348 8f1b9dd0 -- scripts/ci`).
- #504는 r1~r3이 FAIL(각 medium 1)이라 quality stop 뒤 r4에서 PASS했습니다.
- #500은 `fix`지만 원인 `7a83166f`(2026-08-13)가 window 밖이라 단위 escape가 아닙니다. #485의 같은 파일 변경은 100% rename입니다.

### Claude native 실행 개선(#508~#532)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+ | readiness                    | escape |
| ---- | ---------- | --------: | -------- | ------: | ---------------------------- | ------ |
| #508 | `5e17bd55` |         2 | PASS     |       0 | -                            | -      |
| #510 | `bd71f228` |         3 | non-PASS |       1 | 3 이상(r3 PASS, 이전 미기재) | -      |
| #512 | `7fb45b53` |         1 | PASS     |       0 | 3(2/3)                       | -      |
| #514 | `c60cdf92` |         1 | PASS     |       0 | 2(1/2)                       | -      |
| #516 | `2c2ca211` |         1 | PASS     |       0 | 3(2/4)                       | -      |
| #518 | `6db313f4` |         1 | PASS     |       0 | 3(2/3)                       | -      |
| #520 | `100bedad` |         2 | PASS     |       0 | 4(4/미기재)                  | -      |
| #522 | `8d208174` |         3 | non-PASS |       1 | -                            | -      |
| #524 | `c578a3a2` |      생략 | -        |       - | -                            | -      |
| #526 | `f32a83f0` |         2 | non-PASS |       0 | 2(2/5, high 1 포함)          | -      |
| #528 | `408d250d` |         2 | non-PASS |       1 | -                            | -      |
| #530 | `1fec6e84` |         1 | non-PASS |       0 | -                            | #532   |
| #532 | `0eafa5cd` |         2 | non-PASS |       1 | -                            | -      |

- Repository policy test: 1,068 → 1,175(`0eafa5cd`).
- #530은 첫 회차가 coverage gap FAIL이었고 PASS 회차 없이 Parent 교차 참조로 마감했습니다. 그 채택 결과와 어긋난 skill 사본을
  예정된 사후 재평가가 찾아 #532가 고쳤습니다. 단위가 끝나기 전에 잡은 escape입니다.
- #524는 모델 ID 문자열만 바꾸고 contract test가 값을 고정해 독립 리뷰를 생략했습니다.

### Plan 영향 목록 도구(#539)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+ | readiness | escape |
| ---- | ---------- | --------: | -------- | ------: | --------- | ------ |
| #539 | `e6a4973b` |         6 | non-PASS |       3 | -         | -      |

Repository policy test: 1,175 → 1,238(`e6a4973b`). 이 구간에는 CI PR #535·#537도 있어 증가분을 #539에 모두 돌리지 않습니다.

### 독립 검토 시점(#541)과 agent test 배치(#543)

| PR   | Merge      | 구현 회차 | 첫 회차  | medium+ | readiness | escape |
| ---- | ---------- | --------: | -------- | ------: | --------- | ------ |
| #541 | `8d3df120` |         2 | PASS     |       0 | -         | -      |
| #543 | `ba0ea71a` |         2 | non-PASS |       1 | -         | -      |

- Repository policy test: 1,238(`8d3df120`, `ba0ea71a` 모두). #543의 test 이동 동등성은
  [CI change classification evidence](../ci/ci-change-classification-evidence.md#agent-test-배치543-동등성)에 있습니다.
- #541의 r2 delta는 증거 공백으로 FAIL이었고 Parent 교차 참조로 마감했습니다.

### Merge 뒤 결함 요약

| fix PR | 결함                                                                                       | 원인 PR    | 발견 경로                            |
| ------ | ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------ |
| #508   | hook 예외가 비관리 SendMessage·child 정산을 막음, reviewer prompt에 severity 허용값이 없음 | #487, #496 | live 사용(issue #507)                |
| #506   | read-only subject 리뷰와 RED exit 기록을 지원하지 않음                                     | #496       | merge 뒤 live(#502 기록, issue #505) |
| #532   | skill의 routine 표 사본이 #530 채택과 어긋남                                               | #530       | 예정된 사후 재평가(issue #531)       |

28개 PR 기준 escape는 fix PR 3건이고, window 밖 기원 1건(#500)은 따로 둡니다. 표본이 작아 비율·추세를 주장하지 않습니다.
이후 측정 기준의 repository policy test는 1,250(`79dd3511`)이며, 증가분 12개는 CI PR #545의 test입니다.

## 7. 한계와 재측정 조건

- **비교군 없음:** 생산성, 작업 시간 절감, token 절감, 동등 품질을 주장하지 않습니다. Task별 token·비용은 provider metadata가
  비어 있고 session transcript는 로컬에만 있습니다.
- **자기 보고:** 리뷰 기록은 변경을 작성한 agent가 PR 본문에 적은 텍스트입니다. 정산 receipt(관측 오류 0 등)는 공개되지 않은
  로컬 실행 기록에만 있어, 본문에 적힌 문장만 인용합니다.
- **표기 차이:** 회차 수(#485, readiness #510)나 severity(#484·#485·#487·#506, readiness #494·#510·#520)를 적지 않은 PR이 있어
  "미기재"로 둡니다. #485의 첫 회차는 판정어가 없어 추정입니다.
- **리뷰 기록 집계:** 단위를 가로지르는 회차 분포·finding 기원은 검증 layer case study에서 다룰 예정이며 이 문서에 싣지 않습니다.
- **Test 수는 품질이 아님:** 계약 test 수는 회귀를 막는 범위의 대리 지표입니다. 삭제(#498)와 다른 PR의 test(#535·#537·#545)가
  섞여 있습니다. 과거 commit은 현재 checkout의 `node_modules`로 실행했습니다.
- **Host keyword 후보 수는 개선 지표가 아님:** `docs/development` 문서의 host keyword(`codex`·`omx` 등) 후보 줄 수는 결함이 아니라
  keyword를 세고, 같은 기간 대상 문서 수도 늘었습니다. 감소를 기대하는 지표로 쓸 수 없어 수치를 싣지 않습니다.
- **Escape 범위:** `fix` type PR만 셉니다. `fix`가 아닌 PR 안의 수정과 #547 merge(2026-10-03T12:31:28Z) 이후의 후속 수정은 세지
  않았습니다.
- **재측정 조건:** 리뷰 기록 형식이 고정되거나 tracked 측정 도구가 생기면 §6 리뷰 열을 그 도구로 다시 산출합니다. #547 merge
  이후 이 단위들을 고친 `fix` PR이 생기면 escape 표에 추가합니다.

## 8. Interview evidence map

| 질문                                          | 근거 절 |
| --------------------------------------------- | ------- |
| 시간 비교 없이 개선을 어떻게 보여 주는가      | §1, §2  |
| 리뷰가 merge 전에 무엇을 잡았는가             | §6      |
| Merge 뒤에 무엇이 새어 나갔고 어떻게 찾았는가 | §6      |
| 어떤 지표를 쓰지 않기로 했고 왜인가           | §5, §7  |
| 수치를 어떻게 다시 산출하는가                 | §2      |
