# Codex native registry, hooks and permissions

[Codex adapter](./codex.md)의 reference입니다. Spawn 등록·hook guardrail·완료 관측·수락의 원문과 Codex/OMX 권한 수단을 담습니다.
등록·완료 거부 사유, hook 동작이나 권한 모드를 확인할 때 읽습니다. 위임 순서는 진입 문서의
[Routine task-model operation](./codex.md#routine-task-model-operation)이 소유합니다.

## Subagent hook guardrail과 완료 관측

Project hook(`.codex/hooks.json` → `.codex/hooks/knu-subagent-hooks.mjs`)은 호출 시점 guardrail과 child 완료 기록을 맡습니다.
공식 문서도 tool hook을 완전한 강제 경계가 아닌 guardrail로 한정하므로 아래 범위 밖을 hook 강제로 보고하지 않습니다.
[공식 hooks 문서](https://learn.chatgpt.com/docs/hooks)

- **호출 시점(PreToolUse)**: matcher는 도구 이름 접미 `(spawn_agent|followup_task|send_message)$`입니다. V2 hook 이름은 namespace
  (`features.multi_agent_v2.tool_namespace`, 기본 `collaboration`)와 이름을 구분자 없이 잇기 때문입니다. Spawn은 Parent가 부르고
  (1) `agent_type`이 `.codex/agents`의 `knu_*` roster (2) 허용 목록 안 explicit `model`이고 그 역할의 profile 쌍
  (`pair-not-allowed`) (3) `fork_turns`가 `"none"` 또는 양의 정수 (4) 아래 등록의 평문 인자와 같을 때만 허용합니다. 허용 기록은
  task name과 역할·model을 묶는 bind이고 등록을 봉인합니다. Child가 부른 spawn과 접두사 없는 `spawn_agent`(V1 root, namespace 없는
  V2 provider)는 전부 deny합니다. `followup_task`·`send_message`는 기록하되, 수락된 child(task name, agent id 또는
  `/root/<task name>`)를 target으로 하면 `settled-child`로 deny합니다. Hook이 판정하지 못하면(정책 파일 오류 등) spawn을 deny합니다.
  codex-cli 0.162.0부터 `fork_turns` 양의 정수는 full-history fork로 해석됩니다(`rust-v0.162.0` #51329). (3)은 정수를 아직 받지만
  등록은 `"none"`만 받으므로 정수 spawn은 (4)에서 `registration-mismatch`(등록 있음)·`registration-missing`(없음)으로 막힙니다.
- **등록·수락**: Parent는 spawn 전에 dispatch가 계산한 spawn 인자를 `codex:register`(`task-registry.mjs`의 `registerDispatch()`)로
  `.artifacts/tools/codex-native/<Parent session>/<task_name>.json`에 한 번만 씁니다(같은 이름의 두 번째 등록은 거절). 등록은
  `task_name`이 lane id·token(재시도는 `_retry`)이나 reviewer round와 맞고, (역할, model)이 허용 쌍이고, effort가 역할 pin이고,
  `fork_turns`가 `"none"`일 때만 됩니다. Hook은 그 파일이 없으면 `registration-missing`, 형식이 틀리거나 task name이 정하는 필드(lane
  id·token·재시도 표시, reviewer round·`reviewId`)가 task name과 맞지 않거나 `reviewOf`가 lane id 목록이 아니면 `registration-invalid`,
  `task_name`·`agent_type`·`model`·`reasoning_effort`·`fork_turns` 중 하나라도 다르면 `registration-mismatch`, 같은 task name의 allow가
  이미 있으면 `registration-used`, primary child가 수락된 lane의 재시도면 `lane-accepted`로 deny합니다. 허용하면 등록 파일의
  digest와 내용을 allow 기록의 `registration`에 봉인합니다. Child가 끝나면 `codex:accept`(`acceptTask()`)가 완료 대조를 통과한
  child의 마지막 Stop 기록 digest를 `<task_name>.accepted.json`에 한 번만 씁니다. Primary가 수락된 lane은 재시도 등록·재시도
  수락도 거절합니다(성공 뒤 재시도 없음). `hooks.json`은 바뀌지 않으며 등록 읽기는 hook script 안에서 합니다.
- **등록 파일의 경계**: 등록 디렉터리는 workspace 안이라 child가 쓸 수 있습니다. Spawn 뒤 바뀐 등록은 이미 봉인된 값을 바꾸지
  못합니다. Spawn 전에 task name이 정하는 필드나 spawn 인자를 바꾼 등록은 hook이 deny하고, 봉인이 task name과 맞지 않으면 완료
  대조도 `registration-invalid`로 거부합니다. Task name으로 다시 계산할 수 없는 `reviewOf` 내용은 Parent가 등록 출력의 `digest`와
  수락 기록의 `registrationDigest`를 대조해 확인합니다. 수락 기록이 지워지면 fan-in이 그 lane을 `acceptance-missing`으로 거부하지만,
  지운 뒤의 재개는 hook이 막지 못하므로 다시 수락해야 합니다(재개된 Stop은 원래 수락과 맞지 않음). Target이 task name·agent id·
  `/root/<task name>`이 아닌 형식이면 수락 여부를 알 수 없어 기록만 합니다. Allow 뒤 도구가 실패해 child가 생기지 않아도 그 task
  name은 쓰인 것(`registration-used`)으로 남고, 수락한 child의 보완도 후속·재시도가 모두 막힙니다. 이때는 새 `dispatchToken`으로
  dispatch를 다시 계산해 등록·spawn합니다. 결과 대조는 dispatch token 하나만 받으므로 그 dispatch 전체를 새 token으로 엽니다.
- **Parent 쓰기**: code mode `exec` 안에서 중첩 호출한 `apply_patch`·`exec_command`도 PreToolUse를 거칩니다(codex-cli 0.161.0 관측,
  `apply_patch`·`Bash` tool_name). Repository hook의 matcher는 이 도구를 넣지 않으므로 Parent 쓰기는 막지 않습니다. 그 강제는
  `hooks.json` 변경과 trust 재승인을 함께 다루는 후속 결정입니다.
- **내장·OMX 역할**: project hook이 로드된 세션에서는 이 repository 안의 내장 역할(`default` 등)·OMX 역할 spawn이 막힙니다.
  Repository 위임은 `knu_*` 역할로 합니다.
- **완료 기록**: SubagentStart·SubagentStop은 Parent session별 `.codex/state/knu-subagent-hooks/<session>.jsonl`에 child
  `agent_id`·`agent_type`·`model`, child rollout의 task path, own-turn model·effort를 남깁니다. SubagentStart의 `model`은
  child session의 turn에서 만든 값입니다(codex `rust-v0.160.0` `core/src/hook_runtime.rs`의 SubagentStart 요청). Message와 마지막 응답 원문은
  저장하지 않고 byte 길이만 남깁니다. `.codex`는 workspace-write child가 쓸 수 없고 hook은 sandbox 밖에서 씁니다.
  Full access 세션과 Parent 권한 상승 쓰기는 막지 못합니다.
- **완료 판정**: child 결과는 Parent 보고만으로 완료가 아닙니다. `prepareLeaderSynthesis()`와 child lane의
  `validateCodexWorkflowResults()`는 같은 Parent session에서 다음을 모두 만족할 때만 완료로 받습니다. Start·Stop 기록이 그
  dispatch의 task path(`/root/<lane>_<token>`)·계약 역할·허용 목록 model·roster를 맞추고, 그 task name의 root PreToolUse allow
  기록(bind)이 같은 역할·model을 묶고, lane 계약 model(route profile의 model)과 역할 쌍이 허용되고, Start `model`·Stop own-turn
  model이 계약 model과 같고 own-turn effort가 역할 pin(`ROLE_EFFORTS`)과 같으며, 그 child 아래 descendant Start가 없고, allow
  기록의 봉인이 같은 종류(lane·review)·역할·계약 model·역할 pin을 담고 그 필드가 task name과 맞으며, 그 child의 수락 기록(`acceptances`)이 마지막 Stop을 가리킬 때입니다.
  Hook 기록 입력은 `readHookRecords()` 결과(`sessionId`·`records`·`malformed`)이고, 읽지 못한 줄이 하나라도 있으면(수를 모르는
  경우 포함) 그 줄이 descendant Start였을 수 있어 `observation-malformed`로 거부합니다.
  거부 사유는 bind 없음 `observation-unbound`, descendant `observation-foreign`, `pair-not-allowed`, `model-mismatch`,
  own-turn 없음 `effort-unobserved`, `effort-mismatch`, 봉인 없음 `registration-unsealed`, 봉인 불일치 `registration-mismatch`,
  task name과 맞지 않는 봉인 `registration-invalid`,
  수락 기록 없음 `acceptance-missing`, 다른 child·Stop을 가리키는 수락 `acceptance-mismatch`, 수락 뒤 같은 child의 Stop이 더 있음
  `resumed-after-acceptance`(재개된 turn)이고 기존 사유(`observation-missing`·`-incomplete`·`-mismatch`,
  `model-not-allowed`, `role-not-in-roster`)는 그대로입니다. 허용 목록·roster·역할 쌍·역할 effort는 `model-profiles.mjs`에서
  읽고 호출자가 넘긴 값은 쓰지 않습니다. Token이 없으면 `dispatch-token-missing`, 같은 task path에 child가 둘 이상이면 `observation-ambiguous`로
  거부합니다. Token은 dispatch마다 새로 정하는 소문자·숫자 4~12자(`retry` 제외)이고, 같은 session에서 lane id를 다시 써도 이전 child 기록이
  새 dispatch를 완료시키지 않게 합니다. Token을 일부러 재사용하는 것은 막지 못합니다. Shell에서는
  `pnpm codex:completion -- --lane <laneId> --token <token> --role <agent_type> --model <계약 model>`(session은
  `CODEX_THREAD_ID`)로 수락 전 대조를 확인합니다. 출력의 `unboundStarts`는 어느 allow 기록과도 짝이 없는 session의 Start 수입니다.
  Recovery 재시도 child는 task path `/root/<lane>_<token>_retry`에서 decision의 `retryRoute` model을 계약 model로 삼아 같은 조건으로
  대조합니다(synthesis·`validateCodexWorkflowResults()`의 `recoveryDecisions`, shell은 `--retry`, [Recovery ceiling](../request-intake/orchestration-recovery.md#recovery-ceiling)).
  그 재시도 child가 session에 있는데 decision 없이 primary로 대조하면 `retry-unreported`, primary child의 수락 기록이 있는데 재시도를
  대조하면 `lane-accepted`로 거절합니다.
- **Reviewer 결속**: `validateCodexWorkflowResults()`에 hook 기록을 주면 QA는 그 dispatch token 아래 등록·spawn된 reviewer child에서
  와야 합니다. 그 token의 모든 reviewer task(allow·Start 기록의 `review_<token>_<round>` 이름과 그 token을 적은 review 봉인의 이름,
  봉인이 어긋나거나 allow 기록이 없는 round 포함)가 `knu_reviewer`·review profile model·역할 pin과 task name에 맞는 봉인으로
  수락되고 재개되지 않았고, 보고된 결과의 `dispatchId`가 task name이 정하는 가장 높은 round의 `reviewId`(`review-<token>-<round>`)이며,
  그 등록의 `reviewOf`가 현재 lane을 모두 담아야 합니다. 보고된 `observedModel`만으로는 PASS를 연결하지 않습니다. Cross-model handoff
  계약 자체는 바뀌지 않습니다.
- **Hook 전체 부재**: linked git worktree(codex-cli 0.160.0 관측: main 경로를 trust해도 project hook이 `/hooks`에 나타나지 않음), untrusted project, hook trust 전·재검토 대기에서는 기록이 없으므로
  완료 거부가 정상 경로입니다. 이때 호출 시점 deny도 없어 child가 허용 목록 밖 model이나 roster 밖 역할로 실행될 수 있습니다.
- **PreToolUse만 실패**: callback 오류·timeout은 tool을 막지 않습니다(fail-open). 그 spawn에는 allow 기록이 없어 완료 판정이
  `observation-unbound`로 거부합니다. `knu_*` child가 띄운 grandchild는 호출 시점에 막히지 않지만, 그 Start 기록이 lane task
  path 아래이거나 lane child를 부모 thread로 가리키면 lane을 `observation-foreign`으로 거부합니다. 수락된 child를 target으로 한
  후속·메시지도 이때 막히지 않지만, 재개된 turn의 Stop이 수락 기록과 맞지 않아 완료는 `resumed-after-acceptance`로 거부됩니다.
  Hook 항목 하나만 바뀌어 그 항목만 재검토 대기인 부분 부재도 같습니다.
- **완료 거부 뒤 writer 변경**: 거부는 결과 수락만 막습니다. Parent는 이미 실행된 writer child가 바꾼 경로를 확인해 계약 밖
  변경을 되돌리거나 handoff하고, 거부된 결과를 통합 근거로 쓰지 않습니다.
- **엔진과 허용 목록 범위**: 허용 목록 model은 catalog v2 model입니다. Project hook이 로드된 세션에서는 V1 root의 spawn이 전부
  deny되어 V1 경로의 child가 생기지 않습니다. Hook이 없거나 PreToolUse가 실패하면 V1 child도 실행될 수 있으며, 완료 판정은 그
  dispatch task path의 기록과 allow 기록을 요구합니다.
- **정책 사본**: hook은 child가 쓸 수 있는 workspace module을 import하지 않고 `.codex/hooks/knu-hook-policy.json`을 읽습니다. 사본이
  `model-profiles.mjs` 허용 목록·역할 쌍·역할 roster와 같음은 test가 결속합니다. 사본 schema가 맞지 않거나 쌍이 없으면 hook은
  spawn을 deny합니다. `hooks.json`을 바꾸면 trust를 다시 받아야 합니다.

## Codex/OMX permission mechanism

이 절의 `workspace-write`, Auto-review, `on-request`, `madmax` 및 실행 규칙은 **Codex/OMX host 전용**입니다.
공통 권한 원칙은 위의 source·scope·authority 계약이며, Claude Code의 native 도구/permission 검증은
[Claude Code adapter](./claude-code.md)를 따릅니다. Codex 권한 모드를 다른 host의 실제 격리로 추정하지 않습니다.

기본 권장 조합은 **workspace-write + 필요한 범위만 좁게 허용 + 지원되는 Auto-review**입니다. Auto-review는 기존
승인 요청의 검토자를 바꾸는 native 기능이지 모든 명령의 보안 검사나 업무 승인자가 아닙니다. 이미 허용된 작업은 검토를
거치지 않을 수 있고 `never`는 자동 검토 모드가 아닙니다. 지원되지 않으면 `on-request` 대안을 확인하며 몰래 full access로
전환하지 않습니다. [공식 Auto-review 문서](https://learn.chatgpt.com/docs/sandboxing/auto-review)

- 기존 broad allow가 적용되면 좁은 allow 추가만으로 그 범위가 줄지 않습니다. 예를 들어 `gh api` prefix는 repo·HTTP method를
  제한하지 않습니다. 실제 loaded scope·규칙 우선순위를 확인하고 잘못된 repo/method/host·추가 인자에 대한 negative case로
  평가합니다. 전역 shell/interpreter 허용이나 홈 전체 writable을 편의상 기본값으로 추가하지 않습니다.
  [공식 실행 규칙](https://learn.chatgpt.com/docs/agent-configuration/rules)
- 기본 reviewer policy는 유지합니다. `[auto_review].policy`는 추가 병합이 아닌 교체이므로 짧은 repository 지침을 넣어
  기존 보호를 덮어쓰지 않습니다. 개인 실행값은 로컬 설정이고, 업무 안전 계약은 이 문서가 소유합니다.
- `madmax`/sandbox bypass에서도 업무·비밀·소유권 지침은 유지되지만 Codex shell sandbox와 승인 검토가 유지된다고
  보고하지 않습니다. OS/managed policy/provider 제한은 별개입니다. 전면 접근이 불가피하면 최소 credential의 별도 격리
  환경을 검토하며, worktree를 보안 sandbox로 간주하지 않습니다.
  [공식 승인·보안 문서](https://learn.chatgpt.com/docs/agent-approvals-security)
- 문서는 `advisory-policy`, Lead/Auto-review 판단은 `model-mediated`, fixture·정적 규칙 검사는 `deterministic-static`,
  실제 host/provider 강제는 `native-runtime`으로 구분합니다. 설정 파일·parent 실행 옵션만으로 child effective permission이나
  runtime 활성화를 단정하지 않습니다. 지침·모델 reviewer 하나만으로 기술적 접근 제한을 대체하지 않습니다.

[`agent-collaboration-cases.json`](../../../../scripts/ci/agents/common/fixtures/agent-collaboration-cases.json)은 보안 판단의 유한 입력 사례입니다.
정적 검사는 fixture·문서의 정합성만 증명합니다. 실제 Agent의 답변, Auto-review의 허용/거절, 접근 격리는 각각 별도 실행
evidence가 필요하며 한 종류의 PASS를 다른 종류의 PASS로 보고하지 않습니다.

저장소는 project `.codex/config.toml`에 `sandbox_mode`·`approval_policy` 기본값을 두지 않고 `.codex/rules` 실행 규칙도 만들지
않습니다. 두 값은 사용자·세션의 선택이고, untrusted project에서는 project config와 rules가 함께 건너뛰어져 저장소 보장이 되지
못하며, prefix rule은 위 `gh api` 예처럼 인자·repository·method를 제한하지 않습니다. 역할 파일의 `sandbox_mode`는 공식 역할
필드이므로 역할마다 둡니다. Project config에 approval·model 등 Parent 소유 키가 없음은 `project-codex-config.test.mjs`가 검사합니다.
[공식 rules 문서](https://learn.chatgpt.com/docs/agent-configuration/rules)
