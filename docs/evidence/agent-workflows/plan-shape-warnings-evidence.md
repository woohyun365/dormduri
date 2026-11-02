# Plan shape warnings and impact spec remap evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 plan 작성 규칙의 owner가 아닙니다. Plan 첫 화면·Status·결정 칸 규칙은
> [Plan authoring core](../../development/agent-workflows/plan-authoring/core.md#6-required-plan-structure), 경고를 돌리는 자리는
> [Session continuity](../../development/agent-workflows/session-continuity.md#계획-초안-staging과-promote), spec 줄 대응 절차는
> [Plan 영향 목록 누락](../../development/troubleshooting/tooling/agent-plan-impact-inventory-misses.md#script-사용)이 소유합니다.

이 문서는 바뀐 plan 파일에 모양 경고 넷을 내는 `plan-shape-check.mjs`와, `plan:impact` spec의 줄 번호를 다음 revision으로 옮기는
`plan-impact-remap.mjs`(작업 issue #816, 요청 issue #727·#730·#771)의 측정 기록입니다. 기준 commit은 `0d949dfd`(변경 전 `dev`)와
`b78f3f6e`(module commit)이고, 줄 대응 사례는 제품 PR #799의 리뷰 fix 범위 `4f790444..9303af7a`입니다. 측정은 2026-11-02, Node
26.13.0·git 2.55.0에서 했습니다.

## 1. 문제와 관측

- Plan 첫 화면이 계속 커졌습니다. 끝나지 않은 로컬 plan(메인 checkout 27개, 제품 checkout 3개)에서 header(첫 fence 밖 `## ` 줄 앞)
  4,000자 초과는 메인 3·제품 2, Status 줄 600자 초과는 메인 1·제품 2였습니다. 가장 큰 제품 plan은 header 8,462자·Status 3,780자이고,
  2026-10-31 측정(로컬 기록)에서 같은 plan은 5,998자·2,269자였습니다. 경고가 없는 동안 고쳐 쓰기보다 덧붙이기가 이어졌습니다.
- 결정 표에 날짜 붙은 변경 표시(`(2026-10-28 개정`, `2026-10-16 D-…로`)가 쌓였습니다. 메인 3 plan 11행, 제품 2 plan 8행입니다.
- 2026-10-18에 한 번 정리하기 전 OSS program plan 사본은 네 종류가 모두 걸립니다(header 1·Status 1·Status 하위 bullet 1·날짜 표시 17).
- `plan:impact` spec의 분류 행·추가 행·override·계약 줄 selector·regression은 `path:줄`로 묶입니다. PR이 파일을 고치면 STALE과 새
  미분류가 함께 나옵니다. 제품 PR #798·#799는 구현 뒤와 리뷰 fix 뒤 spec을 손 script로 네 번 옮겼습니다.

  | PR   | 회차        | move 줄 | drop 줄 |
  | ---- | ----------- | ------- | ------- |
  | #798 | 구현 뒤     | 2       | 30      |
  | #798 | 리뷰 fix 뒤 | 3       | 30      |
  | #799 | 구현 뒤     | 15      | 193     |
  | #799 | 리뷰 fix 뒤 | 13      | 0       |

  표는 제품 작업의 로컬 손 remap log에서 센 `move row`·`drop row` 줄 수입니다(공개 재현 불가). #798 1회차 drop 30 가운데 1행은 바뀐 줄이 아니라 pattern에서 빠진 행이고,
  #799 1회차 값에는 추가 행 move 1·drop 5 이상이 섞였습니다(그 회차의 옮기기 전 spec이 남지 않아 하한만 셌습니다).

- 분류 행은 두 PR 모두 바뀐 줄의 행을 빼고 나머지를 hunk로 옮겼고, 다른 입력은 달랐습니다. #798은 추가 행의 바뀐 줄만 목록에서 빼고
  바뀐 줄에 걸린 regression 7행을 새 줄로 옮겼습니다. #799 script는 추가 행도 분류 행처럼 시작·끝 줄만 보고 행 전체를 빼거나 옮겼고,
  계약 줄 범위는 남은 줄의 처음~끝으로 줄였습니다. #799 1회차에는 script 출력 뒤 손 대응 줄 10개(regression 1, 계약 8, pattern 1)가
  따로 있습니다. 두 PR 모두 바뀐 줄에 걸린 regression 검사를 손으로 살렸습니다.

## 2. 측정 방법과 재현 명령

- 경고: readiness 때 Python으로 쓴 참조 계산(같은 정의, module과 독립 구현)과 module 출력을 같은 plan 파일에서 줄 단위로 비교했습니다.
  대상 plan은 로컬 계획 문서라 공개 재현은 불가하고, 명령과 정의는 아래와 같습니다.
- 넷째 경고 기준: 2026-10-18 결정 칸 날짜 분류 표 97개(주석 5, 날짜 붙은 변경 표시 23, 경위 메모 5, 출처 날짜 64)에서 후보 셋의 정밀도와
  재현율을 쟀습니다(로컬 기록, 공개 재현 불가).
- 줄 대응: 저장소 밖 독립 clone에서 `refs/pull/799/head`를 받아, 제품 spec의 고정 사본(리뷰 fix 전 spec)을 module로 옮긴 결과를 제품
  script 결과와 파일·행 단위로 비교했습니다. 같은 clone의 `9303af7a` tree에서 옮기기 전·뒤 spec으로 `plan:impact`를 돌렸습니다.
- 변이: 독립 clone에서 `mutation-harness.mjs`로 비교식·경계값·kind 판정·fence·멈춤 조건(경고), hunk 해석·행 처리·diff 설정·실행
  환경·입력 검사(줄 대응)를 하나씩 바꿔 test가 실패하는지 봤습니다.

```bash
# 경고(바뀐 plan 파일)
node scripts/agents/common/plan-shape-check.mjs [--json] <plan md...>

# 줄 대응(제품 PR #799 리뷰 fix 범위)
git fetch https://github.com/woohyun365/dormduri.git refs/pull/799/head
node scripts/agents/common/plan-impact-remap.mjs --spec <spec> --from 4f790444 --to 9303af7a --out <new spec>
git checkout --detach 9303af7a && pnpm plan:impact -- --spec <new spec> --out <dir>

# test와 변이
node --test scripts/ci/agents/common/plan-shape-check.test.mjs scripts/ci/agents/common/plan-impact-remap.test.mjs \
  scripts/ci/agents/common/plan-readiness-policy.test.mjs
node scripts/agents/common/mutation-harness.mjs --spec <mutation JSON> --root <clone>
```

## 3. Baseline

| 항목                          | 값(`0d949dfd`)                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| 바뀐 plan의 모양 확인         | 없음. 리뷰어가 읽을 때만 드러남                                                                          |
| Plan 첫 화면·결정 칸 규칙     | 필드 목록(Plan ID, status 등)만 있고 Status 한 줄·결정 칸 고쳐 쓰기·개정 이력 자리는 없음                |
| Readiness 강도 어휘           | `deterministic-static`·`advisory-policy`·`model-mediated`·`native-runtime`. `human-judgment`는 입력 거부 |
| `plan:impact` spec 줄 이동    | PR마다 손 script. 지침은 "밀린 범위가 같은 내용을 가리키는지 다시 확인"                                  |
| 새 파일을 계약 대상에 넣는 법 | stage 또는 `git add -N` 뒤 tracked 목록 기반 검증 재실행                                                 |

## 4. 원인

- Plan 문서 규칙에 첫 화면과 결정 칸의 모양이 없었습니다. 개정마다 Status 뒤와 결정 칸에 날짜를 붙여 덧붙이는 쪽이 쉬웠고, 그 결과를
  보여 주는 검사도 없었습니다.
- `plan:impact` spec은 줄 번호에 묶이는데 줄 번호를 옮기는 도구가 없었습니다. 손 script는 PR마다 규칙이 달라져 같은 경우를 다르게
  처리했습니다(1절).

## 5. 대안과 기각

| 결정                  | 채택                                                                                                                                                                    | 기각과 이유                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 넷째 경고 기준        | 날짜 뒤 변경 낱말 또는 결정 id: 주석 5/5, 변경 표시 15/23, 경위 메모 1/5, 출처 오탐 1/64                                                                                | 리터럴 `YYYY-MM-DD 주석`(변경 표시 0/23), 괄호 안 첫 날짜(주석 4/5)                                                                                                                                                                                                                                                       |
| 임계값                | header 4,000자·Status 600자                                                                                                                                             | 3,000·400(메인 27개에서 header 7·Status 7 plan이 걸림)                                                                                                                                                                                                                                                                    |
| 경고 효과             | 목록·exit 0, 의도한 예외는 runner 기록에 이유                                                                                                                           | guard(오탐률 표본이 없음)                                                                                                                                                                                                                                                                                                 |
| 결정 기록(코드 본문)  | 규칙 문장만                                                                                                                                                             | 다섯째 경고(구현 언어 fenced block이 있는 plan이 보류 plan 1개뿐)                                                                                                                                                                                                                                                         |
| `human-judgment` 수용 | validator 두 목록과 그 test                                                                                                                                             | contract test·fixture까지(문구 고정 test 증가), 문서만(validator가 입력을 거부)                                                                                                                                                                                                                                           |
| spec 줄 대응          | 새 module이 다섯 입력을 hunk로 옮기고, 바뀐 줄·지운 파일 행은 `dropped`, 줄인 행은 `narrowed`로 출력                                                                    | 문서 절차만·뒤 PR·기록만(손 script가 계속 남음), `plan-impact.mjs`의 `--remap`(811줄 module과 652줄 test가 범위에 듦), 공백 정규화(내용이 바뀐 줄의 분류가 남을 수 있음), 바뀐 regression 줄을 hunk 같은 자리로 옮기기(내용이 다를 수 있음), 바뀐 줄이 있는 행은 모두 빼기(계약 행 대부분이 빠짐)                         |
| diff 실행 환경        | 명령줄에 hunk 관련 설정(algorithm·indent heuristic 포함)과 `-c diff.autoRefreshIndex=false`·`-c core.fsmonitor=false`를 고정하고 호출 환경의 `GIT_*` 변수를 넘기지 않음 | `--no-optional-locks`만(git 2.55에서 stat만 바뀐 파일의 working tree 비교가 index stat을 다시 씀), hook 환경 상속(일회용 저장소에서 fsmonitor hook 3회 실행, ambient `GIT_INDEX_FILE`로 `dropped` 0 → 11), clean·process filter 끄기(working tree 내용을 정하는 설정이라 filter가 있는 파일은 모든 줄이 바뀐 것으로 나옴) |

## 6. 개선별 전후 측정

### 경고: 참조 계산과 module 출력(`b78f3f6e` 이후 같은 module)

| 대상                         | 참조 계산 경고 줄                    | module 경고 줄 | 비교         |
| ---------------------------- | ------------------------------------ | -------------- | ------------ |
| 메인 checkout 27 plan        | 15(header 3·Status 1·하위 0·날짜 11) | 15             | 줄 단위 같음 |
| 제품 checkout 3 plan         | 12(header 2·Status 2·하위 0·날짜 8)  | 12             | 줄 단위 같음 |
| 2026-10-18 정리 전 plan 사본 | 20(header 1·Status 1·하위 1·날짜 17) | 20             | 줄 단위 같음 |

### 줄 대응: 제품 PR #799 리뷰 fix 범위

| 항목                                 | 손 script                          | module                                   |
| ------------------------------------ | ---------------------------------- | ---------------------------------------- |
| 옮긴 분류 행                         | 13                                 | 13(같은 행·같은 새 줄)                   |
| 출력 spec 12개 파일                  | —                                  | 제품 script 결과와 바이트 단위로 같음    |
| `9303af7a` tree의 `plan:impact` 문제 | 옮기기 전 spec: 미분류 12·STALE 12 | 옮긴 spec: 0(regression 21줄 모두 포괄)  |
| 요약                                 | —                                  | `moved 13 kept 106 narrowed 0 dropped 0` |

### Test와 변이

- RED: 두 module의 test는 module이 없어 실패했고, validator의 새 경우 둘은 `human-judgment` 입력 거부로 실패했습니다.
- 구현 뒤 `plan-shape-check` 9, `plan-impact-remap` 14, `plan-readiness-policy` 15(새 경우 2) test가 통과합니다.
- 변이 48개(경고 20, 줄 대응 28)가 모두 test를 실패시켰습니다. 첫 회에는 37개 가운데 "비어 있지 않은 `--out` 거부"를 지운 변이가
  살아남았습니다. CLI 입력 오류 test가 저장소 root를 주지 않아 모든 경우가 revision 조회에서 먼저 실패했기 때문입니다. test가 root를 주고
  경우마다 오류 문구를 단언하도록 고친 뒤(`1d7a36da`) 입력 검사 변이 여섯을 더해 다시 쟀습니다.
- 독립 리뷰 1회차 finding 셋: evidence 수치 한 곳(날짜 표시 plan 수), diff 설정 test가 myers와 다른 algorithm의 차이를 구분하지
  못하고 indent heuristic이 고정되지 않음, working tree 비교가 fsmonitor hook과 호출 환경의 `GIT_INDEX_FILE`을 따름. 수치를 고치고,
  hunk가 갈리는 입력과 설정·환경 test를 더한 뒤(`27fccad1`) diff 설정·실행 환경 변이 다섯을 더했습니다.

### 지침 문서 글자 수(`0d949dfd` → PR)

| 문서                                    | 전     | 후     |
| --------------------------------------- | ------ | ------ |
| `plan-authoring/core.md`                | 18,516 | 20,010 |
| `plan-authoring/frontend.md`            | 6,976  | 8,207  |
| `plan-authoring/discovery.md`           | 6,106  | 6,772  |
| `session-continuity.md`                 | 13,980 | 14,561 |
| `agent-plan-impact-inventory-misses.md` | 7,254  | 8,403  |

## 7. 한계와 재측정 조건

- 넷째 경고는 변경 표시 8/23을 놓치고, 출처 날짜 1/64와 등록부 인용 행, `Owner <날짜> 개정 <번호>` 같은 출처 표기를 잘못 잡습니다. 지금
  메인 11행 가운데 4행이 `Owner <날짜> 개정 <번호>`·`Owner <날짜> D-…` 출처 표기이고 1행이 날짜 붙은 경위 메모입니다. 그래서 경고는
  목록이고 exit 0입니다.
- header·Status 임계값은 앞서 정한 값을 그대로 썼고, 이 측정은 낮춘 값만 비교했습니다.
- merge 뒤 promote·상태 정정에서 나온 경고와 의도한 예외 수는 아직 표본이 없습니다(0/5). guard로 올릴지는 그 오탐률을 본 뒤 정합니다.
- 줄 대응: scan에 걸리지 않는 추가 행·계약·regression 행은 빠지거나 줄어도 `plan:impact`가 실패하지 않습니다. 출력의 `dropped`·`narrowed`
  행을 사람이 다시 봐야 합니다. `moved`도 줄 위치만 옮기고 내용은 보지 않습니다(#799에서 script가 77-80 → 111-114로 옮긴 계약을 손으로
  116-134로 다시 정했습니다). 이름을 바꾼 파일은 지운 파일로 다룹니다.
- #799 사례는 줄 이동만 잽니다(분류 행 drop 0, 다른 입력은 전후가 같음). 빼기·줄이기는 test와 변이가 고정합니다.
- index 불변은 git 2.55에서 확인했습니다. 다른 git 판에서 diff가 다른 optional 쓰기를 하면 test가 실패로 알립니다.
- `--to` 없는 working tree 비교는 저장소의 clean·process filter를 실행합니다(피하는 방법은
  [사용 절차](../../development/troubleshooting/tooling/agent-plan-impact-inventory-misses.md#script-사용)).
- 재측정 조건: 경고 기준·임계값 변경, guard 승격 판단, `plan:impact` spec 형식 변경, git diff 출력 형식 변경.

## 8. Interview map

- "plan이 커지는 것을 어떻게 막나?" → 규칙(첫 화면 필드, Status 한 줄, 결정 칸 고쳐 쓰기)과 바뀐 plan에만 도는 경고, 1·6절 수치.
- "경고 기준은 왜 그것인가?" → 5절 후보 셋의 정밀도·재현율과 임계값 비교, 7절 오탐.
- "줄 번호 spec을 어떻게 옮기나?" → 1절 손 script 네 번의 차이, 6절 #799 재현과 `plan:impact` 문제 0.
- "검증은 어떻게 했나?" → RED 먼저, 독립 참조 계산과 줄 단위 비교, 변이 48개와 첫 회 생존 변이·독립 리뷰가 드러낸 약한 test.
