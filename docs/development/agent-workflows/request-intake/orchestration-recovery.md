# Bounded orchestration, recovery, and leader synthesis

이 문서는 Codex adapter가 소유하는 reference입니다. Model profile, recovery 상한, `scripts/agents/codex/` descriptor는 Codex/OMX 실행 계약입니다.
공통 one-writer·source freshness·authority·QA는 [orchestration](../orchestration.md)과 [execution contract](../agent-execution-contract.md)가 소유합니다.
Claude Code에는 [native adapter](../adapters/claude-code.md)를 사용하며 이 schema로 Claude model/runtime 지원을 가장하지 않습니다.

이 계약은 독립 lane과 typed child contract를 포함한 delegation recommendation을 existing native child surface에
전달하기 전 마지막 advisory gate를 정의합니다. 새로운 child scheduler, queue, runtime state machine을 구현하지
않습니다.

## Native dispatch gate

`scripts/agents/codex/orchestration-policy.mjs`의 `createDispatchRecommendation()`은 `delegation`, `concurrencyLimit`,
`dispatchToken`만 받고(그 밖 key는 TypeError), 다음을 모두 확인한 경우에만 typed native dispatch
descriptor를 추천합니다.

- delegation 결과가 `bounded-lanes`이며 dispatch가 그 delegation을 다시 검증
- 추천 child contract가 1개 이상, repository hard cap 6 이하
- 각 contract가 validated Pass 2 assessment와 evidence ID를 보존
- 선택된 write-capable child가 최대 1개
- 공급된 context delivery가 compatible·미적용·gap 없음이고 scoped(호환되는 reuse는 새 spawn이 아니라 이전 child의 후속)
- 후보 lane은 profile의 역할·effort·cohort 도구·쓰기 경계와 scoped·실패 없는 context, 추천 당시 contract snapshot
  (`modelScopeDigest`)을 유지
- leader-only dispatch, decision, response, integration, verification ownership 유지

조건을 충족하지 않으면 child를 생성하지 않고 leader direct 또는 single-sequential fallback을 반환합니다.
Descriptor는 `spawn_agent`, tmux, tool command를 실행하지 않습니다. Parent가 descriptor의 `spawnArguments`를 native tool에
그대로 전달합니다.

```json
{
  "task_name": "legal_repository_map_k3x9",
  "agent_type": "knu_explorer_xhigh",
  "model": "gpt-6-luna",
  "reasoning_effort": "xhigh",
  "fork_turns": "none"
}
```

`spawnArguments`는 contract에서 결정됩니다. `task_name`은 lane id와 dispatch token, `agent_type`은 route 역할, `model`은 route
profile의 model(후보가 없으면 `gpt-6-astra`), `reasoning_effort`는 그 역할 파일의 pin effort, `fork_turns`는 `none`입니다.
`dispatch.effort`도 같은 pin이고 semantic 계층은 contract의 `routeRecommendation.tier`에 남습니다. 같은 role의 다른 model
lane(2026-10-06 native 관측)도 candidate를 포함해 일반 동시 한도 안에서 함께 나가며, 한도를 넘는 lane은
`runtime-concurrency-limit` gap으로 미룹니다.

Leader가 보고하는 runtime evidence(surface·provenance·roster·configuration resolution), lane별 model admission grant,
Parent가 보고하는 사후 실행 대조는 두지 않습니다. 그 확인은 host가 직접 남기는 두 계층이 맡습니다.

- **호출 시점**: project hook guard(`.codex/hooks/knu-subagent-hooks.mjs`)가 역할 roster, 허용 model, (역할, model) 쌍,
  bounded fork(`fork_turns` 생략·`all`은 full-history fork로 거절)와 Parent가 `codex:register`로 남긴 등록과의 평문 인자 일치를
  검사하고, child가 연 spawn과 수락된 child를 대상으로 한 후속·메시지를 막습니다. Context delivery의
  full-history 요청은 이 거절을 반영해 `full-history-fork-denied`로 호환되지 않습니다.
