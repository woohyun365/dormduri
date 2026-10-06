# Bounded orchestration, recovery, and leader synthesis

이 문서는 Codex adapter가 소유하는 reference입니다. Model profile, model recovery 중단, `scripts/agents/codex/` descriptor와 admission은 Codex/OMX 실행 계약입니다.
공통 one-writer·source freshness·authority·QA는 [orchestration](../orchestration.md)과 [execution contract](../agent-execution-contract.md)가 소유합니다.
Claude Code에는 [native adapter](../adapters/claude-code.md)를 사용하며 이 schema로 Claude model/runtime 지원을 가장하지 않습니다.

이 계약은 독립 lane과 typed child contract를 포함한 delegation recommendation을 existing native child surface에
전달하기 전 마지막 advisory gate를 정의합니다. 새로운 child scheduler, queue, runtime state machine을 구현하지
않습니다.

## Native dispatch gate

`scripts/agents/codex/orchestration-policy.mjs`는 다음을 모두 확인한 경우에만 typed native dispatch descriptor를
추천합니다.

- delegation 결과가 `bounded-lanes`
- 추천 child contract가 1개 이상, repository hard cap 6 이하
- 각 contract가 validated Pass 2 assessment, evidence ID와 transitional runtime gap을 보존
- 선택된 write-capable child가 최대 1개
- native surface는 current-turn `host-tool-schema`, OMX surface는 current-session `host-tool-schema`와
  `omx-runtime-overlay`를 provenance로 보고
- 선택된 각 project role이 fresh roster에 available 상태이며 model 해석이 기본 `gpt-6-astra` 또는 아래 exact admission 후보와 일치
- route effort가 그 역할 파일의 pin effort이고, 해석된 effort가 그 값(`medium | high | xhigh`)과 일치하며 fixed-effort conflict가 없음
- higher-priority runtime permission이 dispatch를 허용
- leader-only dispatch, decision, response, integration, verification ownership 유지

조건을 충족하지 않으면 child를 생성하지 않고 leader direct 또는 single-sequential fallback을 반환합니다.
Descriptor는 `spawn_agent`, tmux, tool command를 실행하지 않습니다. 실제 dispatch 여부는 current leader와 native
runtime이 결정합니다.

## Reported runtime evidence

Runtime evidence는 다음 bounded field만 사용합니다.

```text
surfaceMode: native | omx
observationScope / freshness: current-turn | current-session
provenance: host-tool-schema | omx-runtime-overlay
dispatchPermission: allowed | denied | unknown
roles[]:
  agentType / available
  effectiveModel / effectiveEffort
  explicitEffortSupport
  modelSelection?: supportedModels[] / roleModel / explicitModelSupport / reference
  configurationResolution?: profileBinding / model / effort / configDigest / reference
```

- Native evidence는 current-turn `host-tool-schema`만 허용합니다.
- OMX evidence는 current-session `host-tool-schema + omx-runtime-overlay`를 모두 요구합니다.
- local CLI/config inspection과 과거 session 결과는 supporting evidence일 뿐 active dispatch surface의 증명이 아닙니다.
- missing/stale/unknown/caller-invented provenance, generic `explore`로 project `knu_explorer`를 대신하는 mapping, Low,
  미채택/미허용 Sol·Luna 또는 host가 보고한 허용 목록 밖 model, unavailable role, fixed-effort mismatch는 모두 sequential
  fallback입니다.
- Policy는 이 descriptor를 검증하지만 host event를 인증할 수 없으므로 결과를
  `leader-reported-not-host-authenticated`로 표시합니다.
- Dispatch descriptor는 `requiresLeaderRuntimeConfirmation=true`입니다. Leader는 실제 호출 직전에 live host roster와
  permission을 다시 읽고 조금이라도 달라지면 descriptor를 폐기합니다.

Project child 기본값은 `.codex/config.toml`의 Astra입니다. 열 역할 모두 model pin 없이 profile이 정한 명시적 task 모델을
받고(`knu_reviewer`는 `review` profile의 Astra), effort는 각 역할 파일의 pin이 정합니다. 호출할 수 있는 (역할, model) 쌍은
각 profile의 역할과 그 profile model입니다. Parent model 변경이나 OMX의 기본값
업데이트를 project 역할·설정의 실제 로드 증거로 사용하지 않습니다. Runtime policy의 child 기본값은 허용 목록 owner의
`BASELINE_CHILD_MODEL`이고, `.codex/config.toml` 기본값은 test로 이 값에 결속되며 역할 파일의 `model` 필드는 test가 금지합니다. 허용 목록 밖 model
거절은 합성 ID 하나로 검증하며, 모델 입력·허용 근거 없는 caller를 막는 negative evidence로 유지합니다.
이 모델 선택은 parent의 session model/effort나 child의 기존 sandbox·count 경계를 바꾸지 않습니다. Semantic 계층(`tier`)은 역할 변형을 고를 뿐이며, route effort와 후보 resolved effort는 모두 그 역할의 pin과 대조합니다.

## Model admission

