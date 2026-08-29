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
11. branch and PR execution strategy
12. implementation phases
13. verification matrix
14. final acceptance
15. risks and mitigations
16. follow-up candidates
17. Open Questions and release-evidence handoffs
18. phase checkpoint and next-session handoff

빈 heading을 채우기 위해 내용을 발명하지 않습니다. 적용되지 않는 항목은 이유와 함께 생략합니다.

## 7. Implementation readiness promotion

계획이 상세하다는 사실과 바로 구현할 수 있다는 판정은 분리합니다. Canonical status lifecycle은 다음과 같습니다.

- `draft`: baseline, decision 또는 phase contract를 아직 작성하는 중
- `proposed`: 검토 가능한 계획이지만 implementation readiness evidence가 아직 불완전함
- `implementation-ready`: 아래 promotion gate를 current evidence로 통과함
- `blocked`: 구현 결과를 바꾸는 OQ, 권한 또는 외부 의존성이 해결되지 않음
- `completed`: 구현과 acceptance evidence가 모두 확인됨

`proposed`에서 `implementation-ready`로 승격하려면 다음을 모두 확인합니다.

1. current branch, HEAD, working tree와 protected user-owned path를 검사합니다.
2. tracked target은 `git check-ignore -v <path>`와 `git ls-files --error-unmatch <path>` 등으로 실제 tracking 상태를
   확인합니다. Ignored target을 tracked artifact로 만들 계획이라면 allowlist·이동·삭제 책임을 해당 Phase가 소유합니다.
3. `tracked-only` evidence와 로컬 도구·계정·설치 상태를 구분합니다. 구현에 필요한 local evidence를 확인할 수 없으면
   `local-runtime-gap`으로 기록하고 승격하지 않습니다. 로컬 evidence는 portable repository fact로 표현하지 않습니다.
4. tool-specific configuration은 higher-level runtime instruction, 명시적 호출 인자, project config, user config와
   default 사이의 실제 precedence를 확인합니다. 문서 설명만으로 live runtime precedence를 단정하지 않습니다.
5. 모든 enforcement claim에 다음 strength 중 하나와 실제 owner를 기록합니다.
   - `deterministic-static`: test, schema 또는 script가 같은 입력에 기계적으로 판정
   - `advisory-policy`: 문서 지침이며 runtime 강제가 아님
   - `model-mediated`: agent가 evidence를 바탕으로 판단
   - `native-runtime`: Codex·OMX·provider가 실행 시 강제
6. proposed 계획의 미실행 acceptance는 unchecked `required`로 유지합니다. Evidence가 없는 항목을 passed 또는 완료
   checkbox로 표현하지 않습니다.
7. tracked source를 수정하는 단계는 complete Phase contract를 가지거나 같은 계획의 explicit shared owner table을
   참조해야 합니다.
8. 구현 결과를 바꾸는 blocking OQ가 없고, 비차단 gap은 owner·필요 evidence·revisit trigger를 가집니다.

계획이 커질 때 invariant는 durable owner에 once 기록하고 plan에서는 link합니다. 같은 결정·행렬을 여러 Phase에
복사하지 않으며, current code와 drift가 발견되면 구현 전에 baseline과 영향받는 Phase만 갱신합니다.

### Normalized readiness evidence

[Readiness policy](../../../../scripts/agents/plan-readiness-policy.mjs)는 Markdown 계획을 직접 파싱하거나 구현을 실행하지
않는 read-only advisory validator입니다. Reviewer는 계획과 repository evidence를 다음 입력으로 명시적으로 매핑합니다.

| Plan evidence                         | Normalized input            |
| ------------------------------------- | --------------------------- |
| status와 evidence 범위                | `status`, `evidenceSurface` |
| branch, HEAD, working tree, local gap | `baseline`                  |
| tracked/local-only target             | `targetPaths`               |
| concurrency와 precedence              | `configuration`             |
| enforcement strength와 owner          | `enforcementClaims`         |
| mutating Phase contract               | `phases`                    |
| required/passed acceptance evidence   | `acceptance`                |
| blocking OQ와 handoff                 | `openQuestions`             |

Validator가 green이어도 입력 자체가 Markdown과 current repository를 정확히 반영했는지는 별도 reviewer가 확인합니다.
Normalized JSON은 durable duplicate plan이 아니라 bounded test fixture 또는 review input이며, validator 결과만으로 mutation
authority가 생기지 않습니다.

## 8. Branch and PR execution strategy

구현 가능한 계획은 [Branch and PR strategy](../../github/branch-and-pr-strategy.md)에 따라 다음을 명시합니다.

- current baseline과 fresh integration branch
- 구현 시작 전에 생성할 bounded branch 또는 naming rule
- PR target과 dependent merge order
- 서로 독립적으로 review·검증·rollback 가능한 PR unit
- direct `dev`·`main` mutation 금지와 existing working-tree 보호
- provider·credential·production처럼 branch 밖에서 승인할 external gate

Plan 작성 자체는 implementation 권한이 아니므로 branch 생성을 강제하지 않습니다. 구현이 시작될 때 branch preflight를
실행합니다. 여러 단계의 계획을 하나의 long-lived branch에 누적하지 않고 dependent unit은 선행 PR merge 후 fresh
integration branch에서 시작합니다.

## 9. Phase contract

각 Phase는 다른 fresh session이 해당 Phase만 실행해도 범위와 stop condition을 이해할 수 있어야 합니다.

```text
Phase N — outcome-oriented title
objective
preconditions and dependency
branch / PR target / dependent merge condition
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

## 10. Verification matrix

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

## 11. AI-readable architecture without AI-specific layers

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

## 12. Checkpoint and final report

Checkpoint는 objective, branch/HEAD, changed/staged files, verification, next action, blocker만 유지합니다. 최종 보고는
Added/Updated/Deleted, 책임 변화, 실제 검증 결과, 남은 risk·gap 순서로 작성합니다.
