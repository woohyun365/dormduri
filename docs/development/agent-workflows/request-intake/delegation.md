# Independent lane and child task contract

Delegation recommendation은 validated `TaskEnvelope`, current `ContextPack`, leader가 제시한 bounded lane
candidate를 입력으로 받는 advisory 결과입니다. Runtime child lifecycle이나 자동 spawn engine이 아닙니다.

## Single-first gate

다음 중 하나면 child contract를 생성하지 않습니다.

- Answer/direct request
- unresolved `clarify-now`, OQ 또는 mutation authority
- Plan primary owner conflict
- validated Pass 2 semantic evidence가 있는 독립 lane이 없음
- child 순이익이 low이거나 semantic evidence에 연결되지 않음
- result dependency 또는 겹치는 write ownership

기본 child 수는 0이며 독립적으로 가치 있는 lane 하나도 허용합니다. Proactive 추천은 보통 0~2개이고, 세 번째는 해당
lane의 Pass 2 evidence ID에 직접 연결된 high-value benefit이 있을 때만 허용합니다. Native/manual hard limit은 6이며
owner가 명시적으로 fan-out 한도를 지정하지 않으면 네 번째 lane을 추천하지 않습니다. Runtime role capability는 typed
contract 생성 조건이 아니라 dispatch 직전 orchestration gate에서 다시 확인합니다.

## Independence predicate

Lane은 다음을 모두 만족할 때만 independent입니다.

1. 다른 lane 결과 없이 완료할 수 있음
2. write scope가 sibling lane과 겹치지 않음
3. objective와 question이 bounded함
4. expected output과 verification이 명시됨
5. completeness, latency, specialist evidence, risk review 중 실제 순이익이 설명됨
6. 최종 결정·통합·검증은 leader에게 반환됨

Read-only lane끼리 같은 source를 읽는 것은 허용합니다. 같은 contract/file owner를 수정하거나 policy → contract →
implementation처럼 결과 dependency가 있으면 sequential path입니다.

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
```

`scripts/agents/child-task-contract.mjs`는 candidate를 다음 typed handoff로 정규화합니다.

```text
objective / question
allowed evidence and tools
read-only boundary or distinct write ownership
non-goals / prohibited assumptions
facts / inferences / gaps / confidence output labels
verification / stop / handoff condition
installed role and effort recommendation
leader-only final decision, response, integration, verification
```

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
  runtime: null | freshness / scopedFork / fullHistoryFork / followup / explicitEffort
                   / fullHistoryWithExplicitEffort / effectiveEffort
```

- 독립 작업의 기본은 `scoped`: 필요한 snapshot·evidence pointer·finding/failure만 전달하고 상위 대화는 fork하지 않습니다.
  `AGENTS.md`와 공통 실행 계약·적용되는 하위 지침은 계속 적용됩니다. 전달 추천이 native 상속 지침을 대체하지 않습니다.
- `initial-review`는 fresh scoped context만 허용합니다. 이전 builder를 reviewer로 바꾸거나 full history를 주입하지
  않습니다. `review-delta`는 scoped 또는 검증된 같은 reviewer 재사용이며 최초 독립 리뷰라고 다시 부르지 않습니다.
