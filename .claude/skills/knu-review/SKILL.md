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
   `purpose:"red"`·`expectedExit`를 더합니다. Exit를 뒤집어 기록하지 않습니다.
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --subject <taskId> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --round <N> --session ${CLAUDE_SESSION_ID}`
4. 출력 `reviewerSpec`을 확인해 파일로 저장하고 `prepare --spec`으로 등록한 뒤 `agentInput`으로 Agent를 호출합니다.
5. 알림 뒤 `/knu-settle`로 reviewer를 정산합니다.

## Parent 작성 diff 경로

Native subject가 없는 Parent 변경의 검토입니다. Builder의 `reviewerTaskId`를 대신할 수 없습니다.

1. Subject 파일은 `{"request": "...", "owner": "parent", "acceptance": ["..."], "paths": ["..."]}` JSON입니다. `request`는 요구사항(사용자
   요청·issue·plan acceptance를 옮긴 문장)이고 구현 설명·추론·자기평가는 넣지 않습니다. `owner`는 작성자 식별자, `acceptance`는 판정
   기준 문장, `paths`는 리뷰 대상 파일입니다(native task 기록과 local state는 넣을 수 없음). 선택 필드
   `requirementSections: [{"path": "<plan 경로>", "headings": ["<절 heading>"]}]`는 plan의 판정 원본 절(acceptance·invariant·Owner 결정
   기록)만 helper가 잘라 reviewer 입력으로 주고, plan 파일은 read path에 넣지 않습니다(`paths`에 그 plan이나 그 위 디렉터리를 함께 주면
   `requirement-path-in-paths`로 거부). Heading은 `#`를 뺀 정확한 문자열이고 plan 안에 한 번만 있어야 합니다. 선택 필드
   `lifecycleDraft: "<경로>"`는 PR 본문 초안 파일이고 helper가 그 `## Lifecycle` 절만 잘라 reviewer가 등급·정책 줄을 diff와 대조합니다
   (원본 초안은 read path가 아님. 없거나 `## Lifecycle` 절이 없거나 둘 이상인 파일은 `lifecycle-draft-invalid`). `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --parent-subject <absolute-subject-path> --session ${CLAUDE_SESSION_ID}`로
   `logHeader`를 받습니다.
   - `paths`의 `.omc/`·`.omx/`·`.codex/state/`·`.claude/projects/` 아래 경로, Home(`~`) 경로, 절대 경로는
     `local-state-path:<path>`로 거부됩니다. 추적 `.claude/` 설정·skill·역할 파일은 해당하지 않습니다.
   - `request`에 완료형 구현 서술(`고쳤다`·`구현했다` 등)이 있으면 출력 `warnings`에 `request-implementation-marker`가 나오고 packet
     `evidence.environment`에 그 문장 수가 남습니다. 리뷰를 막지는 않지만 걸린 문장은 packet `objective`에 그대로 남으니 `request`를
     요구사항 문장으로 고쳐 다시 `review`합니다.
