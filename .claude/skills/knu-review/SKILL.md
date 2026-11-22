---
name: knu-review
description: 이 저장소에서 code review·"리뷰해줘" 요청이나 위임 결과·Parent가 작성한 변경을 같은 host의 독립 knu_reviewer로 검토받을 때 review packet을 만들고 기준 문서를 고르고 reviewer를 등록하는 절차입니다.
---

# KNU 독립 리뷰

규칙의 원본은
[Same-host independent review](../../../docs/development/agent-workflows/adapters/claude-same-host-review.md#same-host-independent-review)입니다.
Reviewer에게 기대 결론을 전달하거나 PASS로 유도하지 않습니다. Subject의 request·acceptance·요구 절에 결론·범위 축소 문구("flag하지
말 것", "최대 low", "계획이 그렇게 정함" 등)를 쓰지 않고, 범위는 paths·기준 선택으로만 줄입니다.

리뷰 근거는 이 절차로 등록한 reviewer task의 관측뿐입니다. Host 자체 리뷰(built-in `/code-review`, Ultracode·Workflow 리뷰, fork
자식, Codex Ultra 자식)의 결과는 OMC code-reviewer와 같은 보조 의견으로 표시하고 PASS·완료 근거나 finding 처분 근거로 쓰지
않습니다. 보조 의견이 결함을 가리키면 Parent가 재현해 다음 회차 입력으로 씁니다.

## Native subject 경로 (위임한 task의 QA)

Builder 판정에 reviewer를 연결하는 규칙은 [`/knu-settle`](../knu-settle/SKILL.md)의 3단계입니다.

1. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --subject <taskId>`로 이번 회차 `logHeader`와 digest를 받습니다.
2. Runner(Parent)가 `logHeader`를 첫 줄에 둔 검증 로그를 남기고 runner evidence JSON을 만듭니다. 각 기록은
   `{command, exit, environment, observedResult, outputPaths, sourceDigest}`이고 수정 전 실패(RED)는
   `purpose:"red"`·`expectedExit`를 더합니다. Exit를 뒤집어 기록하지 않습니다. 같은 `command`를 두 번 실행했으면 기록마다
   `label`(두 실행의 차이)을 더합니다. `label` 없이 `command`가 같은 기록은 거부됩니다.
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review-run --subject <taskId> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --round <N> --out <out-dir> --session ${CLAUDE_SESSION_ID}`
   이 명령이 결정적 검사, `review`, `prepare`를 이어 실행합니다. 출력과 실패 처리는 아래 [review-run 결과](#review-run-결과)를
   따릅니다.
4. `review-run.json`의 `reviewers[]`마다 `invocationFile`의 내용 그대로 Agent를 호출합니다.
5. 알림 뒤 `/knu-settle`로 reviewer를 정산합니다.

## Parent 작성 diff 경로

Native subject가 없는 Parent 변경의 검토입니다. Builder의 `reviewerTaskId`를 대신할 수 없습니다.

1. Subject 파일은 `{"request": "...", "owner": "parent", "acceptance": ["..."], "paths": ["..."]}` JSON입니다. `request`는 요구사항(사용자
   요청·issue·plan acceptance를 옮긴 문장)이고 구현 설명·추론·자기평가는 넣지 않습니다. `owner`는 작성자 식별자, `acceptance`는 판정
   기준 문장, `paths`는 리뷰 대상 파일과 그 소비자·실행 경로입니다([Dispatch 전 단계](#dispatch-전-단계)의 Subject 경로. native task
   기록과 local state는 넣을 수 없음). 선택 필드
   `requirementSections: [{"path": "<plan 경로>", "headings": ["<절 heading>"]}]`는 plan의 판정 원본 절(acceptance·invariant·Owner 결정
   기록)만 helper가 잘라 reviewer 입력으로 주고, plan 파일은 read path에 넣지 않습니다(`paths`에 그 plan이나 그 위 디렉터리를 함께 주면
   `requirement-path-in-paths`로 거부). Heading은 `#`를 뺀 정확한 문자열이고 plan 안에 한 번만 있어야 합니다. 선택 필드
   `lifecycleDraft: "<경로>"`는 PR 본문 초안 파일이고 helper가 그 `## Lifecycle` 절만 잘라 reviewer가 등급·정책 줄을 diff와 대조합니다
   (원본 초안은 read path가 아님. 없거나 `## Lifecycle` 절이 없거나 둘 이상인 파일은 `lifecycle-draft-invalid`). `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --parent-subject <absolute-subject-path> --session ${CLAUDE_SESSION_ID}`로
   `logHeader`를 받습니다.
   - `paths`의 `.omc/`·`.omx/`·`.codex/state/`·`.claude/projects/` 아래 경로는 `local-state-path:<path>`로, Home(`~`) 경로와
     절대 경로는 `path-not-repository-relative:<path>`로 거부됩니다(`lifecycleDraft`도 같음). 추적 `.claude/` 설정·skill·역할
     파일은 해당하지 않습니다.
   - `request`에 완료형 구현 서술(`고쳤다`·`구현했다` 등)이 있으면 출력 `warnings`에 `request-implementation-marker`가 나오고 packet
     `evidence.environment`에 그 문장 수가 남습니다. 리뷰를 막지는 않지만 걸린 문장은 packet `objective`에 그대로 남으니 `request`를
     요구사항 문장으로 고쳐 다시 `review`합니다.
   - `request`·`acceptance`·`requirementSections` 발췌에 사전 판단 문구(지적하지 말 것, severity 상한, 계획이 이미 골랐다는 문장)가
     있으면 `warnings`에 `review-prejudgment-phrase`가 나오고 packet `evidence.environment`에 그 문장 수가 남습니다. 막지 않으니 걸린
     문장을 결론·범위 축소 없는 요구 문장으로 고칠지 판단합니다
     ([사전 판단 문구 경고](../../../docs/development/agent-workflows/review-criteria/README.md#사전-판단-문구-경고)).
   - 출력 `warnings`의 입력 완전성 경고는 리뷰를 막지 않습니다. `acceptance-not-in-requirement-sections`(acceptance 문장이
     `requirementSections` 절의 문장과 글자로 같지 않음)는 plan 문장을 그대로 옮기고, `lifecycle-draft-verification-missing`
     (초안에 `Not tested` 줄이 있는 `## Verification` 절이 없음)은 초안에 검증 절을 채웁니다. `layout-owner-not-in-read-paths`·
     `policy-history-rule-not-in-read-paths`는 경고가 가리키는 규칙 owner 문서를 `paths`에 더할지 판단합니다.
2. 그 digest로 runner evidence를 만듭니다(기록 형식은 native subject 경로 2단계와 같습니다).
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review-run --parent-subject <absolute-subject-path> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --round <N> --out <out-dir> --session ${CLAUDE_SESSION_ID}`
   이 명령이 결정적 검사, `review`, `prepare`를 이어 실행합니다. 출력과 실패 처리는 아래 [review-run 결과](#review-run-결과)를
   따릅니다. 2회차부터는 이 명령만 Parent subject를 받습니다(공통 절의 회차 입력).
4. `review-run.json`의 `reviewers[]`마다 `invocationFile`의 내용 그대로 Agent를 호출합니다. Packet은 prompt에 싣지 않고
   `.artifacts/tools/claude-review-packets/<reviewId>.json`에 씁니다. Prompt에는 `KNU_REVIEW_PACKET_FILE:<경로> <digest>` 한 줄만
   남고 reviewer가 그 파일을 먼저 읽습니다. `reviewers[].packetFile`이 같은 경로와 digest입니다.
5. 정산은 `parent-adjudication`입니다. `/knu-settle`의 reviewer 종류 구분을 따릅니다.

## review-run 결과

- Stdout은 `review-run ok …` 또는 `review-run failed …` 한 줄이고 결과는 `<out-dir>/review-run.json`입니다. 다른 출력(설치
  안내 등)이 stdout에 섞여도 그 파일로 결과를 읽습니다. `--out`은 저장소 안 ignored 디렉터리이고 리뷰 read path 밖(예: 계획 증거
  위치의 `review/r<N>-run/`)에 둡니다. Packet 디렉터리(`.artifacts/tools/claude-review-packets/`), native task 기록, subject
  `paths` 안이면 `out-directory-required`로 거부됩니다. lockfile이 바뀐 직후에는 helper 전에 `pnpm install --frozen-lockfile`을 먼저 실행합니다.
- 검사(`checks[]`의 이름·exit·`outputPath`)가 하나라도 실패하면 exit 1이고 등록하지 않습니다. `review`나 `prepare`가 요청을
  거부해도 exit 1이고 `error`에 사유가 남습니다. 예상하지 못한 오류(Git·파일 쓰기 실패)도 같은 기록에 `unexpected: true`로
  남고 stdout은 `error=`입니다. 구성원 일부만 등록된 뒤 실패했으면 `registered`의 task를
  `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native release --task <taskId> --not-dispatched`로 닫습니다.
- 통과하면 `reviewers[]`에 구성원마다 `taskId`, 등록한 호출 전체인 `invocationFile`, `specFile`, `packetFile`·`promptFile`·
  `runnerFile`·`inputsFile`이 있습니다. Agent는 `invocationFile`의 JSON(`subagent_type`·`model`·`description`·`prompt`)을 그대로
  입력으로 호출합니다. 짧은 `agentInput`(marker 한 줄, hook이 prompt를 주입)도 결과에 남지만 기본 경로가 아닙니다. Hook 뒤
  거부(auto classifier 판정 누락 등)로 `task already attempted`가 된 task는 같은 호출을 다시 보내지 않고
  [registry 4단계](../../../docs/development/agent-workflows/adapters/claude-native-registry.md)대로 그 `specFile`을 새로
  `prepare`해 전체 `invocation`으로 한 번 보냅니다(native subject 경로는 새 review).
- `reviewerRole`(역할과 선택 이유), `warnings`, `criteriaSelection`, 2회차부터 `deltaScope`가 함께 남습니다. Checkout을 여러
  세션이 함께 쓰는 운영이면 Agent 호출 전에 `boardLine`을 그 조율 기록에 적습니다(`--board-session <세션 이름>`,
  `--board-checkout main|product-clone`으로 채움).
- `review`와 `prepare`를 따로 실행하는 경로도 그대로 동작합니다(1회차와 native subject). 그때는 dispatch 전 7단계 검사를 직접
  실행합니다.

## Dispatch 전 단계

해당하는 단계만 실행하고, 각 실행은 runner evidence record로 남깁니다. 명령은 `scripts/agents/common/` 아래 도구이고 위반 종류와
규칙은 [결정적 검사](../../../docs/development/agent-workflows/review-criteria/README.md#결정적-검사)입니다. 아래 항목 이름과
순서는 Codex knu-review의 같은 절과 같습니다.

- Subject 경로: subject `paths`에 바뀐 파일과 함께 그 소비자·실행 경로(호출부, 그 동작을 실행하는 test·CLI 진입)를 넣습니다.
  Acceptance가 근거로 가리키는 절(PR 본문의 절 등)은 `requirementSections`·`lifecycleDraft`로 reviewer 입력에 둡니다.
- Runner 환경: runner·재현 로그 script는 `bash`로 실행합니다(Bash tool shell이 zsh면 파이프 앞 명령의 exit
  `${PIPESTATUS[0]}`가 비어 있습니다). 로그 첫 줄 `logHeader` 다음 줄에 `node --version` 출력을 남깁니다. 오래 도는 단계에는
  시간 상한을 두고, 회차 log는 회차마다 새 경로에 써서 이미 있는 log를 덮지 않으며, script 안에서 앞 출력을 지우는 대신 새
  디렉터리를 씁니다.
- Runner 기록 내용: record에는 명령·exit·출력 경로와 log의 결과 조각만 두고, Parent가 의심한 finding 위치나 결론 문장을 넣지
  않습니다.

1. 자체 정합 점검: 수정이 규칙·수치·범위를 바꾸면 같은 유형의 서술(같은 문서의 다른 절·표, 다른 owner 문서, 개수·합계)을 전 범위에서
   검색합니다. 다음 회차를 요청하기 전에 blocking 전부를 한 번에 고치고, 같은 유형 검색은 문장 단위(줄바꿈·연속 공백을 접는 검색
   또는 `rg -U`)로 저장소 전체 tracked 경로(ignored 원천은 `rg --no-ignore`)에서 하고, 결정적 검사를 통과시킨 뒤 요청합니다.
   계획 리뷰는 바뀐 결정·관계마다 그것을 말하는 문장 목록(같은 계획의 다른 절, 다른 owner 문서, 다른 언어로 적은 code 주석, 그
   값을 소유한다고 적은 문서, 그 글을 읽는 test)을 만들어 문장마다 판정합니다. 정합 검색 출력은 줄마다 판정한 기록(줄, 해당
   여부, 고친 곳)을 log에 남기고 검색 exit 0을 판정으로 쓰지 않습니다.
   로그에는 검색마다 명령과 exit 줄(`rg exit=1`은 0건)을 남기고, record는 검색을 모두 실행한 묶음의 exit 0과
   조각(`` `rg exit=1` `` 등)으로 씁니다. 0건 검색을 실패 record로 남기지 않고 exit를 뒤집는 명령(`|| true`, `!`)도 쓰지 않습니다.
   검색 exit 줄은 명령 이름을 붙여 적습니다(`rg exit=1`). 줄 전체 `exit=` 줄은 묶음의 끝 exit에만 씁니다. 검사는 record의
   log마다 마지막 줄 전체 `exit=` 줄을 record `exit`와 대조하고(`exit-mismatch`), 그 앞의 줄 전체 `exit=` 줄이 0이 아닌데 record가
   0이면 `repeated-step-exit-hidden`으로 실패합니다. 한 묶음을 여러 번 실행했으면 실행마다 record를 나눕니다.
   0건으로 부재를 주장하는 검색은 같은 검색을 수정 전 판처럼 결과가 있어야 하는 대상에 돌린 양성 대조를 같은 record에 두고 그 exit
   줄을 `control rg exit=0`처럼 적습니다(없으면 `runner-log-check`가 `absence-without-control` 경고). Ignored·hidden 경로의 부재
   검색은 `rg --no-ignore --hidden`으로 합니다. macOS `git grep -E`의 `\b`는 조용히 0건이므로 낱말 경계 검색은 `rg`나
   `git grep -P`로 합니다.
2. 새 파일: snapshot은 HEAD 기준이라 stage와 무관하고 새 파일은 내용 digest로 들어가므로 stage하지 않습니다. Tracked 파일만
   보는 검사(`pnpm test:repo-policy`)가 새 파일을 보게 하려면 commit한 snapshot에서 실행하고, commit 전이면 저장소 밖 독립
   clone에서 새 파일을 add한 뒤 실행해 record로 남깁니다. 메인 checkout의 stage를 바꾸지 않습니다.
3. RED 사유: RED 기록이 있으면 `red-reason-check.mjs`로 실패 사유를 대조합니다. 입력은 `node --test` spec reporter나 Vitest
   기본 reporter의 자르지 않은 출력입니다. `no-failure-blocks`이거나 block이 `'test failed'`뿐이면 module 수준 오류가 block 밖에
   찍힌 것이므로 `--test-isolation=none`으로 다시 실행합니다.
4. 인용: 리뷰 입력에 계획·증거·readiness Markdown이 있으면 `citation-check.mjs`를 실행합니다(staged 계획 파일은 5단계의
   `review-run`이 실행합니다).
5. 계획 리뷰 등급: 계획 리뷰면 등급을 선언하고 `plan-shape-check.mjs --revision`을 실행합니다(P0는 리뷰 없음, P1은 reviewer 없음.
   [계획 리뷰 등급](../../../docs/development/agent-workflows/session-continuity.md#계획-초안-staging과-promote)). P2·P3면
   `plan-reference-check.mjs`도 그 절 3번의 기준 대비 판정으로 실행합니다. `review-run`에
   `--plan-grade <P2|P3> --plan-drafts <staging 디렉터리> --plan-view <promote view> --plan-baseline <view를 만든 .plans 사본>`을
   함께 주면 이 검사들을 실행합니다. SOURCE-MANIFEST의 원본 sha256을 대조하고, view와 기준의 결속을 대조하고
   (`plan-view-binding`: view는 staged 파일을 그대로 담고 나머지 계획은 기준과 같으며 기준의 manifest 원본은 그 sha256), 등급 검사를 선언 등급으로 돌리고, 참조 검사는
   기준과 view에 함께 돌려 기준에 없던 위반이 0이고 새 unavailable 대상이 checkout에 있으면 통과로 판정하며(둘 다 exit 1인
   기존 위반은 실패가 아님. 새 unavailable 목록은 `checks/plan-reference-check.json`에 남으니 항목마다 확인), staged 계획에
   인용 검사를 돌립니다. P2의 바뀐 절 입력 `<plan>.scope.diff`(바뀐 절의 앞뒤)도 이 명령이 SOURCE-MANIFEST 원본과 staged
   파일로 만들어 `paths`에 더하고(`planScopeDiffs`), 인용한 결정 행은 Parent가 `paths`로 줍니다.
6. Mutation: 검사·harness 변경의 test 보호를 주장하면 `mutation-harness.mjs`를 실행합니다(spec은 계획 증거 위치의 리뷰
   디렉터리). 판정 분기의 test 보호를 주장하는 변경은 저장소 밖 독립 clone에서 바뀐 판정 module의 연산자 mutation sweep(비교·논리
   연산자, 경계값, 조건 반전)을 돌려 survivor 목록을 runner 기록에 두고, survivor를 동등으로 처분할 때마다 동등을 보이는 재현 입력과
   출력(결과가 달라질 수 있는 입력을 찾아본 범위 포함)을 붙입니다.
7. Runner 기록 검사: runner evidence의 `runner-log-check.mjs --evidence <JSON> --header "<logHeader>"`는 `review-run`이 실행하고
   exit 0이 아니면 등록하지 않습니다. 출력은 `<out-dir>/checks/`에 남습니다. `review`를 따로 실행할 때는 그 직전에 같은 option으로
   직접 실행하고 exit 0이 아니면 dispatch하지 않습니다. 위치 인자는 받지 않고 usage와 함께 exit 2입니다. 이 실행은 같은 evidence의
   record가 될 수 없습니다. 조각 위반의 `suggestion`은 그 log 결과 줄에서 맞는 조각 모양입니다. 경고 `absence-without-control`은
   exit를 바꾸지 않으니 양성 대조를 더하거나, 대조할 수 없으면 그 이유를 그 record의 log에 적습니다.

## 1회차 다중 reviewer

- [`qa.md` Independent review disposition](../../../docs/development/agent-workflows/qa.md#independent-review-disposition)
  trigger를 충족한 구현 변경의 1회차에만 `--composition e2|e3 --reviewers 2|3`을 더합니다. 계획 리뷰(P2·P3)는 단일입니다. `e3`는
  기준 문서(자동 선택이나 `--criteria`)가 필요하고 기준 항목을 구성원에게 연속 구간으로 나눕니다. 2회차부터는 단일 reviewer입니다.
- `review-run`이 구성원을 모두 등록하고 `review-run.json`의 `reviewers[]`(구성원마다 `taskId`·`invocationFile`·`specFile`)와
  `group`을 냅니다. Agent 호출 N개를 한 메시지에서 background로 보냅니다. 같은 구성원 spec을 다시 `prepare`해 보내지 않습니다.
  예외는 Parent 작성 diff 경로에서 hook 뒤 거부(auto classifier 판정 누락 등)로 결과 없이 실행되지 못해 `task already attempted`가 된
  구성원입니다. 그 `specFile`을 새로 `prepare`해 전체 `invocation`으로 한 번 보내고
  ([registry 4단계](../../../docs/development/agent-workflows/adapters/claude-native-registry.md)), 다시 실행되지 못하면 더 보내지 않고
  Owner와 다음 행동을 정합니다. Native subject 경로는 재등록하지 않고 새 review를 만듭니다. 거부된 호출은 completion이 없어 builder
  완료의 구성원 번호 검사에서 빠지지 않습니다(`review-group-duplicate-member`).
- 집계·처분은 `/knu-settle`의 그룹 처분 기록을 따릅니다.

## 공통

- 회차 입력: `--round <N>`은 항상 줍니다. 2회차부터 `--previous-result <absolute-result-path>`(직전 회차 result JSON을
  계획 증거 위치에 저장한 파일, 1회차가 그룹이었으면 그 회차의 `review-adjudication/v1` 처분 기록)를 더합니다. 회차와 처분 규칙은
  [QA 리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차)입니다.
- 2회차 범위: Parent subject의 2회차부터는 `review-run`이 직전 회차 뒤 바뀐 파일로 범위를 정해 `deltaScope`에 남깁니다. 바뀐
  파일이 모두 직전 subject `paths` 안이면 `delta`(바뀐 파일과 직전 blocking finding 위치)이고, 새 파일(`new-file`), 직전
  `paths` 밖 변경(`outside-previous-paths`), `--risk-trigger <qa.md trigger 항목>` 선언(`risk-trigger`), 직전 회차의 범위 기록
  없음(`previous-scope-record-missing`)이면 `full`과 그 이유입니다. Subject `paths` 안 ignored 파일도 같은 규칙입니다. 직전
  회차 입력 manifest의 원본 digest와 지금 원본을 비교해 바뀐 파일은 `delta`에 들고 새 파일은 `new-file`입니다. 그래서 회차마다
  새로 생기는 runner 출력·재현 로그는 subject `paths` 밖에 둡니다. Read path는 줄이지 않고 prompt의 회차 줄이 읽을 범위를
  지시합니다. `review`를 직접 부른 Parent subject의 2회차 이상은 `delta-scope-required`로 거부됩니다. Runner 검사는 매 회차 전
  범위로 다시 실행합니다.
- 기준 문서: `review`가 리뷰 대상 경로(Parent subject `paths`, native subject의 관측 변경 경로)로 고르고
  ([자동 선택](../../../docs/development/agent-workflows/review-criteria/README.md#자동-선택)) 출력 `criteriaSelection`에 문서·
  항목 수와 경로 키가 맞지 않은 경로(`unmatchedPaths`)를, `.artifacts/tools/claude-review-packets/<reviewId>.criteria.json`에
  선택 이유를 남깁니다. `unmatchedPaths`의 경로는 기준 없이 리뷰되므로 dispatch 전에 확인합니다. 다른 문서가 필요하면
  `--criteria documents,agent-workflow-tooling`처럼 id를 줘 override하고, 기록에는 자동 선택 결과도 남습니다.
  `--criteria none`(기준 문서 없음)은 기준 효과를 재는 비교 측정(교정·baseline)용이고 필수 리뷰에는 쓰지 않으며, 기록에 override
  `none`이 남습니다.
- 리뷰어 입력: `review`가 같은 리뷰 대상 경로로 intent·결정 기록·정책 문서, 고른 기준 문서에 걸린 binding 행과 `lifecycleDraft`의
  `## Lifecycle` 절을 고르고([리뷰어 입력](../../../docs/development/agent-workflows/review-criteria/README.md#리뷰어-입력)) read path와
  prompt 입력 줄에 넣습니다. 두 추출은 reviewer마다 `.artifacts/tools/claude-review-packets/<reviewId>.binding.md`·
  `<reviewId>.lifecycle.md`에 쓰고 prompt 기록이 digest로 결속하므로, 리뷰 중 바뀌면 정산이 `review-binding-changed`·
  `review-lifecycle-changed`로 거부합니다. 출력 `contextInputs`에 경로를, `<reviewId>.context.json`에 포함 이유를 남깁니다.
  binding·pack이 추출 규칙과 맞지 않으면 `review`가 `binding-values-invalid`로 멈춥니다.

- Reviewer prompt는 12,000자를 넘을 수 없습니다. Parent 경로는 packet이 파일로 빠진 뒤 크기입니다. Runner 기록의
  `environment`·`outputPaths`는 `.artifacts/tools/claude-review-packets/<reviewId>.runner.json`으로 빠지고 prompt에는
  `KNU_REVIEW_RUNNER_FILE:<경로> <digest>` 한 줄과 기록마다 `command`·`exit`·`observedResult`만 남습니다. Reviewer는 그
  파일의 `commandsActuallyRun`을 결과에 그대로 옮기고, 등록 뒤 파일이 바뀌면 정산이 `review-runner-file-changed`로 거부합니다.
  남는 초과는 기록의 `command`·`observedResult`와 acceptance 문장 길이에서 옵니다. 그래서 runner 기록의 낱개 줄은 log에 두고
  record에는 요약 조각만 둡니다. 긴 명령은 script 파일에 두고 record `command`에는 그 실행 한 줄을 적습니다(`command` 글자가
  prompt에 그대로 실립니다). `e3`에서 넘으면 구성원 배정 줄이 없는 `e2`를 고려하고, native subject 경로는 acceptance·read
  path도 줄입니다.
- `reviewerSpec`의 prompt는 고치지 않고 등록합니다. `review`가 reviewer마다 prompt digest를
  `.artifacts/tools/claude-review-packets/<reviewId>.prompt.json`에 남기고, 등록은 다른 prompt를 `review-prompt-changed`로, 기록이
  없거나 packet 파일 줄이 빠진 prompt를 `review-prompt-unbound`로 거부합니다(registry 직접 등록도 같음). 바꿀 것이 있으면 `review`를
  다시 만듭니다.
- Ignored 리뷰 입력(계획 staging, 증거, runner 출력, 직전 결과)은 사본으로 고정됩니다. Helper가 ignored read path 아래 입력을
  `.artifacts/tools/claude-review-packets/<reviewId>.inputs/`에 원래 경로 그대로 복사해 그 디렉터리를 read path로 주고,
  `KNU_REVIEW_INPUTS_FILE:` manifest가 사본마다 원본 경로와 digest를 결속합니다. `review` 생성부터 그 reviewer 정산과 연결
  builder 완료까지 사본이 바뀌면 `review-input-stale`·`review-input-changed`로 거부됩니다. 원본을 고친 것은 거부하지 않고 정산
  출력 `reviewInputOriginalsChanged`에 기록만 남습니다. 다만 reviewer의 Read·Grep·Glob이 바뀐 원본이나 그 상위 디렉터리를
  path로 지목한 것이 관측되거나 reviewer의 읽기를 가릴 수 없으면(transcript를 읽을 수 없음, 그 밖 도구)
  `review-input-changed:<원본 경로>`로 거부됩니다. Path 없는 검색과 저장소 root 검색은 원본을 지목한 것이 아닙니다. Ignored가 아닌 read path 아래 `.plans/`·`.artifacts/`·`.local-docs/`의 ignored
  파일은 사본 없이 지금처럼 원본이 결속되므로 리뷰 중 바꾸지 않습니다. Tracked·비ignored 리뷰 대상은 snapshot이 결속하므로
  reviewer가 실행 중일 때 수정하지 않습니다.
- 마지막 입력 수정 뒤 runner를 실행하고 바로 `review-run`을 실행합니다. Runner가 실행된 시점의 입력은 결속되지 않으므로 runner
  로그에 입력 sha256을 남기는 관례는 유지합니다. 그 회차가 읽은 판은 사본 디렉터리에 남습니다.
- Read path는 가능하면 파일로 줍니다. 디렉터리를 주면 그 아래 ignored 파일 전체가 복사되고 결속됩니다. 정산 뒤 쓸 result·처분
  기록·재현 로그는 리뷰 read path 밖(예: 리뷰 대상과 다른 `review/` 디렉터리)에 둡니다.
- 같은 subject(같은 변경; 새 builder task로 고쳐도 같음)의 연속 non-PASS 회차가 3회에 이르면 quality stop입니다. 회차는
  reviewer 실행 수가 아니라 리뷰한 snapshot 수입니다. Owner에게 다음 행동을 묻습니다.
