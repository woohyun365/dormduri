# Bounded orchestration, recovery, and leader synthesis

이 문서는 Codex adapter가 소유하는 reference입니다. Model profile, model recovery 중단, `scripts/agents/codex/` descriptor는 Codex/OMX 실행 계약입니다.
공통 one-writer·source freshness·authority·QA는 [orchestration](../orchestration.md)과 [execution contract](../agent-execution-contract.md)가 소유합니다.
Claude Code에는 [native adapter](../adapters/claude-code.md)를 사용하며 이 schema로 Claude model/runtime 지원을 가장하지 않습니다.

이 계약은 독립 lane과 typed child contract를 포함한 delegation recommendation을 existing native child surface에
전달하기 전 마지막 advisory gate를 정의합니다. 새로운 child scheduler, queue, runtime state machine을 구현하지
않습니다.

## Native dispatch gate

`scripts/agents/codex/orchestration-policy.mjs`의 `createDispatchRecommendation()`은 `delegation`, `concurrencyLimit`,
`dispatchToken`, `recoveryDecision`만 받고(그 밖 key는 TypeError), 다음을 모두 확인한 경우에만 typed native dispatch
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
  bounded fork(`fork_turns` 생략·`all`은 full-history fork로 거절)를 검사하고 child가 연 spawn을 막습니다. Context delivery의
  full-history 요청은 이 거절을 반영해 `full-history-fork-denied`로 호환되지 않습니다.
- **완료**: Parent는 `pnpm codex:completion -- --lane <lane> --token <token> --role <agent_type> --model <model>`로 hook 기록을
  lane 계약과 대조합니다. 기록이 없거나 bind·계약 model·역할 effort와 맞지 않으면 완료로 받지 않습니다
  ([hook guardrail과 완료 관측](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)).

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

## Model recovery suspension

Model recovery는 중단되어 있습니다. 실패한 candidate는 Astra alternate를 받지 않고, pending writer를 회수한 뒤 Parent 판단이나
handoff로 돌아갑니다. 중단 이유는 이전 Astra-only rescue가 역할 pin effort와 다른 Low·semantic effort를 기록했기 때문입니다.
역할이 effort를 고정한 뒤에는 그 기록을 재현할 수 없습니다. 같은 역할로 한 단계씩 올리는 승격 사다리가 이 정책을 대체하기
전까지 중단합니다.

- 입구는 `model-profiles.mjs`의 `createRecoveryBinding()` 하나입니다. 중단 상태(`MODEL_RECOVERY_SUSPENDED`)에서는
  `Model recovery is suspended; a failed candidate returns to the Parent or a handoff.`로 거절합니다.
  `assertCurrentRecoveryBinding()`도 이 입구를 거치므로 같은 사유로 거절됩니다.
- `evaluateRecovery()`의 model 경로는 재시도 가능한 primary 실패에 `alternate-once` 대신 `terminal-handoff`,
  `disposition=blocker-handoff`, `nextModel=null`을 반환합니다. Blocker는 writer가 회수됐으면 `model-recovery-suspended`,
  pending/unknown이면 `model-pending-writer-not-cleared`입니다. 이미 기록된 Astra alternate도 같은 중단 사유로 거절하며,
  attempt model 순서와 non-retryable 검사는 그 앞에서 그대로 적용됩니다.
- Binding이 없는 recovery decision은 `nextModel`을 가질 수 없고 synthesis가 거절합니다(검사 없는 model이 출력에 실리지 않게).
- Recovery decision을 받은 dispatch는 중단 상태라 `model-recovery-incompatible-or-unadmitted` gap을 남기고 descriptor를
  만들지 않습니다.