Candidate descriptor는 추가적인 `modelUseByLane[laneId]`를 요구합니다. 모든 값은 **Parent가 보고한 evidence**이며
boolean/JSON packet만으로 사용자 허용·host 권한·품질 GO가 생기지 않습니다. Unknown field/누락 schema와 허용 목록 밖
admission·attempt `model`은 TypeError, 없거나 불일치한 evidence는 sequential fallback입니다.

```text
observedAt: exact ISO timestamp
configDigest / scopeDigest: sha256:<64 hex>
scopeStatus: current | changed | unknown
checks: passed | failed | unknown
remainingBudget: children / minutes
admission: null | {
  kind: pilot | adoption
  reference: original owner authorization/evidence reference
  quality: unadopted | go | no-go
  profileBinding: profileId / policyRevision / profileDigest / model / resolvedEffort / cohort
  model / role / effort / cohort
  scopeDigest / configDigest
  notBefore / expiresAt: exact ISO timestamps
  budget: maxChildren (1..6) / maxMinutes (1..60)
  cleanupReference: exact supported cleanup contract/reference
}
```

- `purpose=pilot`는 **별도 exact pilot 허용**과 `kind=pilot`, quality가 no-go가 아닐 때만 허용 후보입니다. 아직 adoption GO가
  없는 최초 비교를 막지 않습니다. `purpose=routine`은 `kind=adoption` 및 quality GO가 필요합니다. Pilot packet/PASS는
  routine에서 재사용할 수 없고, 결과가 좋더라도 별도 채택 결정이 필요합니다.
- Grant와 현재 installed profileBinding, contract의 task/cohort/model/role/resolved effort/tool/write/source snapshot, 현재 config digest가 일치해야 합니다.
  Profile revision/hash가 바뀌면 scope digest 재계산으로 구형 승인을 살릴 수 없습니다.
  Parent는 원래 허용에 이 정확한 대상이 연결되는지 다시 확인합니다. Current-turn/runtime flag와 해시만으로 실제 freshness나
  권한을 입증했다고 주장하지 않습니다. 보고 observedAt에 대한 유효기간과 남은 budget을 검사하며 집행/계수기는 아닙니다.
- Permission denied/unknown, scope 변경, required checks failure, 만료, 예산 소진, snapshot/config mismatch는 candidate를
  철회하고 Parent로 반환합니다. Parent가 실제 현재 시각·잔여 허용·source/config bytes·pending 작업을 다시 확인합니다.
- `modelSelection`은 현재 runtime provenance 아래 지원 모델 roster·실제 role pin·explicit override 지원·원문 reference를
  보고합니다. `roleModel=null`은 확인된 unpinned이지 unknown이 아닙니다. Requested model이 지원되고 model 해석과
  일치해야 하며, candidate pin 또는 확인된 unpinned+explicit support가 필요합니다. Astra pin은 인자만으로 우회하지 않습니다.
- Candidate는 `contextDelivery.compatible=true`, scoped, 실패 evidence 없음이 별도로 필요합니다. 읽기 profile(`standard-read`·
  `elevated-read`)은 repository/official read-only 도구만, `extract`는 고정된 repository-read만, 구현 profile(`standard-build`·
  `elevated-build`)은 단일 write owner와 workspace-edit/test-runner를 요구합니다. Route의 역할·effort·`profileId`가 그 profile의
  역할 변형과 effort에 맞지 않으면 `model-effort-eligibility-mismatch`입니다.
  Advice는 실제 applied model을 보장하지 않습니다.

