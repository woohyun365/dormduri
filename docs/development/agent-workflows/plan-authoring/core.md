# Plan authoring core

모든 architecture·feature·refactor 계획에 적용하는 공통 계약입니다. Domain semantics는 primary owner guide에
남기고 여기로 복사하지 않습니다.

## 1. Entry and authority

- 현재 요청이 `plan` 또는 명시적인 planning 결과를 요구하는지 먼저 확인합니다.
- Analyze 요청은 read-only 결과로 끝내며 plan file을 자동 생성하지 않습니다.
- Plan은 `produce-plan`만 승인하며 product code mutation을 승인하지 않습니다.
- 모호함과 외부 결정은 [Ambiguity and authority](../request-intake/ambiguity-and-authority.md)를 따릅니다.

## 2. Source of truth and freshness

다음 순서를 유지합니다.

1. current request와 same-thread 최신 evidence
2. current code, public contract, tests, tracked policy·architecture·runbook
3. current lockfile·generated schema·migration·runtime configuration
4. active branch, HEAD, working tree와 관련 issue/plan
5. historical document, local checkpoint, memory

package, framework, provider, 법·정책처럼 변할 수 있는 사실은 current version과 공식 primary source를 확인합니다.
외부 근거가 없으면 추측하지 않고 `gap`으로 남깁니다.

## 3. Baseline and ownership

계획 시작 시 다음을 bounded baseline으로 기록합니다.

- objective와 non-goals
- branch, HEAD, changed/staged/untracked files
- protected user-owned files와 write owner
- current production owner, caller, public contract, persistence/runtime boundary
- 관련 policy, architecture, tests, issues, package/version
- 이미 구현된 범위와 실제 gap

과거 plan의 checkbox나 설명을 current implementation authority로 사용하지 않습니다. Generated file과 migration은
canonical owner/generator를 확인합니다.

## 4. Evidence labels

- `fact`: current repository 또는 dated official source로 직접 확인
- `inference`: fact에서 도출한 적용 판단
- `gap`: 접근할 수 없거나 owner decision이 없는 정보
- `confidence`: low | medium | high; source 개수가 아니라 직접성·freshness 기준

외부 source는 repo version과 적용 범위를 함께 기록합니다. Benchmark는 선택 근거이지 제품 요구사항이 아닙니다.

## 5. Decision, OQ, and future evidence

### Decision

```text
Decision ID / status
decision
source-backed facts
repository inference
rejected alternatives and reason
impact: contract, data, UX, security, operations, tests
revisit trigger
```

현재 evidence로 결정 가능한 것은 OQ로 미루지 않습니다.

### Open Question

```text
question and impact
why current evidence cannot decide
owner
blocking or non-blocking
recommended default
disposition and required evidence
```

provider account, region, production hostname, actual budget처럼 미래 release 시점에만 결정 가능한 값은
`release-evidence-handoff`로 보내고 release `NO-GO` 조건과 evidence owner를 명시합니다.

## 6. Required plan structure

1. Plan ID, status, predecessor/successor
2. objective, success criteria, non-goals
3. source inventory and freshness
4. baseline: branch, HEAD, working tree, implementation state
5. facts, inferences, gaps
6. current owner map and problem/root cause
7. Decisions and rejected alternatives
8. target responsibility and architecture
9. scope and non-scope
10. dependencies and ordering
11. implementation phases
12. verification matrix
13. final acceptance
14. risks and mitigations
15. follow-up candidates
16. Open Questions and release-evidence handoffs
17. phase checkpoint and next-session handoff

빈 heading을 채우기 위해 내용을 발명하지 않습니다. 적용되지 않는 항목은 이유와 함께 생략합니다.

## 7. Phase contract

각 Phase는 다른 fresh session이 해당 Phase만 실행해도 범위와 stop condition을 이해할 수 있어야 합니다.

```text
Phase N — outcome-oriented title
objective
preconditions and dependency
owned files / non-owned files
implementation work
contract, policy, data or runtime work
tests and evidence
acceptance
excluded work
rollback or forward-fix
checkpoint fields
```

- dependency가 있는 단계를 병렬로 위장하지 않습니다.
- behavior가 보호되지 않은 cleanup/refactor는 regression test를 먼저 둡니다.
- Phase 0은 필요할 때 policy/contract/red guard/baseline을 고정합니다.
- 웹 조사, metric 축적 대기, account 생성 대기는 implementation Phase로 만들지 않습니다.
- 완료는 phase label이 아니라 observable outcome과 fresh verification으로 판정합니다.

## 8. Verification matrix

각 claim을 가장 작은 증거와 연결합니다.

| Claim                                     | Required evidence                                   |
| ----------------------------------------- | --------------------------------------------------- |
| behavior preserved or changed as intended | targeted unit/integration regression                |
| public contract aligned                   | shared schema + producer/consumer tests             |
| boundary improved                         | architecture/import/caller evidence                 |
| runtime or migration safe                 | fresh baseline + rehearsal/migration evidence       |
| user journey works                        | component/Storybook/E2E as applicable               |
| release ready                             | target-specific evidence, not local rehearsal alone |

Targeted test를 먼저 실행하고 영향 범위에 따라 lint, typecheck, build, static analysis, E2E를 확장합니다.

## 9. AI-readable architecture without AI-specific layers

계획은 다음을 선호합니다.

- bounded owner와 canonical naming
- owner-local invariant와 transaction boundary
- narrow public contract와 explicit error semantics
- current caller와 persistence/runtime path
- mechanically enforced architecture and regression tests
- 작고 review 가능한 phase와 single write owner

다음은 피합니다.

- agent가 읽기 쉽다는 이유로 domain invariant를 중앙 god file로 이동
- 모든 동작을 Strategy/Factory/class hierarchy로 추상화
- 호출부 없는 미래 확장 layer
- 여러 child가 같은 파일이나 global plan을 소유
- 긴 transcript와 raw prompt를 durable context로 저장

## 10. Checkpoint and final report

Checkpoint는 objective, branch/HEAD, changed/staged files, verification, next action, blocker만 유지합니다. 최종 보고는
Added/Updated/Deleted, 책임 변화, 실제 검증 결과, 남은 risk·gap 순서로 작성합니다.
