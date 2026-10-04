# Review criteria

이 디렉터리는 독립 리뷰가 변경 유형별로 **무엇을 중요하게 보는가**를 저장소가 소유하는 기준 문서 모음입니다.
Severity 정의, gate, 리뷰 회차와 PASS 뒤 처분 같은 공통 규칙은 [QA workflow](../qa.md#review-criteria와-회차)가 소유하고,
이 디렉터리는 그 규칙이 적용할 기준 항목만 둡니다. Host별 실행(packet에 기준 문서를 싣는 방법)은 각
[host adapter](../adapters/README.md)가 정합니다.

## 기준 문서

| id                       | 문서                                                           | 적용하는 변경                                                 |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `documents`              | [Document review criteria](./documents.md)                     | tracked 문서·plan·evidence의 규칙·사실·수치·근거 변경         |
| `agent-workflow-tooling` | [Agent workflow tooling criteria](./agent-workflow-tooling.md) | agent workflow script·검사·helper·skill·역할 파일의 동작 변경 |

- 변경 유형으로 고릅니다. 문서와 script를 함께 바꾸면 두 문서를 모두 고릅니다. 오탈자·포맷처럼 QA의 독립 리뷰 trigger가 없는
  변경에는 기준 문서를 고르지 않습니다.
- 계획 readiness 리뷰는 `documents`를 쓰고, readiness 자체의 판정 항목은
  [Plan authoring core의 promotion gate](../plan-authoring/core.md#7-implementation-readiness-promotion)가 소유합니다.
- 제품 영역(FE·BE·infra) 기준 문서는 영역 owner와 함께 이 형식으로 추가합니다. 그 전에는 영역 plan-authoring guide와
  [visual design review contract](../visual-design/design-review-and-acceptance.md) 같은 기존 owner 문서를 acceptance 근거로 씁니다.

## 항목 형식

문서마다 항목은 **8개 이하**입니다. 상한은 기준이 의례적 checklist로 길어지는 것을 막기 위한 값이며, 새 항목이 필요하면 가장
적게 걸린 항목을 합치거나 교체합니다. 각 항목은 `### <문자><번호>. <이름>` 제목과 아래 네 줄을 가집니다.

```text
- 질문: reviewer가 판정할 한 문장 질문
- 기본 severity: `critical` | `high` | `medium` | `low` (QA severity 정의)
- 적용 조건: 이 항목을 판정하는 변경의 범위
- 결함 패턴: 이 항목이 실제로 잡아야 했던 결함 유형의 요약
```

- 결함 패턴은 유형 요약입니다. Local 증거 경로, plan 파일명, 작업 단계 이름을 근거로 인용하지 않습니다.
- Reviewer는 적용 조건에 맞는 항목을 판정합니다. 미충족 항목은 항목 id(예: `documents.md D2`)를 적은 finding이 되고 기본
  severity에서 시작합니다. 다르게 매기면 finding에 이유를 적습니다. 충족한 항목은 finding이 아니라 acceptance coverage의 근거로 씁니다.
- 결정적 검사가 이미 판정하는 내용(Markdown link·anchor 해석 등)은 항목으로 두지 않습니다.

## 결정적 검사

리뷰를 dispatch하는 runner가 리뷰 전에 실행하는 host 공통 검사입니다. 도구 자체는 `scripts/ci/agents/common/`의 fixture
test가 보호하지만, ignored 입력(계획·증거·runner 기록)에 대한 적용은 runner가 실행하고 그 출력을 기록할 때만 효력이
있습니다. CI는 ignored 입력을 보지 못합니다.

| 검사        | 명령                                                                                                           | 위반 종류                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 인용        | `node scripts/agents/common/citation-check.mjs [--root <repo>] [--json] <md file...>`                          | `unresolved`·`ambiguous`·`invalid-range`·`out-of-range`·`unreadable`·`invalid-expectation`·`content-mismatch`                                |
| Runner 기록 | `node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header <첫 줄> [--root <repo>] [--json]`  | `invalid-record`·`missing-output`·`output-missing`·`digest-mismatch`·`header-mismatch`·`exit-mismatch`·`invalid-fragment`·`summary-mismatch` |
| RED 사유    | `node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex> [--expect <regex>...] [--json]` | `missing-summary`·`no-failure`·`no-failure-blocks`·`unexpected-reason`·`unexpected-signature`                                                |

- Exit 0은 위반 없음, 1은 위반, 2는 입력 오류(option·파일·root 없음, 읽기 실패, 빈 입력, 형식이 틀린 header·regex, git
  저장소 밖의 인용 검사 root, 알 수 없는 option, 지원하지 않는 형식)입니다. 입력 오류를 통과로 세지 않습니다. `--json`은 summary와 위반 목록을 JSON으로 냅니다.
- 명령줄의 입력 파일은 현재 디렉터리 기준이고, 인용과 runner 기록 안의 경로는 `--root`(기본: 현재 git 저장소 root) 기준입니다.
- 인용 검사는 존재와 줄 범위만 봅니다. 고친 줄 번호가 같은 내용을 가리키는지는 내용 대조(아래)가 있을 때만 판정되므로,
  [PASS 뒤 처분](../qa.md#pass-뒤-처분)에서 인용 줄 번호 수정의 결정적 검사로 쓰려면 그 인용에 내용 대조를 붙입니다.

### 인용

- 대상은 fenced code 밖 backtick 안의 `<path>.<ext>:<줄>`과 `<path>.<ext>:<시작>-<끝>`입니다. `--root` 기준으로 그 경로가
  있거나 확장자가 tracked 파일의 확장자이면 인용입니다. 그 밖(`localhost:3000`, `example.com:443`)은 건수(`notCitations`)만 셉니다.
- 해석 순서는 `--root` 기준 정확 경로(대소문자까지 일치) → tracked 경로의 고유 접미입니다. 경로 없는 파일 이름도 고유하면
  해석되고, 해석되지 않는 인용(오타 파일 이름 포함)은 위반입니다. 줄 수는 마지막 줄바꿈 뒤의 빈 줄까지 셉니다.
- 내용 대조는 선택입니다. 인용 바로 뒤에 `~ "문자열"`을 쓰면 그 줄 범위에 문자열이 있어야 합니다(`\"`·`\\` escape). 빈
  문자열과 닫히지 않은 따옴표는 위반입니다. 줄 번호만으로는 줄이 다른 내용으로 밀린 경우를 잡지 못합니다.
- Backtick 없는 인용과 다른 형식의 code span 안 인용(`path.ext:3:5`, `see path.ext:3`)은 검사하지 않고 건수(`unchecked`)만 셉니다. 인용이 주장의 근거로 맞는지는
  [documents.md D2](./documents.md#d2-근거-참조의-현재성)가 판정합니다.

### Runner 기록

- Header는 `<문구> sha256:<64 hex>` 형식이고 마지막 token이 digest입니다. Record의 공통 필드만 읽습니다: `exit`(정수),
  `outputPaths`(비어 있지 않은 배열), `observedResult`(문자열), 있으면 `sourceDigest`(header digest와 같아야 함). 필드 형식
  전체는 각 host의 runner helper가 검사합니다.
- `.log`·`.txt` 출력은 첫 줄이 header와 같아야 하고, 마지막 `exit=<n>` 줄이 있으면 record의 `exit`와 같아야 합니다. 다른
  형식 출력은 존재만 확인합니다.

요약 조각 작성 규칙: `observedResult`의 backtick 조각은 그 record의 `.log`·`.txt` 출력과 대조합니다.

- 조각은 그 실행의 결과 줄에서 로그에 찍힌 라벨과 함께 그대로 옮깁니다(`ℹ pass 873`, `exit=0`, `Install dependencies=28`).
- 라벨 없는 조각(공백을 빼면 숫자·hex 문자·구두점·기호만인 `41`·`208`), 빈 조각, 짝이 맞지 않는 backtick은
  `invalid-fragment`입니다.
- 조각은 header 줄과 digest 줄(`<64 hex>  <path>` 형식의 `shasum` 출력, `sha256:<64 hex>`를 포함한 줄)을 뺀 줄 하나에
  token으로 있어야 합니다. 조각 앞뒤는 줄 시작·끝이거나 영숫자·`_`·`.`·`-`가 아닌 문자여야 하므로 `ℹ pass 87`은
  `ℹ pass 873`과 맞지 않습니다. 없으면 `summary-mismatch`입니다.
- Backtick 조각이 없는 요약은 대조하지 않고 건수(`unverifiedSummaries`)만 셉니다.
- 한 로그에는 한 실행만 둡니다. 같은 라벨이 echo된 명령 문구나 같은 로그의 이전 실행 출력에 있으면 우연히 일치할 수
  있습니다(known limit).

### RED 사유

- 입력은 `node --test` spec reporter 출력이고, `--expect`는 기대 실패 사유 regex(Unicode mode)이며 하나 이상 필요합니다. 빈
  문자열과 맞는 pattern(`''`, `.*`)은 모든 줄과 맞으므로 입력 오류입니다.
- `ℹ fail` 값이 0보다 커야 하고, `✖ failing tests:` 절의 실패 block마다 오류 본문(`✖` 줄 다음부터 다음 결과 줄 전까지)에
  `--expect`와 맞는 줄이 있어야 합니다. Block이 하나도 없으면 위반입니다.
- Block 수는 `ℹ fail`과 비교하지 않습니다. 하위 test 실패로 실패한 상위 test는 `ℹ fail`에 세지만 그 절에 block이 없기
  때문입니다. 그래서 잘린 로그의 빠진 block은 잡지 못합니다(known limit). 출력의 `fail`·`failures`가 다르면 runner가 로그를
  확인합니다.
- 기대 밖 사유 signature(`SyntaxError`, `ERR_MODULE_NOT_FOUND`, `Cannot find module`·`Cannot find package`, `ReferenceError`,
  `does not provide an export`, `ENOENT`)가 `--expect`와 맞지 않는 줄에 있으면 위반입니다. 실패 block 밖(예: import 오류의
  stderr)도 검사합니다. 결과 줄(`✔`·`✖`·`﹣`·`ℹ`·`▶`로 시작하는 줄과 `test at` 줄)은 test 제목이므로 사유로 읽지 않습니다.

## 갱신

리뷰가 놓쳐 merge 뒤 발견된 결함과 Parent가 재현으로 기각한 finding은 기준 항목 갱신의 입력입니다. 갱신은 이 디렉터리의 문서
변경이며 다른 문서와 같은 독립 리뷰 규칙을 따릅니다. 문서 graph test가 항목 형식과 상한을 검사합니다.
