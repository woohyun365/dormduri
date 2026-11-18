# Review dispatch lightening evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 리뷰 등록·정산 규칙의 owner가 아닙니다. 현재 동작은
> [Claude same-host review](../../development/agent-workflows/adapters/claude-same-host-review.md)와
> [Claude native registry](../../development/agent-workflows/adapters/claude-native-registry.md), 회차 규칙은
> [QA workflow의 리뷰 회차](../../development/agent-workflows/qa.md#리뷰-회차), 거부 사유별 해소는
> [등록·리뷰 거부 해소](../../development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md)가 소유합니다.

이 문서는 독립 리뷰를 보내는 절차를 한 명령(`review-run`)으로 묶고, reviewer 입력을 사본으로 고정하고, adapter identity를 정산이 실제로 싣는
module로 좁히고, runner 기록을 prompt 밖 파일로 옮긴 변경(작업 issue #921)의 측정 기록입니다. 기준 commit은 `3a361b0e`(변경 전)이고 측정은
그 위 작업 branch의 `f20f1848`, Node 26.13.1에서 했습니다. 로컬 registry 기록을 센 값은 그렇다고 표시했고 공개 재현이 되지 않습니다.

## 1. 문제와 관측

- Reviewer prompt는 12,000자 한도를 넘으면 등록되지 않는데 기록된 prompt가 한도 바로 아래에 몰려 있었습니다. 이 저장소의 두 로컬 checkout에
  남은 reviewer prompt는 도구 작업용 801개(p50 7,455자, 11,500자 이상 75개), 제품 작업용 275개(p50 10,469자, 11,500자 이상 73개)였습니다. Prompt
  글자 가운데 runner 기록의 `environment`·`outputPaths`가 p50 12.1%·18.9%였습니다(로컬 registry 기록 집계).
- Reviewer가 읽는 ignored 입력(계획 초안·증거·runner 출력)은 원본 digest로 결속했습니다. 리뷰가 도는 동안 다른 세션이나 Parent가 그 파일을
  고치면 정산이 `review-input-changed`로 무효가 됐습니다. 2026-10-03~11-02 도구 작업용 checkout의 reviewer task 635개 가운데 정산 출력이 남은
  557개에서 거부는 7건이었고, finding 없이 버려진 회차 3건은 모두 이 사유였습니다(reviewer 실행 합 30.9분, 로컬 registry 기록 집계).
- Adapter identity digest는 두 agent script 디렉터리의 `.mjs` 33개 전체를 덮었습니다. 정산과 무관한 검사 script 한 줄을 고쳐도 열려 있는 리뷰의
  호출·정산이 `adapter/role/settings drift`로 거부되므로, 이를 피하려고 "리뷰가 열려 있으면 그 디렉터리를 고치는 writer는 기다린다"는 운영
  규칙을 썼습니다. 같은 기간 identity drift 거부는 0건이었습니다. 비용은 거부가 아니라 대기였고 기록에 남지 않았습니다.
- Reviewer 하나를 등록하려면 Parent가 결정적 검사, `review`, `prepare`를 따로 실행하고 결과를 손으로 이어 붙였습니다. 2회차부터 delta만 읽을지
  전 범위를 다시 읽을지는 Parent가 문장으로 정했고 근거가 기록에 남지 않았습니다.
- 계획 참조 검사는 exit code로 판정해, 고치기 전부터 위반이 있던 계획은 새 위반이 없어도 통과하지 못했습니다. 반복 실행한 step의 앞선
  `exit=1`은 마지막 `exit=0`에 가려졌습니다.

## 2. 측정 방법과 재현 명령

- Prompt 글자 수(fixture): runner record 40개(record마다 긴 출력 경로 둘)인 native subject의 reviewer prompt를 변경 전후에 지었습니다.
- Prompt 글자 수(기록 모의): 두 checkout에 남은 reviewer prompt와 그 packet의 runner 기록으로 새 형식 prompt를 다시 지어 길이를 비교했습니다.
  실제 등록이 아니라 계산이고 로컬 기록이 원천입니다. 도구 작업용 801개 가운데 packet을 읽을 수 없는 68개는 뺐습니다(733개).
- Identity 범위: 변경 전 digest 대상 파일 수와, 변경 뒤 registry가 export하는 닫힘 목록을 셌습니다.
- 양성 대조: 저장소 밖 독립 clone(`node_modules` 없음)에서 구현을 한 곳씩 되돌리거나 넓힌 변이 45개를 적용하고 그 동작을 고정한 test만
  이름으로 골라 실행했습니다. 변이 전에는 같은 clone에서 여섯 test 파일 363개가 모두 통과했습니다.
- Live: 새 세션에서 `review-run`으로 보낸 리뷰 1회 동안 닫힘 밖 script와 ignored 원본 입력을 바꾸고 정산 결과를 봅니다(6절, 수집 상태 표시).

```bash
# identity 닫힘 목록(변경 뒤)과 변경 전 digest 대상 수
node -e "import('./scripts/agents/claude/native-session.mjs').then((m) => console.log(m.claudeIdentityClosure().join('\n')))"
git ls-tree --name-only 3a361b0e scripts/agents/claude/ scripts/agents/common/ | grep -c '\.mjs$'

# 바뀐 test 여섯 파일
node --test scripts/ci/agents/claude/claude-native-task-helper.test.mjs \
  scripts/ci/agents/claude/claude-native-session.test.mjs \
  scripts/ci/agents/common/runner-log-check.test.mjs \
  scripts/ci/agents/codex/codex-delegate-spec.test.mjs \
  scripts/ci/agents/claude/claude-native-skills.test.mjs \
  scripts/ci/agents/codex/codex-native-skills.test.mjs

# runner record 40개 fixture의 prompt 한도
node --test --test-name-pattern='runner records move to a runner file' \
  scripts/ci/agents/claude/claude-native-task-helper.test.mjs
```

## 3. Baseline

| 항목                                         | 값(`3a361b0e`)                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Reviewer 등록까지 Parent가 실행하는 명령     | 결정적 검사 명령(코드 리뷰 1개, 계획 리뷰면 5개 더) → `review` → reviewer마다 `prepare`                  |
| Runner 기록이 prompt에 실리는 모양           | Result template의 `commandsActuallyRun`에 record마다 `exit`·`observedResult`·`environment`·`outputPaths` |
| Runner record 40개 fixture의 prompt          | 17,039자(`reviewer-prompt-exceeds-12000-chars`로 거부)                                                   |
| Reviewer가 읽는 ignored 입력                 | 원본 경로. 원본이 바뀌면 `review-input-changed`                                                          |
| Adapter identity의 source digest 대상        | `scripts/agents/claude`·`scripts/agents/common`의 `.mjs` 33개                                            |
| 2회차 범위                                   | Parent가 정함. `review`는 2회차에도 전 범위 prompt를 지음                                                |
| 계획 참조 검사 판정                          | exit code                                                                                                |
| 여섯 test 파일의 test 수                     | 325(helper 107, registry 178, runner-log-check 5, Codex delegate 7, skill 문장 19·9)                     |
| finding 없이 버려진 회차(한 달, 한 checkout) | 3건, 모두 `review-input-changed`, reviewer 실행 합 30.9분(로컬 registry 기록 집계)                       |
| Identity drift 거부(같은 기간)               | 0건(로컬 registry 기록 집계)                                                                             |

## 4. 원인

- 한도가 reviewer의 판단 내용과 runner 기록의 부기(출력 경로, 실행 환경)를 함께 셌습니다. Reviewer는 부기를 읽고 판단하지 않고 결과에 그대로
  옮기기만 합니다.
- 결속 대상이 reviewer가 읽는 판이 아니라 여러 세션이 계속 고치는 원본이었습니다. 원본을 고친 것과 reviewer가 다른 판을 읽은 것이 같은
  사유로 거부됐습니다.
- Identity가 "정산 결과를 바꿀 수 있는 code"가 아니라 디렉터리로 정해져 있었습니다. Registry와 task helper의 정적 import 닫힘 25개 가운데
  5개는 그 디렉터리 밖이고(`scripts/artifacts` 2, `scripts/ci/lifecycle` 3) 디렉터리 안 33개 가운데 13개는 닫힘 밖입니다(`f20f1848`).
- 등록 절차가 여러 명령이라 검사를 건너뛰거나 순서를 바꿔도 등록이 됐고, 2회차 범위 판단은 도구 밖에 있었습니다.

## 5. 대안과 기각

| 결정                | 채택                                                                                                                     | 기각과 이유                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt 한도         | Runner 기록을 prompt 밖 runner 파일로 옮기고 prompt에는 command·exit·관측 결과만                                         | 한도 상향(판단 내용 상한이 함께 풀림), result template 전체의 파일화(결과 형식과 정산 대조를 함께 바꿔야 함)                                            |
| Record의 `command`  | 전체를 prompt에 싣고 긴 명령은 script 파일에 두라고 안내                                                                 | 160자에서 자르기(초과 21 → 0이지만 도구 작업용 checkout record 4,211개 가운데 1,142개가 잘려 reviewer가 본 명령과 결과에 옮긴 명령이 달라짐)            |
| Ignored 입력        | 리뷰마다 사본을 만들어 사본을 read path로 주고 사본 digest를 대조                                                        | 리뷰 중 편집 금지 규칙 유지(대기와 버려진 회차), 원본 변경을 조건 없이 무시(reviewer가 원본을 읽으면 다른 판을 리뷰)                                    |
| 바뀐 원본의 처분    | 기록만 남김. Reviewer가 그 원본이나 상위 디렉터리를 path로 지목해 읽었으면 거부                                          | 항상 거부(지금과 같음), 항상 허용(읽은 판을 알 수 없음), 저장소 전체 판정이면 거부(path 없는 검색 한 번으로 회차를 잃음)                                |
| Identity 범위       | Registry와 task helper에서 시작하는 정적 import 닫힘. 닫힘 밖 변경은 기록                                                | 디렉터리 전체 유지(무관한 script가 리뷰를 무효로 만듦), 손으로 적은 파일 목록(닫힘과 어긋나도 알 수 없음), identity 대조 제거(정산 code 변경을 못 잡음) |
| 2회차 범위          | 직전 회차 범위 기록·입력 manifest와 지금 tree·ignored subject 파일을 비교해 delta를 만들고, 조건에 걸리면 전 범위와 이유 | Parent 문장 판단(근거가 기록에 없음), `review` 단독 2회차에 경고만(전 범위 재독이 그대로 남음)                                                          |
| 계획 참조 검사 판정 | 기준 사본 대비 새 위반·새 unavailable 대상만 실패                                                                        | exit code(기존 위반이 있는 계획은 항상 실패)                                                                                                            |
| Agent 호출 입력     | 등록한 전체 invocation 파일 내용 그대로                                                                                  | 짧은 marker 입력을 기본으로 유지(hook이 입력을 바꾼 호출을 auto mode가 거부하면 release 뒤 다시 등록해야 함)                                            |

## 6. 개선별 전후 측정

### 등록 절차와 prompt

| 항목                                                 | 전(`3a361b0e`)                         | 후(`f20f1848`)                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer 등록까지 Parent가 실행하는 명령             | 검사 명령 1~6개, `review`, `prepare`×N | `review-run` 1개(검사는 child process, stdout 한 줄, 결과는 `--out` 파일)                                                              |
| 결정적 검사가 실패했을 때                            | Parent가 멈추지 않으면 등록됨          | 등록 0건, exit 1, 사유는 결과 파일(`review`·`prepare` 거부도 같은 기록)                                                                |
| Runner record 40개 fixture의 prompt                  | 17,039자(거부)                         | 6,364자(runner 파일 15,526 B는 read path)                                                                                              |
| 제품 작업용 기록 275개 모의: p50 / 11,500자 이상     | 10,469자 / 73개                        | 9,114자 / 3개(12,000자 초과 0)                                                                                                         |
| 그 가운데 2026-11-10 뒤 65개: p50 / 11,500자 이상    | 10,550자 / 15개                        | 8,904자 / 0개                                                                                                                          |
| 도구 작업용 기록 733개 모의: p50 / 11,500자 이상     | 7,008자 / 54개                         | 6,801자 / 42개(12,000자 초과 21, 길어진 것 414)                                                                                        |
| 그 가운데 2026-11-10 뒤 6개: p50 / 11,500자 이상     | 11,038자 / 0개                         | 9,111자 / 0개                                                                                                                          |
| 2회차 범위                                           | Parent 문장                            | `delta`(바뀐 파일 + 직전 blocking finding 위치) 또는 `full`과 이유(위험 trigger 선언, 직전 범위 기록 없음, 새 파일, 직전 범위 밖 수정) |
| Parent 작성 subject의 `review` 단독 2회차            | 전 범위 prompt                         | `delta-scope-required` 거부                                                                                                            |
| 기존 위반이 있는 계획의 참조 검사(새 위반 0 fixture) | 실패(exit 1)                           | 통과, 새 위반 1이면 등록 0건                                                                                                           |

도구 작업용 기록 모의에서 12,000자를 넘는 21개는 2026-10-06~11-02 기록이고 가장 긴 command가 리뷰당 p50 178자·최대 1,410자였습니다. 변경 전
prompt는 command를 싣지 않았으므로 명령이 긴 기록은 새 형식에서 오히려 길어집니다(733개 가운데 414개). 모의는 예전 한도에 맞춰 이미 줄인
prompt를 다시 지은 것이라 새 형식에서 실제로 거부될 수를 뜻하지 않습니다.

### 입력 사본과 identity

| 항목                                         | 전(`3a361b0e`)              | 후(`f20f1848`)                                                                         |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| 리뷰 중 ignored 원본 입력을 고침             | 정산 `review-input-changed` | 정산 유효, `reviewInputOriginalsChanged`에 경로 기록                                   |
| Reviewer가 바뀐 원본을 path로 지목해 읽음    | —                           | `review-input-changed:<원본>` 거부                                                     |
| Path 없는·저장소 root 검색 뒤 원본을 고침    | —                           | 정산 유효, `reviewInputOriginalsChanged`에 경로 기록                                   |
| 사본을 고침                                  | —                           | `review-input-changed:<사본>` 거부                                                     |
| 등록이 거부하는 이름(한글 등)의 ignored 입력 | read path로 줄 수 없음      | 사본 디렉터리로 읽음                                                                   |
| Identity source digest 대상                  | 두 디렉터리의 `.mjs` 33개   | 정적 import 닫힘 25개(그 디렉터리 20, `scripts/artifacts` 2, `scripts/ci/lifecycle` 3) |
| 닫힘 밖 agent script 13개 가운데 하나를 고침 | 호출·정산 거부              | 호출·정산 유효, `identityOutsideChanges`에 경로 기록                                   |
| 닫힘 안 module(디렉터리 밖 5개 포함)을 고침  | 디렉터리 밖 5개는 잡지 못함 | `adapter/role/settings drift`                                                          |

### 회귀 보호

| 항목                     | 전(`3a361b0e`) | 후(`f20f1848`)                                                                        |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------- |
| 여섯 test 파일의 test 수 | 325            | 363(helper 133, registry 184, runner-log-check 7, Codex delegate 10, skill 문장 20·9) |
| 양성 대조 변이           | —              | 45개 모두 해당 test 실패(1회차 43개, test 둘을 고친 뒤 45개)                          |

변이 45개는 입력 사본 4, identity 3, runner 파일과 prompt 줄 4, 완전성 경고와 Verification 추출 6, runner 기록 검사 3, 경로 거부 2,
`review-run`의 검사 판정·거부 기록·역할 선택 8, 2회차 범위 12, Codex `review-run` 2, skill 문장 1입니다. 1회차에서 살아남은 둘은 registry의
runner 파일 digest 대조를 빼도 prompt 기록 결속이 같은 사유를 내던 것과, delta test의 low finding이 fixture에 없는 파일을 가리켜 severity
조건이 빠져도 통과하던 것입니다. 둘 다 test가 약했고 구현은 고치지 않았습니다.

### Live 관측

수집 상태: 표본 0/1. 새 세션에서 `review-run`으로 보낸 리뷰 1회 동안 닫힘 밖 agent script와 ignored 원본 입력을 바꾼 뒤의 정산 결과를 이 절에
더합니다. 그 전까지 위 두 표의 "후" 값은 fixture test의 관측입니다.

## 7. 한계와 재측정 조건

- Prompt 글자 수의 기록 모의는 계산이고 원천이 로컬 registry 기록이라 공개 재현이 되지 않습니다. 다시 볼 수 있는 값은 fixture test입니다.
- 한도 거부 수와 finding 없이 버려진 회차 수의 "후" 값은 아직 없습니다. 변경이 merge된 뒤 기간의 registry 기록으로 다시 셉니다.
- Identity drift 거부는 변경 전에도 0건이었습니다. 줄어드는 것은 운영 규칙의 대기인데 변경 전 대기 시간을 재지 않아 전후 비교가 없습니다.
- 버려진 회차 3건은 한 checkout의 한 달 기록이고, 정산 출력이 남지 않은 task 78개와 다른 checkout 기록은 세지 않았습니다.
- 닫힘은 정적 import만 따라갑니다. 닫힘 module이 다른 script를 child process로 실행하거나 동적 import로 싣게 되면 그 script의 변경은
  identity에 잡히지 않습니다. 지금 동적 import는 registry가 싣는 task helper 하나이고 닫힘의 시작점에 넣었습니다.
- 사본은 등록 시점의 판입니다. Reviewer가 원본을 읽었는지는 호출이 지목한 path로만 판정합니다. Transcript를 읽을 수 없거나 다른
  도구가 보여 읽기를 가릴 수 없는 리뷰에서 원본이 바뀌면 거부합니다. Path 없는 검색과 저장소 root 검색은 원본을 지목한 것으로 보지
  않는데, Grep 도구가 ignored 파일을 건너뛰는지는 직접 확인하지 못했습니다(과거 root Grep 6건은 모두 glob filter가 있었고 결과에
  ignored 경로가 없었습니다).
- 2회차 delta가 놓치는 결함(직전 범위 밖으로 번진 회귀)은 이 측정에 없습니다. 위험 trigger 선언·새 파일·범위 밖 수정이 전 범위로 돌리는
  조건이고, 놓침 사례가 나오면 조건을 다시 봅니다.
- 리뷰 품질 교정(같은 결함을 다시 찾는 비율)은 이 변경 뒤 prompt 형식으로 다시 재지 않았습니다. 사본 모양 subject의 prompt에서 달라지는
  줄이 runner 기록 자리와 입력 사본 줄뿐임은 test가 고정합니다.
- 재측정 조건: prompt builder의 고정 줄이나 runner 파일 형식 변경, 닫힘에 module 추가, 입력 사본 대상 변경, 2회차 범위 조건 변경.

## 8. Interview map

- "리뷰 중에 파일을 고치면 리뷰가 무효가 되지 않나?" → 6절 입력 사본 표: reviewer는 사본을 읽고, 원본 변경은 기록하며, reviewer가 원본을
  읽은 것이 보이면 거부.
- "identity 검사를 왜 좁혔나, 안전한가?" → 4절(디렉터리와 실제 닫힘의 차이), 6절(닫힘 안 변경은 그대로 거부, 디렉터리 밖 5개를 새로 잡음),
  7절(정적 import 한계).
- "prompt 한도는 어떻게 풀었나?" → 5절 대안(한도 상향 기각), 6절 fixture 17,039자 → 6,364자와 기록 모의, 길어지는 경우의 정직한 수치.
- "한 명령으로 묶으면 무엇이 달라지나?" → 6절 첫 표: 검사 실패·거부 때 등록 0건, 2회차 범위와 이유가 기록에 남음.
- "검증은 어떻게 했나?" → test 먼저, 독립 clone 양성 대조 45개(살아남은 둘로 test를 고침), live 관측 수집 상태.