- `reuse`는 같은 outcome·lane·role·scope와 **이번 snapshot에 대한 재확인**이 필요합니다. 새 snapshot 자체는 delta에서
  정상적이지만 stale 확인값을 재사용하지 않습니다. 불일치하면 scoped 재구성을 추천하고 `compatible=false`로 둡니다.
  실제 child 소유·상태·pending·결과 귀속은 [lifecycle 계약](../subagent-lifecycle.md#후속-작업과-fan-in)으로 별도 확인합니다.
- `full-history`는 사유와 actual schema 지원이 필요합니다. 명시적 effort와 full fork 조합을 지원하지 않으면 통과시키지
  않습니다. inherited/fixed effort는 이미 선택된 role effort와 같아야 하며 비용 때문에 낮추지 않습니다.
- 지원 불명·stale 관측은 `compatible=false`; **모든 결과의 `applied=false`**는 순수 추천이 native 설정을 적용하지 않았다는
  뜻입니다. 실제 role/model/권한은 dispatch gate에서 별도 확인합니다. role-compatible 결과만 보고 context gate를 생략하지
  않으며 Parent는 delivery `compatible`와 gaps까지 확인한 뒤 실제 schema에 맞춰 전달합니다.
- evidence pointer는 기존 read scope 밖으로 확장하지 않습니다. history·allowedTools 같은 임의 필드와 길이 초과 입력은
  거절하며 실패 내용·안전 지침을 조용히 자르지 않습니다. 긴 로그는 허용 scope 안의 원문 pointer와 정확한 실패 요약으로
  전달합니다. 이 전달 요청은 self-attestation이며 새 권한이나 접근 허용 목록을 만들지 않습니다.

기존 fresh-session smoke는 이 결과를 실제로 소비하되 **synthetic/no-native 실행**입니다. Fixture의 UTF-8 bytes와
중복 전달 감소는 token/weekly 절감이 아니며, 미관측 usage는 `null/unknown`입니다. 실제 fork 설정·사용량 관측은 별도
native 실행 evidence가 필요합니다. 비용 운영 기준은 [orchestration owner](../orchestration.md#context와-검증-비용)를 따릅니다.
Native의 numeric fork 지원 여부는 이 계약의 필수 확장 사유가 아닙니다. 실제 consumer 요구 없이 새 전달 모드를 만들지 않으며,
기존 complete packet·fresh initial QA·role/context 두 gate를 유지합니다. 결과 회수 후에는 [capability별 완료 판정](../subagent-lifecycle.md#capability별-완료-판정)을 따르고, 무관한 재사용이나 close 없는 환경의 실패를 기본값으로 가정하지 않습니다.

## Role and effort

`scripts/agents/routing-policy.mjs`는 raw prompt나 task label만으로 role/effort를 확정하지 않습니다.

- Pass 1: TaskEnvelope의 intent·authority·impact risk와 candidate task shape를 보존합니다.
- Pass 2: current ContextPack source에 연결된 stable fact와 semantic predicate claim을 검증합니다.
- 역할: lookup/analysis는 `knu_explorer`, official research는 `knu_researcher`, implementation/debug/test는
  `knu_executor`, review/verification/architecture evidence lane은 `knu_reviewer`입니다.
- Effort: complete positive boundedness evidence는 Medium, mandatory/deep-composite evidence는 XHigh, 나머지 substantial
  evidence는 High입니다. Low/Max/Ultra는 repository child route가 아닙니다.

Impact risk와 reasoning complexity는 서로 다른 결과입니다. Keyword, path, file count, LOC, task label은 semantic signal을
대체할 수 없고, 동일 fact를 여러 composite category에 중복 반영하지 않습니다. 이 결과는 dispatch 명령이나 live role
proof가 아닙니다. Active surface evidence가 없으면 support unknown/applied false 상태로 두고 leader가 dispatch 직전에
runtime compatibility를 확인합니다. Native는 current-turn host tool schema, OMX는 current-session runtime overlay와
host-exposed role roster가 함께 있어야 하며 local config나 과거 session 결과는 active authority가 아닙니다. Parent effort는
이 contract 밖에서 사용자가 선택합니다.

## Count와 write policy

- Direct, deterministic, ambiguous, dependent, missing-Pass-2, low-benefit work: 0 child
- 독립적으로 가치 있는 bounded lane: 1 child 허용
- 일반 proactive fan-out: 최대 2 child
- Pass 2 evidence에 연결된 high-value third lane: 최대 3 child
- 명시적인 owner-directed fan-out: 최대 6 child
- 선택 가능한 write-capable child: 최대 1개
- sibling write scope가 겹치면 해당 lane들은 independent가 아니므로 선택하지 않음

각 `routeRecommendation`은 최종 effort뿐 아니라 validated Pass 2 assessment, evidence ID, confidence와
`runtime-role-evidence-deferred` gap을 함께 전달합니다. Keyword나 candidate의 legacy `risk` field로 이 근거를 대체할 수
없습니다.

## Ownership boundary

- assignment·재배정·scope/file owner 변경·결과 판정·통합은 Parent 책임입니다. Child 결과와 blocker는 Parent로 반환합니다.
- 기본 Parent 경유와 지정된 기존 사실 확인 예외는 [공통 협업 계약](../owner-lead-collaboration.md)을 따릅니다. 참여자·주제·
  read scope·snapshot 지정은 기존 task text/allowedTools/nonGoals로 전달하며 schema나 runtime 권한 필드를 만들지 않습니다.
- 도구 지원만으로 peer 권한이 생기지 않습니다. 초기 QA 독립성, 보고와 만료 조건을 지키고, 새 업무·상충·반복 의존성은
  Parent에게 돌려보냅니다. Child의 직접/간접 offload와 sub-child 생성은 허용하지 않습니다.
- Intake mapper는 child를 생성하지 않습니다.
- ContextPack registry는 lane을 만들지 않습니다.
- Child contract policy는 spawn, retry, reallocation, tmux 또는 workflow state를 실행하지 않습니다.
- `orchestration-policy.mjs`는 existing native surface를 사용하기 전 leader가 최종 독립성과 runtime capability를
  다시 확인할 수 있는 advisory result를 제공합니다.
