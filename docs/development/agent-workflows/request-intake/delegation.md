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
