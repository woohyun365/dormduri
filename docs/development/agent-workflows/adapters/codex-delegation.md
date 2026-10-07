# Codex/OMX child selection, model and context delivery

이 문서는 [공통 lane 계약](../request-intake/delegation.md)의 Codex 전용 확장입니다. Claude 모델 admission/runtime을 정의하지 않습니다. 구현 owner는 `scripts/agents/codex/`이며 제거된 root compatibility imports를 사용하지 않습니다. 일반 요청의 composition은 [Codex workflow entry](./codex.md#repository-workflow-entry)를 사용하고, 아래 API는 host policy leaf입니다.

## Candidate schema

```text
id / domain / taskKind / priority / impactRisk
objective / question
allowedEvidence[] / allowedTools[]
readScope[] / writeOwnership[]
dependencies[]
nonGoals[] / prohibitedAssumptions[]
expectedOutputFields[] / verification[]
stopCondition / handoffCondition
benefit: kind / rationale / value / evidenceIds
pass2Evidence: sources / facts / predicateClaims / inferences / gaps / confidence
modelRequest?: profileId / purpose / verificationFacts
```

`scripts/agents/codex/child-task-contract.mjs`는 candidate를 다음 typed handoff로 정규화합니다.

```text
objective / question
allowed evidence and tools
read-only boundary or distinct write ownership
non-goals / prohibited assumptions
facts / inferences / gaps / confidence output labels
verification / stop / handoff condition
installed role variant, its pinned effort, semantic tier and profileId
leader-only final decision, response, integration, verification
```

## Model recommendation

선택형 `modelRequest`는 기존 lane 또는 `selectAgentRoute()` 입력에서 같은 strict schema를 사용합니다.

```text
profileId: extract | standard-read | elevated-read | standard-build | elevated-build
purpose: pilot | routine
verificationFacts:
  standard-read, elevated-read: acceptance / independentCheck
  standard-build, elevated-build: acceptance / regression / astraQa
  extract: acceptance / fixedInput / outputSchema / singleStep / independentCheck
```

Assignment profile(`deep-build`·`review`·`astra-fallback`)은 routing이 정하는 Astra 배정이라 `modelRequest`로 요청할 수 없습니다.

각 verification 값은 current Pass 2의 high-confidence `factId`입니다. Acceptance와 실행 가능한 검사/독립 확인,
구현 lane의 regression 및 Astra QA 계획을 실제 source에 근거해 작성합니다. Policy가 자연어 사실의 진실이나 앞으로
실행할 QA 성공을 인증하지는 않으므로 Parent가 원문 근거와 최종 결과를 확인합니다. 임의의 다른 fact를 연결해서는 안 됩니다.

[채택 범위와 cold-start 순서](./codex.md#routine-task-model-operation)를 확인한 일반 Parent는 매 bounded delegation에서 task/위험/검증 방법을 판정하고 적합한 `modelRequest`를 직접 채웁니다.
사용자에게 모델명을 매번 다시 선택하게 하지 않습니다. 단, cohort 채택과 이번 task의 실제 작업 권한은 별개입니다.
GPT-6.1 Sol은 `standard-build`·`elevated-build`의 구현/test 또는 `standard-read`·`elevated-read`의 lookup/analysis/research
후보이며 routine과 pilot 모두 받습니다. GPT-6 Luna는 `extract`의 low-impact
lookup/analysis 고정 입력·단일 semantic extraction만 후보입니다. Luna에는 무제한 조사·공식 웹 탐색·쓰기 권한을 부여하지 않습니다. 단순 grep/list/format이면 child 없이 도구를 씁니다.

입력 누락은 기존 default Astra 동작을 유지합니다. [Orchestration의 보수적 후보 조건](./codex.md#quality-gated-model-advice)을
충족하면 `routeRecommendation.modelRecommendation`에 request/taskKind/role, recommendedModel, candidate/baseline,
reason, `applied=false`, `profileBinding`을 붙이고 route의 `role`·`effort`·`profileId`를 후보 역할 변형으로 정합니다.
부적합 task·위험·품질 gap이나 routine 미채택 profile은 Astra baseline이며 route는 [Astra 배정](./codex.md#reasoning-effort-routing)입니다.

중앙 owner는 `scripts/agents/codex/model-profiles.mjs`입니다. `profileBinding`은 profileId/policyRevision/profileDigest/model/
resolvedEffort/cohort이며, digest는 role/task/risk/검증 fact/tool 범위를 포함한 전체 profile data의 canonical hash입니다.
`routeRecommendation.tier`는 semantic 계층(Medium/High/XHigh)이고, `routeRecommendation.effort`는 선택된 역할 파일의
pin effort입니다. Candidate의 `resolvedEffort`는 그 역할의 effort와 같습니다(standard high, elevated·extract xhigh).
Context 전달·native descriptor·hook 완료 대조는 같은 effort를 사용합니다. Caller가 raw model/cohort를 주입하거나 허용 목록 밖 model을 쓰는 입력,
unknown profile/field/불완전 verification schema는 거부합니다. Astra default는 modelRequest 생략으로 유지합니다.

Child contract는 original task identity인 `modelTaskId`와 `modelScopeDigest`를 함께 전달합니다. Digest는 source digest에
연결된 semantic facts, 전체 profileBinding, 목적·role/effort/cohort, read/tool/write 범위, output/verification/stop/handoff, context delivery를 포함한
전체 contract의 정확한 JSON 표현에 연결됩니다. Field 순서까지 달라진 재직렬화는 재생성/재승인이 필요할 수 있습니다.
Hash는 무결성 대조값이지 source freshness·권한 증명은 아닙니다. 실제 파일/config 재확인은 Parent 책임입니다.

이 packet은 candidate 제안이지 운영 채택 GO가 아닙니다. Lane별 허가 packet은 없고, dispatch가 contract의 profile 경계와
snapshot(`modelScopeDigest`)을 다시 계산해 맞지 않으면 Parent로 돌려보냅니다([Native dispatch gate](../request-intake/orchestration-recovery.md#native-dispatch-gate)).
Candidate는 compatible한 fresh scoped context만 지원하며 full-history/reuse의 모델 변경을 추측하지 않습니다. Context gate와
profile gate는 독립이며 하나의 성공이 다른 쪽을 생략하지 않습니다.

## Context delivery

`recommendDelegation()`의 선택 입력 `deliveryByLane`은 기존 lane ID별 context 전달 관측을 받습니다. 생략하면 기존
contract와 routing 동작을 그대로 반환합니다. 사용하면 선택된 child contract에 `contextDelivery`만 추가하며, 원래의
objective·scope·allowed tools·non-goals·금지 가정·output·검증·stop/handoff·role/effort·Parent 책임을 삭제하지 않습니다.
전달 packet은 이 **완전한 child contract 하나**이며 같은 contract나 전체 transcript를 다시 붙이지 않습니다.

```text
deliveryByLane[laneId]
  purpose: task | initial-review | review-delta
  mode: scoped | full-history | reuse
  effortMode: explicit | inherit
  rationale: string | null
  snapshot / evidencePointers[] / findings[] / failures[]
  previous: null | childId / laneId / role / sourceSnapshot / revalidatedForSnapshot
                    / sameOutcome / scopeUnchanged / independentReview
```

Runtime 지원 관측 필드는 없습니다. Effort는 역할 파일의 pin이고 fork 허용은 project hook이 호출 시점에 검사합니다.

- 독립 작업의 기본은 `scoped`: 필요한 snapshot·evidence pointer·finding/failure만 전달하고 상위 대화는 fork하지 않습니다.
  `AGENTS.md`와 공통 실행 계약·적용되는 하위 지침은 계속 적용됩니다. 전달 추천이 native 상속 지침을 대체하지 않습니다.
- `initial-review`는 fresh scoped context만 허용합니다. 이전 builder를 reviewer로 바꾸거나 full history를 주입하지
  않습니다. `review-delta`는 scoped 또는 검증된 같은 reviewer 재사용이며 최초 독립 리뷰라고 다시 부르지 않습니다.
- `reuse`는 같은 outcome·lane·role·scope와 **이번 snapshot에 대한 재확인**이 필요합니다. 새 snapshot 자체는 delta에서
  정상적이지만 stale 확인값을 재사용하지 않습니다. 불일치하면 scoped 재구성을 추천하고 `compatible=false`로 둡니다.
  실제 child 소유·상태·pending·결과 귀속은 [lifecycle 계약](../subagent-lifecycle.md#후속-작업과-fan-in)으로 별도 확인합니다.
- `full-history`는 사유가 필요하고, project hook이 full-history fork(`fork_turns` 생략·`all`)를 거절하므로 항상
  `full-history-fork-denied`로 `compatible=false`입니다. `effortMode=inherit`도 역할 pin effort를 바꾸지 않으며, reuse에
  `explicit` effort를 요청하면 `reuse-effort-override-unsupported`입니다.
- **모든 결과의 `applied=false`**는 순수 추천이 native 설정을 적용하지 않았다는 뜻입니다. 실제 role/model은 호출 시점에 hook이
  검사합니다. role-compatible 결과만 보고 context gate를 생략하지 않으며 Parent는 delivery `compatible`와 gaps까지 확인한 뒤
  전달합니다.
- evidence pointer는 기존 read scope 밖으로 확장하지 않습니다. history·allowedTools 같은 임의 필드와 길이 초과 입력은
  거절하며 실패 내용·안전 지침을 조용히 자르지 않습니다. 긴 로그는 허용 scope 안의 원문 pointer와 정확한 실패 요약으로
  전달합니다. 이 전달 요청은 self-attestation이며 새 권한이나 접근 허용 목록을 만들지 않습니다.

`createDispatchRecommendation()`은 **공급된** `contextDelivery`의 `compatible=true`, `applied=false`, 빈 `gaps`, `scoped`·`reuse`
mode를 확인하고 불일치/unknown이면 ordinary Astra에서도 dispatch 없이 `context-delivery-incompatible:<laneId>`를 반환합니다. 호환되는
`reuse`는 새 spawn이 아니므로 `context-reuse-not-a-spawn:<laneId>`입니다. 선택 입력을 **생략**하면 fresh scoped spawn이지만,
이 생략은 실제 호출의 context 확인을 면제하지 않습니다. 필수 독립 QA가 막힌 경우 sequential disposition을 Parent self-review
PASS로 바꾸지 않습니다.

Descriptor는 contract에서 `spawnArguments={task_name, agent_type, model, reasoning_effort, fork_turns: none}`를 정합니다.
`agent_type`은 route 역할, `model`은 route profile의 model(ordinary는 `gpt-6-astra`), `reasoning_effort`는 역할 pin입니다. `task_name`은 lane id의 `-`를 `_`로 바꾼 값이고, Parent가 dispatch마다 준 `dispatchToken`이 있으면 `_<token>`을
붙입니다. 이 이름이 hook 완료 기록과 그 dispatch의 lane을 잇습니다. `fork_turns`는 V2 인자입니다.
`failures`는 ordinary 전달에서 보존해야 할 근거이며 자동 거절 사유가 아닙니다. Candidate의 profile 경계는 별도로 확인하며
model recovery는 중단되어 있습니다.

Reuse·OMX advisory 경로를 fresh native spawn으로 변환하지 않습니다. Descriptor는 실제 실행·provider-effective 설정을
증명하지 않으며, child가 실제로 받은 model·effort는 hook 기록이 근거입니다. 기존 source/권한 의미의
진실성까지 순수 helper가 인증하지 않으므로 Parent는 실제 host와 완전한 packet을 확인한 후에만 호출합니다.

중복 전달 감소를 token/weekly 절감으로 해석하지 않으며, 미관측 usage는 `null/unknown`입니다. 실제 fork 설정·사용량 관측은 별도
native 실행 evidence가 필요합니다. 비용 운영 기준은 [orchestration owner](../orchestration.md#context와-검증-비용)를 따릅니다.
Native의 numeric fork 지원 여부는 이 계약의 필수 확장 사유가 아닙니다. 실제 consumer 요구 없이 새 전달 모드를 만들지 않으며,
기존 complete packet·fresh initial QA·role/context 두 gate를 유지합니다. 결과 회수 후에는 [capability별 완료 판정](../subagent-lifecycle.md#capability별-완료-판정)을 따르고, 무관한 재사용이나 close 없는 환경의 실패를 기본값으로 가정하지 않습니다.

## Role and effort

`scripts/agents/codex/routing-policy.mjs`는 raw prompt나 task label만으로 role/effort를 확정하지 않습니다.

- Pass 1: TaskEnvelope의 intent·authority·impact risk와 candidate task shape를 보존합니다.
- Pass 2: current ContextPack source에 연결된 stable fact와 semantic predicate claim을 검증합니다.
- 역할 family: lookup/analysis는 `knu_explorer`, official research는 `knu_researcher`, implementation/debug/test는
  `knu_executor`, review/verification/architecture evidence lane은 `knu_reviewer`입니다.
- 계층(`tier`): complete positive boundedness evidence는 Medium, mandatory/deep-composite evidence는 XHigh, 나머지 substantial
  evidence는 High입니다. Low/Max/Ultra는 repository child route가 아닙니다.
- 역할 변형과 effort: 계층·impact가 family 안의 변형(`_medium`·기본·`_xhigh`)과 `profileId`를 고르고, `effort`는 그 역할
  파일이 pin한 값입니다. 배정 표는 [Codex routing](./codex.md#reasoning-effort-routing)이 소유합니다.

Impact risk와 reasoning complexity는 서로 다른 결과입니다. Keyword, path, file count, LOC, task label은 semantic signal을
대체할 수 없고, 동일 fact를 여러 composite category에 중복 반영하지 않습니다. 이 결과는 dispatch 명령이나 live role
proof가 아닙니다. 호출 시점의 역할 roster·(역할, model) 쌍은 [project hook](./codex.md#subagent-hook-guardrail과-완료-관측)이
검사하며 local config나 과거 session 결과는 active authority가 아닙니다. Parent effort는 이 contract 밖에서 사용자가 선택합니다.

## Count와 write policy

- Direct, deterministic, ambiguous, dependent, missing-Pass-2, low-benefit work: 0 child
- 독립적으로 가치 있는 bounded lane: 1 child 허용
- 일반 proactive fan-out: 최대 2 child
- Pass 2 evidence에 연결된 high-value third lane: 최대 3 child
- 명시적인 owner-directed fan-out: 최대 6 child
- 선택 가능한 write-capable child: 최대 1개
- sibling write scope가 겹치면 해당 lane들은 independent가 아니므로 선택하지 않음

각 `routeRecommendation`은 역할 변형·pin effort·계층·`profileId`뿐 아니라 validated Pass 2 assessment, evidence ID와 confidence를
함께 전달합니다. Keyword나 candidate의 legacy `risk` field로 이 근거를 대체할 수
없습니다.

## Ownership boundary

- assignment·재배정·scope/file owner 변경·결과 판정·통합은 Parent 책임입니다. Child 결과와 blocker는 Parent로 반환합니다.
- 기본 Parent 경유와 지정된 기존 사실 확인 예외는 [공통 협업 계약](../owner-lead-collaboration.md)을 따릅니다. 참여자·주제·
  read scope·snapshot 지정은 기존 task text/allowedTools/nonGoals로 전달하며 schema나 runtime 권한 필드를 만들지 않습니다.
- 도구 지원만으로 peer 권한이 생기지 않습니다. 초기 QA 독립성, 보고와 만료 조건을 지키고, 새 업무·상충·반복 의존성은
  Parent에게 돌려보냅니다. Child의 직접/간접 offload와 sub-child 생성은 허용하지 않으며, project hook이 로드된 세션에서는
  child가 부른 spawn을 [호출 시점에 deny](./codex.md#subagent-hook-guardrail과-완료-관측)합니다.
- V2 peer 메시지는 실행 중인 child에만 전달이 관측됐습니다. 완료된 child는 메시지로 turn을 시작하지 않으므로([새 turn 없이
  queue](https://developers.openai.com/api/docs/guides/responses-multi-agent#how-multi-agent-works)) 응답이 필요하면 Parent가
  `followup_task`로 후속을 배정합니다. 재개 뒤 쌓인 메시지가 전달되는지는 관측되지 않았으므로 그 전달에 기대지 않습니다.
- Intake mapper는 child를 생성하지 않습니다.
- ContextPack registry는 lane을 만들지 않습니다.
- Child contract policy는 spawn, retry, reallocation, tmux 또는 workflow state를 실행하지 않습니다.
- `orchestration-policy.mjs`는 existing native surface를 사용하기 전 leader가 최종 독립성을 확인하고 그대로 전달할
  `spawnArguments`를 담은 advisory result를 제공합니다. Runtime capability는 호출 시점에 hook이 검사합니다.

### Recovery child context

Model recovery는 [중단](./codex.md#model-recovery-suspension)되어 있어 아래 helper는 현재 호출 경로가 없습니다. 중단 해제나
대체 정책이 정해질 때까지 계약 기록으로만 남습니다.

`createRecoveryChildContract({ primaryContract, sourceSnapshot })`는 기존 primary의 task/lane/role·effort·계층과
owner/tool/verification 경계를 복제하고 candidate recommendation만 제거합니다. 현재 rescue snapshot으로 scoped explicit
context와 scope digest를 갱신하며 recovery를 가짜 candidate로 만들지 않습니다. 이 helper 자체는 실패·권한을 승인하지 않습니다.

`assertRecoveryChildContract(contract, recoveryBinding)`은 current binding, 원래 boundary/allowed ownership digest,
rescue task/lane/source scope, semantic risk와 scoped task context를 확인합니다. Recovery invocation의 low는 별도 binding에서만
해석되며, 중단 상태라 그 binding은 만들어지지 않습니다(recovery resolution·admission 입력은 없음). Ordinary delivery에는 effort
관측 입력이 없고, inherited/full-history rescue는 계속 거절합니다. `evaluateRecovery`는 원래 primary 실패·현재 contract를 검증하며
source 변경이 쓰기 범위 확대를 허용하지 않습니다. 중단 계약은 [model recovery suspension](../request-intake/orchestration-recovery.md#model-recovery-suspension)을 따릅니다.