이 advisory helper는 project 설정/role pin을 수정하거나 서버/CLI를 시작하지 않습니다. 설정 변경과 loaded-schema 확인은
[Task model configuration and fresh loading](../adapters/codex.md#task-model-configuration-and-fresh-loading)이 소유합니다. 후보 판정은 실제 모델 사용·native 지원·품질 동등성·비용 절약 증거가 아닙니다. Parent/최종 QA/effort/cap/권한 경계는 유지합니다.

## Routine admission lifetime

[운영 cohort 결정과 cold-start](../adapters/codex.md#routine-task-model-operation)를 먼저 확인합니다. 그 결정의 reference는
profile/role/범위의 채택 근거이지 이 호출의 scope/config/time/budget 승인 JSON이 아닙니다. Parent는 현재 승인된 사용자
업무를 원문으로 확인하고 양쪽 reference를 연결해 새 packet을 작성합니다. 별도 모델명 재승인을 매번 요구하지 않지만
동일한 source/권한·risk로 확인하지 않은 scope 확대를 일반 업무로 위장하지 않습니다.

**철회는 Parent의 운영 책임**입니다. 새 dispatch를 멈추고 관련 admission을 `null` 또는 `quality=no-go`로 폐기/갱신하며
불일치 source/config/role·실패한 checks는 그대로 남깁니다. 과거 grant의 만료 시간만 바꾸거나 scope hash만 재계산해
재사용하지 않습니다. Routine은 pilot/PASS를 adoption GO로 대체할 수 없습니다.

이 helper에는 외부 revoked-state lookup이나 영구 취소 목록이 없습니다. **같은 유효한 GO packet을 다시 넣으면 통과할 수
있습니다.** 따라서 철회 기록·사용 중단·원래 권한 재확인과 재채택은 Parent가 수행해야 하며 boolean/해시로 강제했다고
주장하지 않습니다. Code/registry 전체를 과거 버전으로 되돌려 옛 grant를 살리는 것도 보호하는 엔진이 아닙니다.

재채택할 때는 필요한 품질·독립 검사 후 현재 contract/profileBinding과 config/scope bytes, 새 bounded validity window,
잔여 budget, cleanup reference를 다시 연결합니다. 이미 실행된 실패는 exact recovery identity에 남기고 성공으로 재명명하지
않습니다. 아직 실행하지 않은 지원 불일치는 pre-dispatch gap이지 candidate 품질 실패가 아닙니다. 운영 철회와 설정 rollback의
순서는 [Astra-only rollback](../adapters/codex.md#suspension-and-astra-only-rollback)을 따릅니다.

## First dispatch and post-execution evidence

첫 실행 전에는 `configurationResolution`으로 현재 host schema·loaded config의 해석과 정확한 digest/reference를 보고하고
`effectiveModel=null`, `effectiveEffort=null`을 사용합니다. 두 방식을 혼합하면 거절합니다. Resolution digest는 현재
model-use config digest와 같고 profileBinding도 현재 contract와 일치해야 하며 explicit model/effort와 scoped fork 지원이 필요합니다. File-only/unknown/stale
provenance는 여전히 거절합니다. 기존 effective 필드 형식의 compatibility caller는 유지하지만 이를 최초 실행의 증명으로
쓰거나 새 activation post-report를 대신하게 하지 않습니다.

승인 후보 descriptor의 `spawnArguments`는 다음처럼 role·모델·effort·context를 명시합니다.

```json
{
  "agent_type": "knu_explorer_xhigh",
  "model": "gpt-6-luna",
  "reasoning_effort": "xhigh",
  "fork_turns": "none"
}
```

`dispatch.effort`와 `spawnArguments.reasoning_effort`는 모두 선택된 역할 파일의 pin effort이고, semantic 계층은 contract의
`routeRecommendation.tier`에 남습니다.
`resolvedModel/resolvedEffort`는 해석 결과, `runtimeAction=false`는 미실행을 뜻합니다. Parent가 실제 source/config/scope/
시간·예산·권한을 재확인하고 지원되는 native tool의 `task_name/message`와 bounded contract를 구성해 호출합니다.
순수 helper는 spawn을 수행하지 않습니다. Runtime roster는 role을 model마다 한 행으로 보고하고, 각 lane은 자기 role과
요청 model이 맞는 행으로 검사합니다. 그래서 같은 role의 다른 model lane(2026-10-06 native 관측)도 candidate를 포함해 일반
동시 한도 안에서 함께 나갑니다. 같은 role·model 행이 두 번이면 roster duplicate gap입니다.

`evaluateModelExecution({ dispatch, expectedChildId, reportedExecution })`은 별도 사후 보고를 검사합니다.

```text
expectedChildId: actual native spawn return에서 회수한 ID
reportedExecution:
  childId / taskId / scopeDigest / profileBinding
  provenance: native-tool-result
  accepted / executed: true
  resultReference: native final/result 원문
  independentCheck: status=passed / reference
  hostMetadata: null | { model / effort }
  usageReference: null | 측정 artifact reference
```

추천 eligibility와 현재 installed binding을 재검증하고 정확한 child/task/scope/profile·실제 accepted/executed 결과·독립 품질 검사가 맞을 때만 `accepted=true`입니다. Host metadata가 있으면
요청 model/effort와 대조하고, 없으면 `runtime-contract-resolved`로 구분합니다. 이 hostMetadata는 Parent 보고이며, host가 기록한
child model·effort의 대조는 [Codex 완료 관측](../adapters/codex.md#subagent-hook-guardrail과-완료-관측)이 맡습니다. `host-reported-model`조차 이 helper가
provider를 인증했다는 뜻은 아니므로 `providerAttested=false`입니다. 자기소개·응답 스타일은 provenance가 아닙니다.
모든 JSON/reference는 Parent 보고이며 원문 native evidence/권한을 대신하지 않습니다. Output도 `runtimeAction=false`입니다.

`usageReference=null`은 비용 미측정이지 실패가 아닙니다. 채택된 cohort의 일반 업무도 권한·범위·품질 재확인은 필요하지만
매번 사용자에게 모델명 또는 새 pilot을 요구하지 않습니다. 범위/품질/지원 변화만 재평가하며 cost telemetry를 필수 승인서로
추가하지 않습니다.

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
- Recovery decision을 받은 dispatch는 binding을 검증하지 못해 `model-recovery-incompatible-or-unadmitted` gap을 남기고
  descriptor를 만들지 않습니다.
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
- **기록 경계**: Hook 기록은 identity와 크기만 남기고 message 본문을 넣지 않습니다. Parent의 작업 증거에도 원문 prompt·transcript·
  credential을 넣지 않고 참조 ID로 연결합니다. 기록 실패는 gap으로 보고하며 실행 권한이나 PASS를 만들지 않습니다.

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
