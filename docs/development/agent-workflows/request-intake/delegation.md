# Independent lane and child task contract

Delegation recommendation은 validated `TaskEnvelope`, current `ContextPack`, leader가 제시한 bounded lane
candidate를 입력으로 받는 advisory 결과입니다. Runtime child lifecycle이나 자동 spawn engine이 아닙니다.

## Single-first gate

다음 중 하나면 child contract를 생성하지 않습니다.

- Answer/direct request
- unresolved `clarify-now`, OQ 또는 mutation authority
- Plan primary owner conflict
- 독립적으로 완료 가능한 lane이 2개 미만
- native role routing capability를 확인할 수 없음
- result dependency 또는 겹치는 write ownership

기본 child 수는 0입니다. Bounded lane이 실제로 필요한 경우 기본 적용 한도는 3, 권장 범위는 2~3, hard
limit은 6입니다. 더 많은 candidate를 임의로 잘라 실행하지 않고 caller가 scope를 합치거나 명시적으로 6 이하의
한도를 선택해야 합니다.

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
id / domain / taskKind / priority / risk
objective / question
allowedEvidence[] / allowedTools[]
readScope[] / writeOwnership[]
dependencies[]
nonGoals[] / prohibitedAssumptions[]
expectedOutputFields[] / verification[]
stopCondition / handoffCondition
benefit: kind / rationale
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

`scripts/agents/routing-policy.mjs`가 task shape를 installed role name과 최소 충분 effort로 추천합니다.

- lookup: explore / low
- analysis: analyst / medium; high-risk는 high
- implementation: executor / medium; high-risk는 high
- debugging: debugger / high
- test: test-engineer / medium; high-risk는 high
- official research: researcher / high
- verification: verifier / high
- architecture: architect / high, critical만 xhigh
- review: code-reviewer / high

이 결과는 dispatch 명령이 아닙니다. 현재 surface가 role routing을 증명하지 못하면 role을 prompt label로 가장하지 않고
single/sequential fallback을 사용합니다. `max`와 `ultra`는 추천하지 않습니다.

## Ownership boundary

- Intake mapper는 child를 생성하지 않습니다.
- ContextPack registry는 lane을 만들지 않습니다.
- Child contract policy는 spawn, retry, reallocation, tmux 또는 workflow state를 실행하지 않습니다.
- `orchestration-policy.mjs`는 existing native surface를 사용하기 전 leader가 최종 독립성과 runtime capability를
  다시 확인할 수 있는 advisory result를 제공합니다.