2. 그 digest로 runner evidence를 만듭니다.
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --parent-subject <absolute-subject-path> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --round <N> --session ${CLAUDE_SESSION_ID}`
4. 출력 `reviewerSpec`으로 `prepare --spec`하고 `agentInput`으로 Agent를 호출합니다. Packet은 prompt에 싣지 않고
   `.artifacts/tools/claude-review-packets/<reviewId>.json`에 씁니다. Prompt에는 `KNU_REVIEW_PACKET_FILE:<경로> <digest>` 한 줄만
   남고 reviewer가 그 파일을 먼저 읽습니다. 출력 `packetFile`이 같은 경로와 digest입니다.
5. 정산은 `parent-adjudication`입니다. `/knu-settle`의 reviewer 종류 구분을 따릅니다.

## Dispatch 전 단계

해당하는 단계만 실행하고, 각 실행은 runner evidence record로 남깁니다. 명령은 `scripts/agents/common/` 아래 도구입니다.

1. 자체 정합 점검: 수정이 규칙·수치·범위를 바꾸면 같은 유형의 서술(같은 문서의 다른 절·표, 다른 owner 문서, 개수·합계)을 전 범위에서
   검색합니다. 로그에는 검색마다 명령과 exit 줄(`rg exit=1`은 0건)을 남기고, record는 검색을 모두 실행한 묶음의 exit 0과
   조각(`` `rg exit=1` `` 등)으로 씁니다. 0건 검색을 실패 record로 남기지 않고 exit를 뒤집는 명령(`|| true`, `!`)도 쓰지 않습니다.
2. 새 파일: snapshot은 HEAD 기준이라 stage와 무관하고 새 파일은 내용 digest로 들어가므로 stage하지 않습니다. Tracked 파일만
   보는 검사(`pnpm test:repo-policy`)가 새 파일을 보게 하려면 commit한 snapshot에서 실행하고, commit 전이면 저장소 밖 독립
   clone에서 새 파일을 add한 뒤 실행해 record로 남깁니다. 메인 checkout의 stage를 바꾸지 않습니다.
3. RED 기록이 있으면 `red-reason-check.mjs`로 실패 사유를 대조합니다.
4. 리뷰 입력에 계획·증거·readiness Markdown이 있으면 `citation-check.mjs`를 실행합니다.
5. 계획 readiness 리뷰면 `plan-reference-check.mjs`를 실행합니다.
6. 검사·harness 변경의 test 보호를 주장하면 `mutation-harness.mjs`를 실행합니다(spec은 계획 증거 위치의 리뷰 디렉터리).
7. `review` 직전 runner evidence에 `runner-log-check.mjs`를 실행하고 exit 0이 아니면 dispatch하지 않습니다. 이 실행은 같은
   evidence의 record가 될 수 없으므로 출력만 evidence 옆에 둡니다.

## 1회차 다중 reviewer

- Owner가 정한 변경의 1회차에만 `--composition e2|e3 --reviewers 2|3`을 더합니다. 계획 readiness 리뷰는 단일입니다. `e3`는
  기준 문서(자동 선택이나 `--criteria`)가 필요하고 기준 항목을 구성원에게 연속 구간으로 나눕니다. 2회차부터는 단일 reviewer입니다.
- 출력은 `reviewerSpec` 대신 `reviewers[]`(구성원마다 `reviewerSpec`·`packet`·`reviewerPrompt`)와 `group`입니다. 구성원 spec을 각각
  `prepare`하고, Agent 호출 N개를 한 메시지에서 background로 보냅니다. 같은 구성원 spec을 다시 `prepare`해 보내지 않습니다.
  예외는 Parent 작성 diff 경로에서 hook 뒤 거부(auto classifier 판정 누락 등)로 결과 없이 실행되지 못해 `task already attempted`가 된
  구성원입니다. 그 spec을 새로 `prepare`해 전체 `invocation`으로 한 번 보내고
  ([registry 4단계](../../../docs/development/agent-workflows/adapters/claude-native-registry.md)), 다시 실행되지 못하면 더 보내지 않고
  Owner와 다음 행동을 정합니다. Native subject 경로는 재등록하지 않고 새 review를 만듭니다. 거부된 호출은 completion이 없어 builder
  완료의 구성원 번호 검사에서 빠지지 않습니다(`review-group-duplicate-member`).
- 집계·처분은 `/knu-settle`의 그룹 처분 기록을 따릅니다.

## 공통

- 회차 입력: `--round <N>`은 항상 줍니다. 2회차부터 `--previous-result <absolute-result-path>`(직전 회차 result JSON을
  계획 증거 위치에 저장한 파일, 1회차가 그룹이었으면 그 회차의 `review-adjudication/v1` 처분 기록)를 더합니다. 회차와 처분 규칙은
  [QA 리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차)입니다.
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

- Reviewer prompt는 12,000자를 넘을 수 없습니다. Parent 경로는 packet이 파일로 빠진 뒤 크기이고, 남는 초과는 runner 기록과
  acceptance 문장 길이에서 옵니다. Native subject 경로는 acceptance·read path·runner 기록을 줄입니다.
- `reviewerSpec`의 prompt는 고치지 않고 등록합니다. `review`가 reviewer마다 prompt digest를
  `.artifacts/tools/claude-review-packets/<reviewId>.prompt.json`에 남기고, 등록은 다른 prompt를 `review-prompt-changed`로, 기록이
  없거나 packet 파일 줄이 빠진 prompt를 `review-prompt-unbound`로 거부합니다(registry 직접 등록도 같음). 바꿀 것이 있으면 `review`를
  다시 만듭니다.
- Reviewer가 실행 중일 때 read 범위의 입력(계획·증거 포함)을 수정하지 않습니다. Helper가 ignored 리뷰 입력(ignored read path
  아래와 `.plans/`·`.artifacts/`·`.local-docs/` 아래 ignored 파일)을 `KNU_REVIEW_INPUTS_FILE:` manifest로 결속하므로 `review` 생성부터
  그 reviewer 정산과 연결 builder 완료까지 그 파일을 바꾸면 `review-input-stale`·`review-input-changed`로 거부됩니다.
- 마지막 입력 수정 뒤 runner를 실행하고 바로 `review`를 만듭니다. Runner가 실행된 시점의 입력은 결속되지 않으므로 runner 로그에
  입력 sha256을 남기는 관례는 유지합니다.
- Read path는 가능하면 파일로 줍니다. 디렉터리를 주면 그 아래 ignored 파일 전체가 결속되므로, 정산 뒤 쓸 result·처분 기록·재현 로그는
  리뷰 read path 밖(예: 리뷰 대상과 다른 `review/` 디렉터리)에 둡니다.
- 같은 subject(같은 변경; 새 builder task로 고쳐도 같음)의 연속 non-PASS 회차가 3회에 이르면 quality stop입니다. 회차는
  reviewer 실행 수가 아니라 리뷰한 snapshot 수입니다. Owner에게 다음 행동을 묻습니다.
