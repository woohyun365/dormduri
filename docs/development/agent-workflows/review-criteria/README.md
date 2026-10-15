# Review criteria

이 디렉터리는 독립 리뷰가 변경 유형별로 **무엇을 중요하게 보는가**를 저장소가 소유하는 기준 문서 모음입니다.
Severity 정의, gate, 리뷰 회차와 PASS 뒤 처분 같은 공통 규칙은 [QA workflow](../qa.md#review-criteria와-회차)가 소유하고,
이 디렉터리는 그 규칙이 적용할 기준 항목만 둡니다. Host별 실행(packet에 기준 문서를 싣는 방법)은 각
[host adapter](../adapters/README.md)가 정합니다.

## 기준 문서

| id                                          | 문서                                                                                                       | 적용하는 변경                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `documents`                                 | [Document review criteria](./documents.md)                                                                 | tracked 문서·plan·evidence의 규칙·사실·수치·근거 변경                                     |
| `agent-workflow-tooling`                    | [Agent workflow tooling criteria](./agent-workflow-tooling.md)                                             | agent workflow script·검사·helper·skill·역할 파일의 동작 변경                             |
| `swe`                                       | [SWE common criteria](./swe.md)                                                                            | 제품 code·공유 contract와 그 test·설정의 동작·구조 변경                                   |
| `web-fe-rendering-boundary`                 | [Web FE rendering boundary criteria](./web-fe-rendering-boundary.md)                                       | web frontend의 render 위치·server·client 경계·첫 render·체감 성능·부분 실패 변경          |
| `web-fe-state-data-cache`                   | [Web FE state, data, and cache criteria](./web-fe-state-data-cache.md)                                     | web frontend의 상태·server data·form·mutation·cache·외부 입력 검증 변경                   |
| `web-fe-component-architecture`             | [Web FE component architecture criteria](./web-fe-component-architecture.md)                               | web frontend의 component owner·API·분기·파일 배치·예시 fixture·공유 model 변경            |
| `web-fe-design-system`                      | [Web FE design system criteria](./web-fe-design-system.md)                                                 | web frontend의 design token·공통 UI 부품·화면 문구 원본 변경(시각 값·미감 제외)           |
| `web-fe-layout-responsive-device`           | [Web FE layout, responsive, and device criteria](./web-fe-layout-responsive-device.md)                     | web frontend의 viewport·기기별 표현·layout·overlay·scroll 변경                            |
| `web-fe-accessibility`                      | [Web FE accessibility criteria](./web-fe-accessibility.md)                                                 | web frontend의 상호작용 요소·keyboard·focus·상태 알림 변경                                |
| `web-bff-gateway-forwarding`                | [Web BFF gateway and forwarding criteria](./web-bff-gateway-forwarding.md)                                 | BFF route·upstream 전달·상태 변경 진입점 변경                                             |
| `web-bff-session-cookie-auth`               | [Web BFF session and cookie auth criteria](./web-bff-session-cookie-auth.md)                               | BFF session·token cookie 발급·갱신·삭제 변경                                              |
| `web-bff-server-read-error-privacy-shaping` | [Web BFF server read, error, and privacy shaping criteria](./web-bff-server-read-error-privacy-shaping.md) | server render data 읽기·upstream 오류 번역·응답 형태 변경                                 |
| `web-security-privacy-trust-authz-model`    | [Web security-privacy trust and authorization model criteria](./web-security-privacy-trust-authz-model.md) | 요청 신뢰 경계·권한 판정 변경(지금은 cookie 인증 상태 변경의 위조 방지)                   |
| `web-security-privacy-data-privacy-secret`  | [Web security-privacy data privacy and secret criteria](./web-security-privacy-data-privacy-secret.md)     | 개인정보·비공개 필드·비밀값의 표시·전달·저장·기록 변경(지금은 숨긴 신원·필드의 공개 범위) |

- 변경 유형으로 고릅니다. 문서와 script를 함께 바꾸면 두 문서를 모두 고릅니다. 오탈자·포맷처럼 QA의 독립 리뷰 trigger가 없는
  변경에는 기준 문서를 고르지 않습니다.
- 계획 readiness 리뷰는 `documents`를 쓰고, readiness 자체의 판정 항목은
  [Plan authoring core의 promotion gate](../plan-authoring/core.md#7-implementation-readiness-promotion)가 소유합니다.
- `swe`는 모든 영역에 공통인 SWE 기준을 소유합니다. Agent workflow script는 `swe` 대신 `agent-workflow-tooling`을 고르고,
  문서만 바꾸는 변경에는 `swe`를 고르지 않습니다. `swe.md` S2의 정책 원본은 그 도메인의 [정책 문서](../../../policies/README.md)이고, S7의 dependency 정책 원본은
  [AGENTS.md 5절](../../../../AGENTS.md#5-implementation-agreements)과 [dependency security policy](../../../policies/dependency-security.md)입니다.
- 영역 기준 문서(`web-<layer>-<하위 layer>`)를 고르면 `swe`와, 그 문서 머리말이 상속한다고 적은 문서도 함께 고릅니다.
- 제품 영역(FE·BFF·BE·DB·infra·security) 기준 문서는 영역 owner와 함께 이 형식으로 추가합니다. 지금은 FE 하위 layer 6개, BFF
  하위 layer 3개, BFF가 상속하는 security-privacy 항목 2개의 문서가 있습니다. 기준 문서가 없는 영역(BE·DB·infra와 security-privacy의
  나머지)은 영역 plan-authoring guide와 [visual design review contract](../visual-design/design-review-and-acceptance.md) 같은 기존
  owner 문서를 acceptance 근거로 씁니다. 시각 값과 미감은 FE 기준 문서가 아니라 visual design 문서가 소유합니다.

## 항목 형식

문서당 항목 수 상한은 두지 않습니다. 적용 조건이 다른 항목이 섞이면 문서를 나눕니다. 각 항목은 `### <문자><번호>. <이름>`
제목과 아래 일곱 줄을 이 순서로 가집니다.

```text
- 질문: reviewer가 판정할 한 문장 질문
- 기본 severity: `critical` | `high` | `medium` | `low` (QA severity 정의)
- 적용 조건: 이 항목을 판정하는 변경의 범위
- 결함 패턴: 이 항목이 실제로 잡아야 했던 결함 유형의 요약
- PASS 근거: 충족을 보이는 관측(test·runner 기록·source 위치)
- 지침: 구현할 때 해야 할 것
- 피함: 구현할 때 피할 것
```

- 한 항목이 두 보기를 함께 가집니다. 지침·피함은 구현할 때 보는 구현 보기이고, 질문·기본 severity·결함 패턴·PASS 근거는 리뷰할
  때 보는 리뷰 보기입니다. 적용 조건은 두 보기가 함께 씁니다. 두 보기를 같은 블록에 두어 한쪽만 바뀌는 일이 diff에 보이게 합니다.
- 문서마다 항목 문자 하나를 씁니다(`documents` D, `agent-workflow-tooling` W, `swe` S, 영역 문서는 FE `F`·BFF `B`·security-privacy
  `P`). 영역 문서는 첫 항목 앞 머리말에 상속하는 문서·항목과 강화 관계를 적고, 그 항목은 상속한 항목을 강화만 합니다.
- 구현 지침 문서(plan-authoring guide)는 항목 문장을 다시 쓰지 않고 `[swe.md S4](./swe.md#s4-책임-경계와-결합도)`처럼 항목 제목
  anchor로 인용합니다. 구현 guide가 없는 저장소 전용 기준(`documents`·`agent-workflow-tooling`)을 뺀 모든 항목은 guide 하나 이상이
  인용해야 합니다.
- 결함 패턴은 유형 요약입니다. Local 증거 경로, plan 파일명, 작업 단계 이름을 근거로 인용하지 않습니다.
- Reviewer는 적용 조건에 맞는 항목을 판정합니다. 미충족 항목은 `criteriaItem` 필드에 항목 id 하나(예: `documents.md D2`)만 적은
  finding이 되고 기본 severity에서 시작하며, 다르게 매기면 finding에 이유를 적습니다. 관련 항목과 이유는 finding 본문에 적습니다. 리뷰 기록 측정은 이 필드로 항목을 셉니다. 충족한 항목은 finding이 아니라 그 항목의 PASS 근거에 해당하는 관측으로 acceptance coverage에 씁니다.
- 결정적 검사가 이미 판정하는 내용(Markdown link·anchor 해석 등)은 항목으로 두지 않습니다.

## 결정적 검사

리뷰를 dispatch하는 runner가 리뷰 전에 실행하는 host 공통 검사입니다. 도구 자체는 `scripts/ci/agents/common/`의 fixture
test가 보호하지만, ignored 입력(계획·증거·runner 기록)에 대한 적용은 runner가 실행하고 그 출력을 기록할 때만 효력이
있습니다. CI는 ignored 입력을 보지 못합니다.

| 검사        | 명령                                                                                                           | 위반 종류                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인용        | `node scripts/agents/common/citation-check.mjs [--root <repo>] [--json] <md file...>`                          | `unresolved`·`ambiguous`·`invalid-range`·`out-of-range`·`unreadable`·`invalid-expectation`·`content-mismatch`                                                                         |
| Runner 기록 | `node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header <첫 줄> [--root <repo>] [--json]`  | `invalid-record`·`missing-output`·`output-missing`·`digest-mismatch`·`header-mismatch`·`exit-mismatch`·`invalid-fragment`·`summary-mismatch`                                          |
| RED 사유    | `node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex> [--expect <regex>...] [--json]` | `missing-summary`·`no-failure`·`no-failure-blocks`·`unexpected-reason`·`unexpected-signature`                                                                                         |
| Mutation    | `node scripts/agents/common/mutation-harness.mjs --spec <JSON> [--link-node-modules] [--root <repo>] [--json]` | `baseline-failed`·`survived`·`target-missing`·`ambiguous`·`wrong-reason`·`timeout`                                                                                                    |
| 계획 참조   | `node scripts/agents/common/plan-reference-check.mjs [--root <repo>] [--report-only] [--json] <plan md...>`    | `unresolved`·`unresolved-target`·`duplicate-definition`·`broken-link`                                                                                                                 |
| 처분 기록   | `node scripts/agents/common/review-adjudication.mjs [--root <repo>] [--json] <adjudication.json...>`           | `invalid-field`·`unknown-key`·`result-unreadable`·`missing-finding`·`duplicate-finding`·`unknown-finding`·`missing-reason`·`missing-origin`·`invalid-duplicate`·`duplicate-result-id` |

- Exit 0은 위반 없음, 1은 위반, 2는 입력 오류(option·파일·root 없음, 읽기 실패, 빈 입력, 형식이 틀린 header·regex·spec·JSON,
  git 저장소 밖의 root, 알 수 없는 option·spec key, 지원하지 않는 형식, 만들 수 없는 mutation 사본)입니다. 입력 오류를 통과로 세지 않습니다. `--json`은 summary와 위반 목록을 JSON으로 냅니다.
- 명령줄의 입력 파일은 현재 디렉터리 기준이고, 인용·runner 기록·처분 기록 안의 경로는 `--root`(기본: 현재 git 저장소 root)
  기준입니다. Mutation spec의 경로는 [Mutation](#mutation)을 따릅니다.
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

### Mutation

- Spec은 `{command: [argv], timeoutSeconds?: 300, mutations: [{id, file, find, replace, occurrence?, expect?: [regex]}]}`입니다.
  `file`은 저장소 root 기준 경로(`--root`가 하위 디렉터리여도 그 저장소의 root), `occurrence`는 1부터 셉니다. 정규화한 경로가 저장소 밖(절대 경로, `..`)이거나 모르는 key가 있으면 입력 오류입니다.
- 원 작업 tree는 읽기만 합니다. HEAD의 detached worktree에 현재 diff와 ignore되지 않은 untracked 파일을 옮긴 사본에서
  baseline과 mutation을 실행하고, 끝나면 worktree를 지웁니다. Ignored 파일은 사본에 없습니다. Symlink를 따라 사본 밖으로
  나가는 `file`(linked `node_modules` 등)은 쓰지 않고 `target-missing`입니다.
- SIGINT·SIGTERM을 받으면 실행 중인 명령의 process group을 멈추고 사본을 지운 뒤 exit 130·143으로 끝납니다. SIGKILL처럼
  처리할 수 없는 중단은 사본과 worktree 등록을 남기므로(known limit) `git worktree list`에서 `mutation-harness-` 사본을 찾아
  `git worktree remove --force <경로>`로 지웁니다.
- Baseline이 exit 0이 아니면 mutation을 실행하지 않고 위반 하나로 끝냅니다. Mutation마다 적용 → 실행 → 복원합니다.
- `killed`는 exit가 0이 아니고, `expect`가 있으면 출력(stdout·stderr)이 모든 pattern과 맞는 경우입니다. 나머지 상태는
  모두 위반입니다. `find`가 없거나 `occurrence`가 일치 수를 넘으면 `target-missing`, 두 번 이상 맞는데 `occurrence`가
  없으면 `ambiguous`입니다. `timeout`은 명령의 process group 전체를 멈춥니다.
- `--link-node-modules`는 root와 workspace의 `node_modules`를 사본에 symlink합니다. Workspace package는 원 checkout을 읽게
  되므로 `packages/` 아래(정규화한 경로, 대소문자 무시) mutation과 함께 쓰면 입력 오류입니다.

### 계획 참조

문법과 판정은 [Plan references](../plan-authoring/references.md)가 소유합니다. 이 문법 전부터 있던 계획은 `--report-only`로
건수만 기록합니다.

### 처분 기록

- [QA 리뷰 회차](../qa.md#리뷰-회차)의 finding별 처분을 기계로 검사할 수 있게 쓰는 형식입니다. 파일은 reviewer result 옆의
  `<회차>-adjudication.json`입니다.

```json
{
  "schema": "review-adjudication/v1",
  "subject": "<변경 이름>",
  "round": 2,
  "reviews": [{ "taskId": "<reviewer task id>", "resultPath": "<--root 기준 result JSON 경로>" }],
  "findings": [
    { "id": "<task id>#0", "severity": "medium", "disposition": "fixed", "origin": "fix-induced" }
  ]
}
```

- Finding id는 result finding의 `id`, 없으면 `<task id>#<result findings 배열 index, 0부터>`입니다. 나열한 result의 모든
  finding이 정확히 한 번 나와야 하고 모르는 id는 위반입니다. 두 result finding이 같은 id를
  가지면 처분 하나가 둘을 덮으므로 `duplicate-result-id`입니다.
- `severity`는 QA severity, `disposition`은 `fixed`(회차 중 수정)와 [PASS 뒤 처분](../qa.md#pass-뒤-처분) 값
  `fixed-mechanical`·`deferred`·`rejected`·`pre-existing`입니다. `deferred`·`rejected`는 `reason`이 필요합니다. 회차 중과
  PASS 뒤의 구분은 검사하지 않습니다.
- `duplicateOf`는 같은 기록의 다른 finding(다른 reviewer가 낸 같은 결함)이고 그 finding의 disposition을 따릅니다. 중복의
  중복은 위반입니다.
- 2회차부터 `origin`이 필요합니다: `fix-induced`(수정이 들여온 결함), `previously-missed`(이전 회차가 놓친 결함),
  `re-raised`(다시 제기된 결함). `fixRef`는 선택입니다.

### 리뷰 측정

[공통 ledger](../../../../scripts/agents/common/review-ledger.mjs)는 host reader가 준 행에서 상태·verdict·severity·기준
항목·회차·처분·기원 건수를 셉니다. 측정이며 판정이 아닙니다. 형식이 틀린 행은 이유와 함께 건수에서 뺍니다.

- Claude: `node scripts/agents/claude/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]... [--until <ISO 시각>] [--json]`.
  Native registry의 `knu_reviewer` task를 읽고, `--adjudications` 아래 `*-adjudication.json`과 task id로 연결합니다. 처분
  기록이 틀리거나(JSON이 아닌 기록, 한 task를 두 기록이 처분한 경우 포함) 형식이 틀린 행이 있으면 exit 1입니다. `--until`은
  발행 시각이 그 시각 이전인 task만 세고, 발행 시각을 읽지 못한 task는 빼고 그 수를 `excludedWithoutIssuedAt`으로 냅니다.
- 행 상태: `parsed`, `parse-failed`(마지막 응답에 result JSON 없음), `completion-missing`, `task-unreadable`(task 기록을 읽지
  못해 reviewer인지 모르는 task도 행으로 셈). 회차는 reviewer
  prompt의 `Review round N`에서 읽고, 회차 입력 전 기록은 `unknown`입니다.

## 갱신

리뷰가 놓쳐 merge 뒤 발견된 결함과 Parent가 재현으로 기각한 finding은 기준 항목 갱신의 입력입니다. 갱신은 이 디렉터리의 문서
변경이며 다른 문서와 같은 독립 리뷰 규칙을 따릅니다. 문서 graph test가 항목 제목·일곱 줄의 형식·순서(다른 필드·중복 없음),
README에 항목 수 상한이 없음, guide 인용(해석, 인용되지 않은 항목)을 검사합니다.