- Model 필드가 없는 일반 lane의 distinct-approach alternate 한 번은 [Recovery ceiling](#recovery-ceiling) 그대로입니다.

## Bounded model-run evidence

기록 원칙은 [Execution evidence](../qa.md#execution-evidence)가 소유하며 이 절은 Codex에서 그 원칙을 채우는 관측과 기록을 정합니다.

- **관측**: child가 실제로 받은 model·effort와 시작·종료는 project hook이 Parent session별
  `.codex/state/knu-subagent-hooks/<session>.jsonl`에 남깁니다. Parent는 `pnpm codex:completion -- --lane <lane> --token <token>
--role <agent_type> --model <model>`로 그 기록을 lane 계약과 대조합니다. 기록이 없거나 spawn bind·계약 model·역할 effort와
  맞지 않으면 완료로 받지 않습니다([hook guardrail과 완료 관측](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)).
  허용 목록 밖 관측 값(예: Home pin)도 실패 사실로 남고 성공으로 바뀌지 않습니다.
- **원인과 조치**: Hook 기록은 원인을 담지 않습니다. Parent는 확인된 사실과 원인 가설을 나눠 남기며 확정되지 않은 원인은
  unknown입니다. 원인별 조치 뒤 같은 oracle을 다시 검증하고, Astra 성공만으로 원래 원인을 확정하지 않습니다.
  Quota·permission·cap 실패는 모델 교체 대신 stop입니다.
- **집계**: 실행 전 거절, 의도적으로 주입한 실패, approved baseline은 실제 live primary와 따로 셉니다. 미관측 시간·비용·재작업은
  null로 두고 0으로 채우지 않습니다.
- **기록 경계**: Hook 기록은 identity와 크기만 남기고 message 본문을 넣지 않습니다. Parent의 작업 증거에도 [Execution evidence](../qa.md#execution-evidence)가
  금지한 원문 prompt·transcript·환경 변수·credential·개인 정보와 hidden reasoning을 넣지 않고 참조 ID로 연결하며, 참조 ID에도
  비밀을 넣지 않습니다. 기록 실패는 gap으로 보고하며 실행 권한이나 PASS를 만들지 않습니다.

## Recovery ceiling

공통 상한은 [Recovery ceiling](../orchestration.md#recovery-ceiling)이 소유합니다. 이 절은 Codex의 approach 식별과 모델 binding을 더합니다.

```text
primary attempt
├── success → complete
├── retryable failure → one distinct alternate approach
│   ├── success → complete
│   └── failure → terminal handoff
└── authority/credential/production/scope/role failure → immediate handoff or leader fallback
```

- alternate attempt는 primary와 다른 `approachId`를 사용하고 `alternateOf`를 명시합니다.
- 세 번째 attempt, 같은 approach 반복, success 이후 retry는 invalid입니다.
- `evaluateRecovery`의 선택 입력 `modelRecovery={profileBinding,pendingWriter}`는 현재 installed profile의 exact primary 모델과 각 attempt의
  `model`을 대조하고 두 번째 attempt를 Astra로 제한합니다. Model recovery가 [중단](#model-recovery-suspension)되어 있어 이
  경로는 alternate를 추천하지 않고 handoff를 반환합니다. Pending/unknown writer는 takeover를 먼저 실행하지 않습니다.
  명시적 model attempt는 이 binding 없이 처리하지 않습니다. Raw primaryModel, 허용 목록 밖 model, 만료 profile 입력은 거부하며,
  model 필드가 없는 일반 recovery 계약은 유지합니다.
- `quota-exhausted`, `capacity-denied`, `missing-authority` 등 non-retryable failure는 즉시 handoff입니다.
- 모델 후보 실패는 중단 동안 alternate 없이 Parent나 handoff로 갑니다. 자동 Luna→Sol→Astra ladder는 없습니다.
  Scope/권한 변경을 모델 교체로 우회하지 않습니다.
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
effort와도 맞으며, 그 child 아래 descendant 기록과 읽지 못한 기록 줄이 없어야 ready에 들어갑니다. 기록이 없거나(hook 부재 포함) 맞지 않으면
refused lane으로 blocking이며, 이미 실행된 writer 변경은 Parent가 되돌리거나 handoff합니다. 경계는 [Codex adapter](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)가 소유합니다.

`readyForLeaderDecision=true`도 자동 completion이나 final answer를 의미하지 않습니다. Leader가 repository의 실제
변경, source freshness, conflict, 최종 verification을 확인한 뒤에만 사용자에게 결론을 제공합니다.
