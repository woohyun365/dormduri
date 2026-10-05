# 트러블슈팅: Plan 영향 목록을 리뷰할 때마다 새 누락이 나옴

**상태**: Current
**마지막 검증 환경**: Node 24, `pnpm plan:impact`(`scripts/agents/common/plan-impact.mjs`)
**현재 owner**: [Plan authoring core](../../agent-workflows/plan-authoring/core.md#structural-change-impact-inventory)

## 증상

구조를 바꾸는 plan(모듈 처분, 역할·profile 개편, 문서 분리처럼 여러 파일의 계약을 함께 바꾸는 plan)의 영향 목록을 손으로
만들면, 독립 리뷰가 돌 때마다 새 누락 줄이 지적됩니다. 지적을 반영해도 다음 리뷰에서 다른 위치가 또 나옵니다. 목록이 완전한지
재현할 방법이 없어서 리뷰가 수렴하지 않습니다.

## 원인

글자 일치 검색(`rg`, editor 검색)은 적은 글자가 그대로 나오는 줄만 찾습니다. 다음 다섯 가지 사각지대가 있습니다.

1. **간접 사용:** 이름을 다시 export하거나 객체 필드로 넘긴 값, binding을 거친 호출은 원래 이름으로 검색되지 않습니다.
2. **구조 패턴:** "모든 역할 TOML의 prompt"처럼 식별자가 없는 변경 대상은 검색어가 없습니다.
3. **문서 간 링크:** 다른 문서의 anchor 링크, regex literal 안에 escape된 경로(`codex\.md`), 경로 변수와 template 이름은
   파일 이름 검색에 걸리지 않습니다.
4. **같은 의미의 다른 표현:** 모델·effort 같은 개념을 문장으로 풀어 쓴 줄은 식별자 검색으로 찾을 수 없습니다.
5. **실행 경로:** 경로를 읽는 test만 보면, 그 경로를 실행하거나 import하는 job과 script를 놓칩니다.

손 목록은 이 사각지대를 어디까지 확인했는지 남기지 않습니다. 그래서 리뷰어는 목록 밖을 다시 찾고, 작성자는 지적된 줄만 고칩니다.

### 실제 사례

- **오탐(분류 규칙 속 경로 패턴):** test 입력 지도를 경로 literal 정적 추출로 만들자, 분류 규칙의 경로 패턴
  (`startsWith('apps/web/')` 등)이 실제 입력으로 잡혔습니다. Spawn된 script의 import closure에서도 같은 오탐이 다시 생겨,
  실행 trace(`node:fs`·subprocess 기록)를 더해야 했습니다.
- **오탐(접두사 비교):** 경로 접두사 검색(`.artifacts`로 시작)으로, test가 만든 임시 경로(`.artifacts/tools/test/<tmp>/…`)
  읽기를 tracked `.artifacts` 파일 읽기로 셌습니다.
- **누락(출처 없는 중복 제거):** 여러 층의 결과를 경로만으로 중복 제거하면 먼저 기록된 층이 이깁니다. 그 결과 같은 경로가
  spawn된 script 자신의 literal로 다시 나와도 입력에서 빠졌습니다.
- **오탐(단어 하나짜리 literal):** commit type 목록의 `'docs'`가 tracked 디렉터리 `docs/`로 잡혔습니다.
- **누락(층마다 다른 행 종류):** spawn 층은 파일·디렉터리 literal을 모두 받았지만 test 자신의 literal 층은 파일만 받아서,
  test가 직접 적은 tracked 디렉터리 61행이 빠졌습니다.
- **검증 누락(untracked 새 파일):** `git ls-files` 기반 guard는 untracked 새 파일을 보지 않습니다. 새 문서가 untracked일 때
  전체 policy test가 통과했지만, stage한 뒤 local-plan 경계 guard가 실패했습니다.
- **누락(실행 경로):** 경로 family의 CI lane을 "그 family를 읽는 test"만으로 정해서, 그 경로를 실행·import하는 lane job을
  놓쳤습니다. `pnpm infra:check`가 import하는 `scripts/artifacts/paths.mjs`, Web·API step wrapper인
  `scripts/ci/lanes/run-timed-command.mjs`, API stress harness가 import하는 script가 그런 예입니다. `pnpm` script를 거친 간접 실행도
  같은 이유로 빠졌습니다.

## 해결

영향 목록을 손 목록 대신 재생성할 수 있는 inventory로 만들고, 사람의 의미 검토는 도구가 좁힌 범위에만 씁니다. 절차의 기준은
[plan authoring core](../../agent-workflows/plan-authoring/core.md#structural-change-impact-inventory)에 있습니다.

### 보완 도구

| 사각지대                          | 도구                                                               | 재현 명령                          |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| 이름·식별자                       | 패턴 regex(`patterns.tsv`, Unicode 단어 경계)                      | `pnpm plan:impact -- --spec <dir>` |
| 구조 패턴·식별자 없는 대상        | 계약 대상(`contract-targets.tsv`)과 블록 map                       | 같은 명령                          |
| import·문서 링크                  | import 대상 모듈과 anchor 링크 그래프(`impact.json`)               | 같은 명령                          |
| 처분 모듈의 이름·경로·export 참조 | consumer 전파(`consumers.tsv`, `@exports:<class>[:<경로 prefix>]`) | 같은 명령                          |
| 기존 동작                         | 해당 module의 기존 test                                            | `node --test <test file>`          |
| 같은 의미의 다른 표현             | 사람의 의미 검토(표시된 블록과 그 밖의 블록 리뷰)                  | 블록 리뷰 기록                     |

`rg`, ast-grep, LSP 같은 로컬 도구는 대화 중 후보를 찾는 보조 수단입니다. 절차의 근거 명령은 Node script 하나입니다. 이
script는 셸 pipe나 `rg`를 쓰지 않고, `git ls-files`와 Node regex만 사용합니다.

### 규칙

1. 경로 비교는 tracked 경로 집합과의 정확 일치로 합니다.
2. 중복을 제거하기 전에 출처(층, 경유 경로)를 key에 넣습니다.
3. 경로 구분자가 없는 단일 이름 literal은 근거가 약한 행으로 따로 표시합니다.
4. 모든 층에 같은 행 종류 집합을 적용하고, 층별 차이는 문서로 남깁니다.
5. 새 파일을 추가하는 변경은 stage(또는 `git add -N`)한 뒤에 tracked 목록 기반 검증을 다시 실행합니다.
6. 경로 영향은 "누가 이 경로를 읽는가"와 "누가 이 경로를 실행·import하는가"를 모두 따라갑니다. 실행 경로는 직접 `node` 호출뿐
   아니라 `pnpm` script(재귀, `--dir` package 포함), package script, image build까지 펼칩니다. Lane package 파일(test·harness·
   config)이 import하거나 경로로 읽는 저장소 script도 따라갑니다.

### Script 사용

```sh
pnpm plan:impact -- --spec <spec directory> [--root <repository>] [--out <output directory>]
```

Spec 디렉터리 형식은 `scripts/agents/common/plan-impact.mjs`의 `readSpec()` 주석이 정의합니다. 출력 기본 위치는
`.artifacts/tools/plan-impact/<spec 디렉터리 이름>/`입니다.

- Class: `classes`는 출력 순서, `passiveClasses`는 블록을 표시하지 않는 class(영향 없음, 다른 owner)입니다.
  `otherOwnerClasses`는 그중 다른 owner의 class입니다. File rule이 이 class인 파일은 universe glob 안에 있어도 블록 층에서
  빠지고, 그 파일의 active 행은 실패합니다. File rule이 그 밖의 passive class(예: 영향 없음)인 파일은 universe glob이나 계약
  대상으로만 들어옵니다.
- `@exports:<class>[:<경로 prefix>]`: 그 class의 파일 단위 계약 대상(prefix가 있으면 그 아래만)의 `export` 이름을 담은
  블록을 표시합니다. 대상 모듈 자신은 제외합니다.
- 추가 행(`additional/`)과 override는 줄 번호에 고정됩니다. 파일을 고친 뒤 다시 생성할 때 없는 줄은 실패하지만, 밀린 범위는
  잡지 못하므로 범위가 같은 내용을 가리키는지 다시 확인합니다.

출력 파일은 다음과 같습니다.

- `scan.tsv`: 패턴·import·링크로 잡힌 모든 줄
- `unclassified.tsv`: 분류 칸이 빈 줄 목록. 채운 뒤 spec의 `rows/`로 옮깁니다.
- `inventory.tsv`: 줄 층 결과(`scan`·`semantic`·`parent` 출처)
- `blocks.tsv`: universe의 모든 블록과 표시 여부. 의미 검토가 표시되지 않은 블록을 훑을 때 씁니다.
- `blocks-inventory.tsv`, `files-inventory.tsv`: 표시된 블록과 파일 단위 처분 대상
- `summary.json`: 수치와 실패 목록

다음 경우 exit 1로 실패합니다.

- 줄 층: 분류되지 않은 scan 줄(추가 행 범위 안이어도 자기 행이 필요), scan에서 사라진 분류 행(stale), hit가 0인 패턴,
  Parent override 없이 scan 분류와 다른 추가 행, 없는 줄을 가리키는 override·추가 행, 행·file rule의 모르는 class나 빈 사유,
  칸이 셋이 아닌 행, key가 `path:줄`(줄은 0으로 시작하지 않는 숫자)이 아닌 분류 행·override, `path:줄` 범위 형식이 아닌 추가
  행(malformed)
- 블록 층: 모르는 class나 빈 사유를 쓴 계약 대상·consumer, 없는 계약 경로(디렉터리 포함)·heading·줄, `blocks`·`file`이 아닌 계약 scope, 경로만이 아닌 `file` 대상, 어떤 블록과도 겹치지 않는 계약 selector, 블록 밖 비어 있지 않은 줄의 행, universe 밖
  파일의 active 행, export 이름을 찾지 못한 `@exports`
- 회귀 목록: 기대 class 블록 밖에 있는 리뷰 지적 줄, 없는 파일·줄을 가리키는 행

사용법 오류와 읽을 수 없는 spec(JSON 오류, class 목록 불일치, `1 ≤ N ≤ M`이 아닌 줄 범위, 쉼표 목록을 쓴 계약 selector)은 exit 2이며 출력 파일을 쓰지
않습니다. `impact.json`의 `classes`·`passiveClasses`·`otherOwnerClasses`는 필수입니다. `passiveClasses`는 `classes` 안,
`otherOwnerClasses`는 `passiveClasses` 안, 선택 항목 `blockClasses`는 passive가 아닌 class 안에 있어야 합니다.

줄 번호는 파일 끝 개행 뒤의 빈 줄까지 셉니다. Markdown과 파일 전체 블록은 그 줄에서 끝나므로 `blocks.tsv`에서 옮긴 범위가
그대로 유효하고, 그 뒤 줄은 없는 줄입니다.

### 블록 map

블록은 plan 개정이 리뷰하는 단위입니다.

- 코드: top-level 문장 하나와 그 앞 주석. 의존성 없는 lexer가 문자열·template·regex·주석을 구분해 prettier의 0열 문장
  시작을 읽습니다. 0열 decorator, generic 닫힘(`>`), class heritage 뒤 단독 `{`는 앞 문장에 속합니다.
- Markdown: 가장 작은 heading 절. Fenced code(` ``` `·`~~~`) 안의 `#` 줄은 heading이 아닙니다.
- JSON: root 배열·객체의 자식 하나
- 그 밖의 파일과 `.jsx`·`.tsx`: 파일 전체. JSX 본문은 JavaScript가 아니라서 parser보다 넓게, 좁지 않게 잡습니다.

## 검증

- `node --test scripts/ci/agents/common/agent-plan-impact.test.mjs`: 위 실패 조건마다 실패 사례가 있고, CRLF 입력과 `\` 경로 입력이 LF·
  `/` 입력과 같은 결과를 내는지 확인합니다.
- 코드 블록 map은 2026-10-02 snapshot(`0eafa5cd`)의 tracked `.mjs`·`.js`·`.cjs`·`.ts` 1,950개 파일에서 TypeScript parser
  기준 경계와 같습니다. Markdown·JSON·TOML은 parser가 아니라 첫 inventory의 같은 규칙과 비교했으므로 독립 근거가
  아닙니다. Fenced code 처리는 그 규칙에 없던 보완입니다.
- 같은 snapshot에서 손으로 만든 첫 inventory를 재생성하면 줄 층·블록 층·회귀 목록 수치와 출력 파일이 Python 원본과 같습니다.

## 참고

- [Plan authoring core](../../agent-workflows/plan-authoring/core.md#structural-change-impact-inventory)
- [CI surface ownership](../../ci/ci-surface-ownership.md): 실행 경로 규칙(규칙 6)을 lane 분류에 적용한 사례
