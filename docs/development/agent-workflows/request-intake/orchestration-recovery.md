# Bounded orchestration, recovery, and leader synthesis

이 계약은 독립 lane과 typed child contract를 포함한 delegation recommendation을 existing native child surface에
전달하기 전 마지막 advisory gate를 정의합니다. 새로운 child scheduler, queue, runtime state machine을 구현하지
않습니다.

## Native dispatch gate

`scripts/agents/orchestration-policy.mjs`는 다음을 모두 확인한 경우에만 typed native dispatch descriptor를
추천합니다.

- delegation 결과가 `bounded-lanes`
- 추천 child contract가 1개 이상, repository hard cap 6 이하
- 각 contract가 validated Pass 2 assessment, evidence ID와 transitional runtime gap을 보존
- 선택된 write-capable child가 최대 1개
- native surface는 current-turn `host-tool-schema`, OMX surface는 current-session `host-tool-schema`와
  `omx-runtime-overlay`를 provenance로 보고
- 선택된 각 project role이 fresh roster에 available 상태이며 effective model은 `gpt-6-astra`
- effective effort가 requested `medium | high | xhigh`와 일치하고 fixed-effort conflict가 없음
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
```

- Native evidence는 current-turn `host-tool-schema`만 허용합니다.
- OMX evidence는 current-session `host-tool-schema + omx-runtime-overlay`를 모두 요구합니다.
- local CLI/config inspection과 과거 session 결과는 supporting evidence일 뿐 active dispatch surface의 증명이 아닙니다.
- missing/stale/unknown/caller-invented provenance, generic `explore`로 project `knu_explorer`를 대신하는 mapping, Luna/Low,
  Terra, unavailable role, fixed-effort mismatch는 모두 sequential fallback입니다.
- Policy는 이 descriptor를 검증하지만 host event를 인증할 수 없으므로 결과를
  `leader-reported-not-host-authenticated`로 표시합니다.
- Dispatch descriptor는 `requiresLeaderRuntimeConfirmation=true`입니다. Leader는 실제 호출 직전에 live host roster와
  permission을 다시 읽고 조금이라도 달라지면 descriptor를 폐기합니다.

Project child model은 `.codex/config.toml`과 네 `knu_*` role이 명시적으로 선택합니다. Parent model 변경이나 OMX의
기본값 업데이트만으로 project pin이 바뀌지는 않습니다. Runtime policy의 `REPOSITORY_CHILD_MODEL`은 현재
`gpt-6-astra`이며, fixture에 남은 Sol/Terra/Luna는 legacy model 거절을 검증하는 negative evidence입니다.
이 모델 선택은 parent의 session model/effort나 child의 기존 sandbox·effort·count 경계를 바꾸지 않습니다.

## Recovery ceiling

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
- 권한·credential·external production은 기술적 retry로 해결하지 않습니다.
- official/repository evidence가 계속 없으면 `evidence-gap`, owner 결정이 없으면 `plan-oq`, 외부 권한이 필요하면
  `user-handoff`로 종료합니다.
- retry decision은 immutable record이며 worker respawn이나 task 재배치를 직접 실행하지 않습니다.

Capacity 오류와 완료 thread 정리는 [Parent-owned subagent lifecycle](../subagent-lifecycle.md)을 먼저 따릅니다.
결과 회수 후 capability별 분기로 explicit-close·검증된 no-close·unknown을 구별합니다. no-close 자체는 일반 dispatch
차단 사유가 아닙니다. 단 현재 operation의 실패나 pending/권한 미확인을 정상 경로로 바꾸지는 않습니다.
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
있으면 synthesis는 ready가 아닙니다.

## Leader-only synthesis

Policy는 child evidence를 정규화하여 leader에게 다음을 제공합니다.

- lane별 facts, inferences, gaps, confidence
- verification evidence
- missing/blocked/recovering lane
- unresolved 또는 leader-resolved conflict
- `readyForLeaderDecision`

`readyForLeaderDecision=true`도 자동 completion이나 final answer를 의미하지 않습니다. Leader가 repository의 실제
변경, source freshness, conflict, 최종 verification을 확인한 뒤에만 사용자에게 결론을 제공합니다.