- **완료**: Parent는 `pnpm codex:completion -- --lane <lane> --token <token> --role <agent_type> --model <model>`로 hook 기록을
  lane 계약과 대조하고, 받을 child는 `pnpm codex:accept`로 수락합니다. 기록이 없거나 bind·등록 봉인·계약 model·역할 effort와
  맞지 않거나 수락 기록이 없으면 완료로 받지 않습니다
  ([hook guardrail과 완료 관측](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)). Recovery 재시도 child는 `--retry`와
  decision의 `retryRoute` model로 대조합니다([Recovery ceiling](#recovery-ceiling)).

Project child 기본값은 `.codex/config.toml`의 Astra입니다. 열 역할 모두 model pin 없이 profile이 정한 명시적 task 모델을
받고(`knu_reviewer`는 `review` profile의 Astra), effort는 각 역할 파일의 pin이 정합니다. 호출할 수 있는 (역할, model) 쌍은
각 profile의 역할과 그 profile model입니다. Parent model 변경이나 OMX의 기본값 업데이트를 project 역할·설정의 실제 로드
증거로 사용하지 않습니다. Runtime policy의 child 기본값은 허용 목록 owner의 `BASELINE_CHILD_MODEL`이고, `.codex/config.toml`
기본값은 test로 이 값에 결속되며 역할 파일의 `model` 필드는 test가 금지합니다. 허용 목록 밖 model 거절은 합성 ID 하나로
검증합니다. 이 모델 선택은 parent의 session model/effort나 child의 기존 sandbox·count 경계를 바꾸지 않습니다.

후보 자격은 routing의 Pass 2 계층·profile 판정이 정합니다([quality-gated model advice](../adapters/codex.md#quality-gated-model-advice)).
읽기 profile(`standard-read`·`elevated-read`)은 repository/official read-only 도구만, `extract`는 고정된 repository-read만, 구현
profile(`standard-build`·`elevated-build`)은 단일 write owner와 workspace-edit/test-runner를 요구합니다. Route의 역할·effort·
`profileId`가 그 profile의 역할 변형과 effort에 맞지 않으면 `model-effort-eligibility-mismatch`입니다. `purpose`(pilot·routine)는
descriptor의 `modelPurpose`로 남을 뿐 호출 허가가 아니며, 채택·철회는
[Routine task-model operation](../adapters/codex.md#routine-task-model-operation)이 소유합니다. 이 helper는 project 설정/role
pin을 수정하거나 서버/CLI를 시작하지 않습니다. 후보 판정은 실제 모델 사용·품질 동등성·비용 절약 증거가 아닙니다.

## Bounded model-run evidence

기록 원칙은 [Execution evidence](../qa.md#execution-evidence)가 소유하며 이 절은 Codex에서 그 원칙을 채우는 관측과 기록을 정합니다.

- **관측**: child가 실제로 받은 model·effort와 시작·종료는 project hook이 Parent session별
  `.codex/state/knu-subagent-hooks/<session>.jsonl`에 남깁니다. Parent는 `pnpm codex:completion -- --lane <lane> --token <token>
--role <agent_type> --model <model>`로 그 기록을 lane 계약과 대조합니다. 기록이 없거나 spawn bind·계약 model·역할 effort와
  맞지 않으면 완료로 받지 않습니다([hook guardrail과 완료 관측](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)).
  재시도 child의 계약 model은 decision의 `retryRoute` model입니다. 허용 목록 밖 관측 값(예: Home pin)도 실패 사실로 남고 성공으로 바뀌지 않습니다.
- **원인과 조치**: Hook 기록은 원인을 담지 않습니다. Parent는 확인된 사실과 원인 가설을 나눠 남기며 확정되지 않은 원인은
  unknown입니다. 원인별 조치 뒤 같은 oracle을 다시 검증하고, Astra 성공만으로 원래 원인을 확정하지 않습니다.
  Quota·permission·cap 실패는 모델 교체 대신 stop입니다.
- **집계**: 실행 전 거절, 의도적으로 주입한 실패, approved baseline은 실제 live primary와 따로 셉니다. 미관측 시간·비용·재작업은
  null로 두고 0으로 채우지 않습니다.
- **기록 경계**: Hook 기록은 identity와 크기만 남기고 message 본문을 넣지 않습니다. Parent의 작업 증거에도 [Execution evidence](../qa.md#execution-evidence)가
  금지한 원문 prompt·transcript·환경 변수·credential·개인 정보와 hidden reasoning을 넣지 않고 참조 ID로 연결하며, 참조 ID에도
  비밀을 넣지 않습니다. 기록 실패는 gap으로 보고하며 실행 권한이나 PASS를 만들지 않습니다.

## Recovery ceiling

공통 상한은 [Recovery ceiling](../orchestration.md#recovery-ceiling)이 소유합니다. 이 절은 Codex의 재시도 route·approach 식별과
판정 입력을 더합니다.

```text
primary attempt
├── success → complete
├── retryable failure → one retry with a distinct approach on the computed retry route
│   ├── success → complete
│   └── failure → terminal handoff
└── authority/credential/production/scope/role failure → immediate handoff or leader fallback
```

- 재시도 attempt는 primary와 다른 `approachId`를 사용하고 `alternateOf`를 명시합니다.
- 세 번째 attempt, 같은 approach 반복, success 이후 retry, non-retryable failure 뒤 retry는 invalid입니다.
- 재시도 route는 보고받지 않고 lane 계약에서 계산합니다. 결과 품질 실패(`verification-failed`·`unknown`)는 같은 역할로 사다리 한 단 위
  profile에서 한 번 실행합니다(`retryRoute.kind` `ladder`): Luna `extract` → 6.1 Sol `elevated-read`, 6.1 Sol 읽기
  (`standard-read`·`elevated-read`) → Astra `astra-fallback`, 6.1 Sol 구현(`standard-build`·`elevated-build`) → Astra `deep-build`.
  근거·도구 실패(`tool-unavailable`·`official-source-unavailable`·`repository-evidence-missing`)와 위 단이 없는 Astra lane
  (`deep-build`·`review`·`astra-fallback`)은 같은 contract에서 approach만 바꿉니다(`same-contract`). 사다리 데이터는
  `model-profiles.mjs`의 `RECOVERY_LADDER`가 소유하고 모든 단은 기존 (역할, model) 허용 쌍 안입니다.
- 재시도는 lane당 한 번이며 재시도의 재시도·연쇄 상향은 없습니다. Luna lane의 6.1 Sol 재시도가 실패하면 Astra로 다시 오르지 않고
  terminal handoff입니다. 이 상한은 Claude 결속 재시도의 상한(세션·사실 묶음마다 한 번)과 같습니다.
- `evaluateRecovery`는 `laneId`·`route`·`attempts`만 받습니다. `route`는 lane 계약의 `role`·`profileId`이고, attempt는
  `approachId`·`alternateOf`·`outcome`·`failureCategory`·`evidence`만 담습니다(출력은 순번 `number`를 더하며 그 밖 field는
  TypeError). 입력 attempt에 `number`가 있으면 그 위치(1부터)와 같아야 합니다. 출력은 `route`와, 재시도를 기다리거나 마친
  decision이면 계산한 `retryRoute`(`kind`·`role`·`profileId`·`model`)를 담습니다. Synthesis에 넘기는 recovery decision도
  `evaluateRecovery` 출력의 field만 받고, `confidence`·`prohibitedApproachIds`·`retryRoute`가 있으면 그 route와 attempts로 다시
  계산한 값과 같아야 하며, `route`는 그 lane 계약과 같아야 합니다. `status`·`action`·`remainingAlternateAttempts`·`blocker`·
  `disposition`도 다시 계산한 값과 같아야 하므로, 끝난 decision을 대기 중으로 바꿔 써서 재시도를 한 번 더 얻거나 실패한 lane을
  완료로 닫을 수 없습니다.
- 사다리 단은 다음 profile이 실패한 profile의 lane 경계를 받을 때만 씁니다. 같은 역할을 받고, candidate면 역할 pin effort·같은
  read-only 경계·실패한 profile이 허용한 도구를 모두 받아야 합니다. 받지 못하면 같은 contract에서 approach만 바꿉니다. Primary의
  tier gate는 다시 적용하지 않습니다. 사다리는 실패한 tier보다 한 단 위로 의도해서 오르는 것이기 때문입니다.
- 재시도 spawn 인자는 `createRetryDispatch()`가 계약과 기다리는 decision에서 정합니다. `task_name`은 lane의 dispatch token 뒤에
  `_retry`를 붙이고, 역할은 그대로, `model`은 `retryRoute` model, `reasoning_effort`는 역할 pin, `fork_turns`는 `none`입니다.
  재시도한 lane의 완료는 그 재시도 child를 `retryRoute` model로 대조합니다(`codex:completion`의 `--retry`, synthesis와
  `validateCodexWorkflowResults`의 `recoveryDecisions`). Primary dispatch가 native spawn에서 빼는 lane(context reuse, 호환되지 않는
  delivery, 맞지 않는 candidate 경계나 scope snapshot)은 재시도 spawn도 거절합니다([Native dispatch gate](#native-dispatch-gate)).
- Primary 완료 대조는 session에 같은 lane·token의 재시도 child(`_retry`)가 있으면 `retry-unreported`로 거절합니다. 재시도 child는
  그 recovery decision으로만 완료됩니다. 반대로 primary child가 수락되면 그 lane은 성공으로 끝나 재시도 등록·spawn·수락과
  재시도 완료 대조(`lane-accepted`)를 모두 거절합니다. Dispatch token `retry`는 다른 lane의 재시도 task name과 겹치므로 쓰지 않습니다.
  `validateCodexWorkflowResults`도 synthesis처럼 모든 decision을 다시 계산하고, complete 결과에 대기·terminal decision이 함께 오면
  거절합니다.
- `quota-exhausted`, `capacity-denied`, `missing-authority` 등 non-retryable failure는 즉시 handoff입니다. Pending/unknown writer가
  남아 있으면 회수하기 전에 재시도를 시작하지 않습니다. Scope/권한 변경을 모델 교체로 우회하지 않습니다.
- Terminal handoff 뒤 Parent가 현재 source로 새 ordinary contract(예: Astra)를 판정해 맡기는 것은 이 recovery의 attempt가 아니라
  새 위임입니다. 실패한 lane의 attempt 이력과 handoff는 그대로 남고, 새 contract의 결과가 그 실패를 성공으로 바꾸지 않습니다.
- 권한·credential·external production은 기술적 retry로 해결하지 않습니다.
- official/repository evidence가 계속 없으면 `evidence-gap`, owner 결정이 없으면 `plan-oq`, 외부 권한이 필요하면
  `user-handoff`로 종료합니다.
- retry decision은 immutable record이며 worker respawn이나 task 재배치를 직접 실행하지 않습니다.

Capacity 오류와 완료 thread 정리는 [Parent-owned subagent lifecycle](../subagent-lifecycle.md)을 먼저 따릅니다.
결과 회수 후 capability별 분기로 explicit-close·검증된 no-close·unknown을 구별합니다. no-close 자체는 일반 dispatch
차단 사유가 아닙니다. V2 자동 회수 계약에서는 수동 close 대신 같은 lane의 지원 followup 경로를 우선하며,
계약 적용과 실제 release 관측은 별개입니다. 단 현재 operation의 실패나 pending/권한 미확인을 정상 경로로 바꾸지는 않습니다.
변화 근거가 있는 retry도 위 one-alternate ceiling 안에서만 실행하며 이 advisory policy에 runtime 종료 engine을 추가하지
않습니다. 별도 release 관측 없이 자원/슬롯 회수 성공을 주장하거나 같은 조건의 호출을 반복하지 않습니다. 실제 실행·상태·권한은
Parent가 current schema에서 재확인하고 정적 테스트는 native lifecycle evidence를 대신하지 않습니다.

## Child result contract

각 child result는 다음만 제공할 수 있습니다.

```text
laneId / status
contract-required outputs
facts[]: statement / source
inferences[]: statement / confidence
gaps[]: statement / impact / blocking
verification[]: claim / evidence / passed|failed|not-run
confidence / blocker
```

`finalDecision`, `finalUserResponse`, `globalPlan`, `finalVerification`처럼 leader authority를 주장하는 field는
거부합니다. Result가 빠졌거나, verification이 실패·미실행이거나, blocking gap·pending retry·unresolved conflict가
있거나, completed lane의 hook 기록 결속이 거부되면 synthesis는 ready가 아닙니다.

## Leader-only synthesis

Policy는 child evidence를 정규화하여 leader에게 다음을 제공합니다.

- lane별 facts, inferences, gaps, confidence
- verification evidence
- missing/blocked/recovering lane
- unresolved 또는 leader-resolved conflict
- completed lane별 hook 완료 판정(`completionChecks`·`refusedLaneIds`, `completionAuthority: codex-subagent-hook`)
- `readyForLeaderDecision`

Completed lane은 Parent session의 SubagentStart·SubagentStop 기록이 그 dispatch의 lane task path(dispatch token 포함)·
계약 역할·허용 목록 model·roster와 맞고, 그 task name의 PreToolUse allow 기록(bind)·계약 model(route profile)·역할 pin
effort·등록 봉인과도 맞으며, 그 child 아래 descendant 기록과 읽지 못한 기록 줄이 없고, 그 child의 마지막 Stop을 가리키는 수락 기록
(`acceptances`)이 있어야 ready에 들어갑니다. 기록이 없거나(hook 부재 포함) 맞지 않으면
refused lane으로 blocking이며, 이미 실행된 writer 변경은 Parent가 되돌리거나 handoff합니다. 재시도한 lane은 그 재시도
child(`_retry` task path)를 decision의 `retryRoute` 역할·model로 같은 조건에 대조합니다. 경계는 [Codex adapter](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)가 소유합니다.

`readyForLeaderDecision=true`도 자동 completion이나 final answer를 의미하지 않습니다. Leader가 repository의 실제
변경, source freshness, conflict, 최종 verification을 확인한 뒤에만 사용자에게 결론을 제공합니다.
