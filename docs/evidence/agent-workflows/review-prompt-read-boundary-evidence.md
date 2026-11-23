# Review prompt and read boundary evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 리뷰 등록·정산 규칙의 owner가 아닙니다. 현재 동작은
> [Claude same-host review](../../development/agent-workflows/adapters/claude-same-host-review.md)와
> [Claude native registry](../../development/agent-workflows/adapters/claude-native-registry.md), 재채점 규칙은
> [review criteria의 재채점](../../development/agent-workflows/review-criteria/README.md#재채점), 거부 사유별 해소는
> [등록·리뷰 거부 해소](../../development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md)가 소유합니다.

이 문서는 reviewer prompt의 결과 template을 파일로 옮기고, reviewer의 Grep·Glob을 read 범위 안으로 묶고, 저장소 전체 판정의 snapshot
대조를 commit에서 tree로 바꾸고, 리뷰 입력 경로의 이름 규칙과 요구 원본·참조 경로 입력을 넓힌 변경(작업 issue #973, 관련 #775·#850·#970)의
측정 기록입니다. 기준 commit은 `ead56b6b`(변경 전)이고 측정은 그 위 작업 branch의 RED commit `4711322f`에 구현을 얹은 working tree,
Node 26.13.1에서 했습니다. 로컬 registry 기록을 센 값은 그렇다고 표시했고 공개 재현이 되지 않습니다.

## 1. 문제와 관측

- Reviewer prompt는 12,000자를 넘으면 등록되지 않습니다. 이 저장소의 도구 작업용 checkout에 남은 reviewer 등록 호출 860개(2026-09-29~11-22)의
  prompt는 p50 7,919자, p95 11,888자였고 105개가 11,500자 이상이었습니다. 이 길이는 등록이 끝에 붙이는 task marker 줄(126자)까지 든 호출
  prompt 길이라 한도가 검사하는 prompt보다 그만큼 깁니다. 한도 검사 prompt는 860개 모두 12,000자 이하(최대 11,998자)였고, 호출 prompt가
  12,000자를 넘는 21개는 marker 때문인 19개와 packet을 prompt에 붙이던 옛 형식 native subject 리뷰 2개(최대 14,555자)입니다. Prompt 안의 결과 template 한 줄(packet 형식의 JSON)이 p50 4,441자, prompt의
  p50 63.9%였습니다(로컬 registry 기록 집계). 한도를 넘은 prompt는 등록되지 않아 기록에 없습니다. 기준 문서 20개인 1회차 3인 리뷰는
  19,193자로 거부됐고 acceptance·runner 기록을 줄여도 12,017자라 2인 구성으로 내렸습니다(#850). 거부 메시지는 길이 하나만 내 어느 부분을
  줄일지 알 수 없었습니다.
- 읽기 전용 reviewer가 path 없는 Grep이나 저장소 root를 대상으로 한 Glob을 한 번 쓰면 정산의 의존 판정이 저장소 전체(`basis: repository`)가
  됩니다. 저장소 전체 판정은 등록 snapshot을 commit SHA로 대조했으므로, 리뷰 중 다른 세션이 같은 tree로 fast-forward하거나 squash merge한
  commit을 받기만 해도 `review-snapshot-mismatch`로 회차가 무효였습니다(#775, 약 16분 리뷰 한 회차를 다시 돌림).
- 리뷰 입력 경로의 조각은 ASCII 글자·숫자와 `.`·`_`·`-`만 받았습니다. 기준 commit의 추적 파일 가운데 괄호·대괄호가 든 경로가 36개(Next.js
  route group `(auth)`, dynamic segment `[requestId]`)라 그 경로를 리뷰 대상으로 줄 수 없었습니다(#970). 이 경로를 Git에 pathspec으로 넘기면
  `[…]`가 glob 문자로 해석되는 문제도 함께 있었습니다.
- Native subject 리뷰에는 사용자 요구 원본을 넣을 입력이 없어 coverage gap이 났고, Parent subject에는 바뀌지 않은 배경 파일을 read path로만
  줄 입력이 없어 subject `paths`(기준 자동 선택에 듦)에 넣어야 했습니다.

## 2. 측정 방법과 재현 명령

- Prompt 글자 수(fixture): 같은 fixture를 변경 전 구현(`ead56b6b` 구현 + RED test)과 변경 뒤 구현으로 지었습니다. 저장소 밖 독립 clone 둘에서
  helper test 파일 끝에 측정 test 하나를 붙여 실행했습니다. Fixture는 셋입니다: 작은 subject(acceptance 한 줄, runner 기록 한 개), 과밀
  subject(기준 문서 21개, runner 기록 8개, Parent subject acceptance 16줄), runner 기록 60개(기록마다 command 120자·observedResult 160자).
- Prompt 글자 수(기록 모의): 기록된 reviewer prompt 860개에서 결과 template 줄과 옛 마지막 줄을 빼고, 사본 fixture로 잰 새 고정 줄 길이 합(688자,
  review id 길이 포함)을 더했습니다. 실제 등록이 아니라 계산입니다. 기준 문서 줄의 짧아짐과 사본 안내 줄 변화는 넣지 않았습니다. 집계는
  로컬 registry의 task 기록에서 `knu_reviewer` prompt 가운데 결과 template 줄이 prompt 안에 있는 옛 형식만 세는 일회성 script로 냈고, 그
  실행 log는 리뷰 runner 기록에 있습니다(공개 재현은 되지 않음). 순위 값은 정렬한 표본의 가장 가까운 순위입니다. 길이는 호출 prompt(task
  marker 줄 포함) 기준이고, 한도 검사 prompt와의 차이는 같은 표본을 두 길이로 잰 대조 script로 확인했습니다(실행 log는 리뷰 runner 기록).
- Held-out 사본 모양 fixture: 재채점 사본 subject의 prompt를 글자까지 고정한 fixture 파일의 변경 전후 byte 수입니다.
- Tree 비교: 저장소 전체 판정 reviewer를 등록한 뒤 같은 tree의 fast-forward, 같은 tree의 squash merge, tree를 바꾸는 commit을 리뷰 중과 reviewer
  종료 뒤에 각각 만들고 정산 오류를 셌습니다(6 사례, 같은 두 clone).
- 양성 대조: 저장소 밖 독립 clone(`node_modules` 없음)에서 구현을 한 곳씩 되돌린 변이를 적용하고 그 동작을 고정한 test만 이름으로 골라
  실행했습니다.

```bash
# 바뀐 test 네 파일
node --test scripts/ci/agents/claude/claude-native-task-helper.test.mjs \
  scripts/ci/agents/claude/claude-subagent-model-routing.test.mjs \
  scripts/ci/agents/common/agent-native-adapter-contract.test.mjs \
  scripts/ci/agents/common/review-context-inputs.test.mjs

# 과밀 fixture가 한도 안에 들고 결과 template이 파일인지
node --test --test-name-pattern='gets its result template as a file' scripts/ci/agents/claude/claude-native-task-helper.test.mjs

# 같은 tree fast-forward·squash merge의 tree 비교
node --test --test-name-pattern='compares trees, not commits' scripts/ci/agents/claude/claude-native-task-helper.test.mjs

# 기준 commit의 괄호·대괄호 경로 수
git ls-tree -r --name-only ead56b6b | grep -c '[][()]'
```

## 3. Baseline

| 지표                                                     | 변경 전(`ead56b6b`)                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 작은 subject prompt(Parent / native)                     | 3,923자 / 3,776자                                                                 |
| 과밀 subject prompt(Parent / native)                     | 15,098자 거부 / 10,557자                                                          |
| runner 기록 60개 prompt(Parent / native)                 | 21,790자 거부 / 21,643자 거부, 부분별 글자 수 없음                                |
| 사본 모양 fixture                                        | 3,857 byte                                                                        |
| 같은 tree fast-forward·squash merge(리뷰 중·종료 뒤 4건) | 4건 모두 mismatch(`review-snapshot-mismatch` 2, `post-completion-source-drift` 2) |
| tree를 바꾸는 commit(2건)                                | 2건 mismatch                                                                      |
| path 없는 reviewer Grep·Glob                             | hook 없음, 정산이 저장소 전체 판정                                                |
| 괄호·대괄호 추적 경로                                    | 36개, 리뷰 입력 경로로 거부(`unsafe-path`)                                        |

## 4. 원인

- Prompt 크기: 결과 template은 packet 전체 모양(acceptance마다 coverage 칸, 기준 항목, runner 자리)을 한 줄 JSON으로 prompt에 실었습니다.
  Acceptance와 기준 문서가 늘면 template이 함께 늘어 prompt가 한도에 닿았고, packet 파일과 runner 파일을 이미 prompt 밖으로 뺀 뒤에도 가장
  큰 부분으로 남았습니다.
- 읽기 경계: PreToolUse hook은 `Agent|SendMessage`와 `Edit|Write|NotebookEdit`에만 있어 reviewer의 Grep·Glob 범위를 막을 자리가 없었습니다.
  정산은 transcript를 보고 나서야 path 없는 검색을 알 수 있어 저장소 전체 판정으로 바꾸는 것밖에 할 수 없었습니다.
- Snapshot 대조: 저장소 전체 판정은 logHeader의 snapshot digest(base·head SHA 포함)를 끝난 snapshot과 비교해, 내용이 같아도 commit이
  바뀌면 다르다고 판정했습니다.
- 경로 이름: 등록 policy와 helper의 경로 조각 규칙이 shell·pathspec 안전을 위해 ASCII 일부만 허용했고, Git 호출은 경로를 pathspec magic 없이
  넘겼습니다.

## 5. 대안과 기각

| 대안                                                          | 판정 | 근거                                                                                                                                   |
| ------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 한도를 올림                                                   | 기각 | 한도는 reviewer 입력 크기의 운영 상한이고 바꾸면 이전 측정·재채점과 비교할 수 없습니다. 가장 큰 부분을 파일로 옮기면 한도 안에 듭니다  |
| 결과 template을 packet 파일 안에 합침                         | 기각 | packet은 정산이 대조하는 공통 schema라 field를 더하지 않습니다. 별도 파일에 digest를 결속해 같은 보호를 얻습니다                       |
| Grep·Glob 거부를 `.claude/settings.json` matcher에 둠         | 기각 | 모든 세션·역할의 검색에 걸립니다. 역할 frontmatter hook은 `knu_reviewer`에만 돌고 settings를 바꾸지 않습니다                           |
| Read도 read 범위 밖이면 거부                                  | 기각 | 결과 template·packet·사본을 읽는 경로가 회차마다 다르고, 거부는 reviewer 판정을 막습니다. 밖 읽기는 `readOutsidePaths`에 기록만 합니다 |
| 거부 기록 없이 정산이 path 없는 검색을 늘 무시                | 기각 | hook이 돌지 않은 세션(신뢰하지 않은 폴더 등)의 검색은 실제로 저장소 전체를 읽었으므로, 거부가 기록된 호출만 뺍니다                     |
| 저장소 전체 판정도 commit 대조 유지, 운영 규칙으로 merge 대기 | 기각 | #775처럼 다른 세션의 merge·fast-forward는 리뷰하는 세션이 막을 수 없습니다. tree·dirty diff·untracked digest가 같으면 내용이 같습니다  |
| 경로 조각에 모든 문자 허용                                    | 기각 | 공백·제어 문자·`*`·`?`는 shell·pathspec 안전을 깨므로 Unicode 글자·숫자와 괄호·대괄호만 더하고 Git 호출에 literal pathspec을 씁니다    |

## 6. 개선별 전후 측정

### Prompt 크기

| Fixture                           | 변경 전                         | 변경 뒤                                                                                                                                       |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 작은 subject(Parent / native)     | 3,923자 / 3,776자               | 3,086자 / 2,938자                                                                                                                             |
| 과밀 subject(Parent / native)     | 15,098자 거부 / 10,557자        | 5,376자 / 5,228자                                                                                                                             |
| runner 기록 60개(Parent / native) | 21,790자 / 21,643자, 둘 다 거부 | 20,953자 / 20,805자, 둘 다 거부: instructions 1,731, runner records 18,031, acceptance and criteria 0, context 81, round 151, files 959 / 811 |
| 사본 모양 fixture                 | 3,857 byte                      | 3,375 byte                                                                                                                                    |

- 결과 template은 `<reviewId>.template.json`으로 옮겨 prompt에는 파일 줄과 먼저 읽으라는 지시만 남습니다. 그 digest는 prompt 기록이 결속해
  등록 뒤 바뀌면 정산이 `review-template-changed`로 거부합니다.
- Runner 기록 60개 fixture는 여전히 거부되고, 거부 사유가 그 가운데 runner 기록이 18,031자라는 것을 보여 줍니다. 기록 줄은 이번 변경에서
  측정만 하고 파일로 옮기지 않았습니다.
- 기록 모의(로컬 registry 기록 860개, 호출 prompt 길이): 결과 template 줄을 뺀 새 형식 prompt는 p50 3,541자, p95 7,810자, 최대 11,057자로 계산됩니다(변경 전
  p50 7,919자, 11,500자 이상 105개 → 0개). Parent subject 773개는 p50 7,452 → 3,417자, native subject 87개는 p50 10,693 → 7,411자입니다.
- Prompt는 기준 문서 줄을 디렉터리 한 번과 문서 id 나열로 줄이고, delta 회차는 늘 범위 기록 파일을 가리키며 줄에는 경로 수만 적습니다.

### 읽기 경계와 tree 비교

| 사례                                                    | 변경 전                       | 변경 뒤                                                             |
| ------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| 같은 tree fast-forward(리뷰 중 / 종료 뒤)               | mismatch / mismatch           | 없음 / 없음, `headChanged: true` 기록                               |
| 같은 tree squash merge(리뷰 중 / 종료 뒤)               | mismatch / mismatch           | 없음 / 없음, `headChanged: true` 기록                               |
| tree를 바꾸는 commit(리뷰 중 / 종료 뒤)                 | mismatch / mismatch           | mismatch / mismatch                                                 |
| path 없는 Grep, 저장소 root·상위·read 범위 밖 Grep·Glob | 허용, 정산이 저장소 전체 판정 | hook이 이유와 함께 거부, 거부 기록에 남은 호출은 의존 판정에서 빠짐 |
| read 범위 밖 Read                                       | 판정만 바뀌지 않음            | `readOutsidePaths`에 기록, 판정 그대로                              |

- 같은 tree 사례 4건의 mismatch가 0건이 됐고, tree를 바꾸는 commit 2건은 그대로 mismatch입니다. 판정이 없는 recovery 결속은 지금처럼
  commit으로 대조해, 같은 tree commit 뒤에도 재시도를 결속하지 않습니다.
- 거부 기록(task 디렉터리 `review-read-denials.jsonl`)에 없는 path 없는 검색은 지금처럼 저장소 전체 판정입니다. 기록에 읽지 못하는 줄이
  있으면 기록 전체를 쓰지 않습니다.

### 입력 경로

- 경로 조각은 Unicode 글자·결합 부호·숫자와 `.`·`_`·`-`·괄호·대괄호를 받고, 경로는 Git이 파일 이름을 내는 NFC여야 합니다(등록 policy와 helper가 같은 규칙). 리뷰 입력을 고르는 Git
  `ls-files` 호출 세 곳은 `:(literal)` pathspec을 써 `[requestId]`를 glob으로 읽지 않습니다. `git check-ignore`는 pathspec magic을 받지 않고
  (exit 128) 인자를 literal로 다루므로 그대로 둡니다. Untracked 경로의 `[`·`]`는 snapshot 검사가 그대로 막아, 괄호·대괄호 경로는 commit한
  경로만 리뷰 입력이 됩니다.
- Native subject `--requirement-source`와 Parent subject `requirementSources`는 요구 원본 파일을 packet 요구 원천과 read path에 넣고, Parent
  subject `referencePaths`는 바뀌지 않은 배경 파일을 기준 자동 선택 밖 read path로 넣습니다.

### 회귀 보호

- RED commit의 새 test 21개는 변경 전 구현에서 모두 실패했고 실패 사유가 test가 이름 붙인 항목과 맞았습니다(RED 사유 검사 위반 0).
- 양성 대조: 저장소 밖 독립 clone에서 구현을 한 곳씩 되돌린 변이 29개가 모두 그 동작을 고정한 test를 실패시켰습니다. 변이는 결과 template 파일 쓰기·digest 결속, 한도 오류의 부분별 글자 수·안내, 요구
  원본의 packet 요구 원천, hook의 read 범위·root 판정, 거부 기록 제외, `readOutsidePaths`, 두 정산 지점의 tree 비교, `referencePaths`의 선택
  제외·basis 뒤 변경·dirty 변경 거부, 연결 reviewer 추출 재대조, 두 경로 이름 규칙, literal pathspec, 기준 문서 줄, delta 범위 기록, finding 줄,
  manifest digest 줄, runner 식별자 문구, 이번 회차 subject 경로의 ignored 비교, 기준 항목을 가리키지 않는 binding 행 거부, recovery 결속의
  commit 대조, 두 경로 규칙의 NFC, commit이 아닌 basis의 `referencePaths` 경고입니다.
- 연산자 mutation sweep: 바뀐 판정 module 셋(`native-session.mjs`·`native-task-helper.mjs`·`model-policy.mjs`)의 더한 줄에서 비교·논리
  연산자, 경계값, 조건 반전을 하나씩 바꾼 변이를 저장소 밖 독립 clone에서 돌렸습니다. 첫 sweep에서 어떤 test도 실패시키지 못한 43개는 test
  공백이었습니다(거부 기록 줄 검증, hook의 task 찾기, 한 message 안의 거부 호출, tree 비교 guard, CLI 반복 option, hook 입력 한도, 요구
  원본·참조 경로 거부, 이전 회차 번호, 부분별 글자 수). 그 분기마다 test를 더했고, 그중 둘은 중복 조건이라 code에서 지웠습니다. 부분별 글자
  수는 합이 prompt 길이보다 1 커서 고쳤습니다. 다시 돌린 변이 149개는 모두 test를 실패시켰습니다(survivor 0, 시간 초과 0). 독립 리뷰
  1회차 처분으로 더한 줄의 변이 15개(연산자 변이 12개와 연산자가 없는 경고 분기의 손 변이 3개)도 모두 test를 실패시켰습니다.

### 재채점

- 이 변경은 reviewer prompt 원본(helper와 `knu_reviewer` 역할 파일)을 바꾸므로 merge 전에 held-out 사본으로 재채점합니다. 결과(통과/실패, 더 놓친
  칸 수, 부분 감소 칸 수, 판정 가능 칸 수, 사용 기록 id)는 재채점이 끝나면 이 소절에 적고, PR 본문 `재채점` 줄과 Review evidence 줄에도
  같은 값을 둡니다.

## 7. 한계와 재측정 조건

- 기록 모의는 계산입니다. 기준 문서 줄·사본 안내 줄 변화와 회차 줄 변화를 넣지 않았고, 한도를 넘어 거부된 prompt는 기록에 없어 표본에서
  빠졌습니다. 새 형식 prompt가 실제로 쌓이면 같은 집계로 다시 잽니다.
- Runner 기록 줄(`command`·`exit`·`observedResult`)은 prompt에 남습니다. 거부 사유의 부분별 글자 수가 runner 기록을 가장 큰 부분으로 자주
  보이면 기록 줄도 파일로 옮길지 다시 봅니다.
- Review-read hook은 역할 frontmatter hook이라 신뢰하지 않은 폴더 세션에서는 돌지 않을 수 있습니다. 그때 정산은 거부 기록이 없으므로 변경
  전처럼 저장소 전체 판정입니다.
- 이 저장소의 local 검증은 바뀐 test 파일, agent-workflow suite, `pnpm test:repo-policy`, `pnpm check:fast`, `pnpm exec prettier . -c`입니다. DB가
  필요한 `pnpm check`·`pnpm lint`·`pnpm typecheck`·`pnpm build`는 PR CI 결과로 대신했습니다.
- 생산성·token 절감은 비교군이 없어 주장하지 않습니다. Prompt 글자 수는 reviewer 입력 크기의 신호일 뿐 리뷰 품질의 근거가 아니며, 품질은
  재채점이 잽니다.

## 8. Interview map

- "Prompt 한도에 걸릴 때 한도를 올리지 않은 이유는?" → 4절 원인과 5절 첫 행: 가장 큰 부분(결과 template)을 digest 결속 파일로 옮겨 같은 보호로
  한도 안에 넣었습니다.
- "Reviewer의 검색 범위를 어떻게 묶었나?" → 6절 읽기 경계: 역할 frontmatter hook이 거부하고, 거부 기록으로 정산이 그 호출을 뺍니다. 기록이 없는
  검색은 보수적으로 저장소 전체 판정입니다.
- "다른 세션의 merge가 리뷰를 무효로 만들던 문제는?" → 6절 tree 비교 표: 같은 tree 4건 mismatch 0, tree 변경 2건은 그대로 mismatch입니다.
