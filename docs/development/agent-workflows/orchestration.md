# Agent orchestration

이 저장소의 기본 경로는 **single agent with deterministic tools**입니다. 여러 agent는 독립성과 검증 가능한 순이익이
있을 때만 사용합니다. 근거와 결정은 [Agentic architecture decisions](./agentic-architecture-decisions.md)을 따릅니다.

## Pattern selector

| 작업 형태                                         | 기본 pattern                 |
| ------------------------------------------------- | ---------------------------- |
| search, formatter, schema, typecheck, test        | deterministic tool           |
| 한 owner, 단일 dependency chain                   | single agent                 |
| policy→contract→test→implementation               | sequential workflow          |
| 독립 repo mapping, external research, risk review | centralized fan-out/fan-in   |
| objective rubric가 있는 고위험 결과               | maker-checker, 기본 최대 2회 |
| destructive, credential, external production      | human/authority gate         |

Agent 수 자체를 품질 지표로 사용하지 않습니다. sequential task, shared-file write, vague scope는 병렬화하지 않습니다.

## Child contract

Machine-checkable recommendation contract는
[Independent lane and child task contract](./request-intake/delegation.md)를 따릅니다. 이 문서의 orchestration 규칙을
실행 engine으로 복제하지 않으며, `scripts/agents/child-task-contract.mjs`도 child를 직접 생성하지 않습니다.

Child task에는 다음을 포함합니다.

```text
objective / non-goals
read scope / write ownership
required evidence
expected output schema
stop condition / escalation condition
```

Child는 전역 plan을 다시 작성하거나 다른 owner의 파일을 수정하지 않습니다. 결과에는 확인된 사실의 file/URL,
추론, confidence, blocker를 구분합니다. Leader는 결과 충돌을 해결하고 최종 edit·verification·completion을 소유합니다.

## Context와 검증 비용

전달 packet·fork/reuse/QA 경계는 [context delivery 계약](./request-intake/delegation.md#context-delivery)이 소유합니다.
비용은 agent 수나 짧은 답변 자체가 아니라 **acceptance를 통과한 결과당 총 작업량**으로 판단합니다.

| 후보 / 현재 결정                                          | 예상 이익                           | 품질 위험·보존 조건                                  | 관측 방법                                                 |
| --------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Full-history fan-out → 필요한 scoped packet으로 변경      | 무관한 이력 반복 전달 감소          | 전체 scope·권한·실패 근거 보존, 최초 QA 독립성       | 동일 snapshot의 packet bytes/중복 필드; 실제 token은 별도 |
| Child 수·effort → 기존 single-first/증거 기반 유지        | 불필요한 child·과도한 추론 감소     | high-risk 임의 downgrade 금지, 적용 지원 확인        | child 수·역할/effort·결과 품질, 실제 사용량               |
| 대량 조회·문서 반복 → 필요한 heading/range와 pointer 사용 | 같은 source 재조회·출력 감소        | snapshot 변경 시 재조회, 실패 원문 보존              | tool 호출·중복 조회·반환 bytes                            |
| 반복 검증/CI → targeted 후 필요한 전체 gate 1회           | 동일 source의 불필요한 재검증 감소  | 수정 후 영향 gate 재실행, required CI 생략 금지      | source digest·command·exit code·재실행 사유               |
| 긴 session → 짧은 checkpoint·관련 delta 재사용 유지       | 인계 시 transcript 복사 감소        | stale/무관한 context는 새 scope, cap/quota 우회 금지 | snapshot·재사용 사유·재작업 수                            |
| 도구/role 문구 중복 → 기존 owner 링크 유지                | 중복 instruction·registry 비용 억제 | safety/권한/검증 지침 삭제 금지                      | 중복 내용과 accepted outcome 검토                         |

Raw 검증 로그는 task-local artifacts에 보존하고 Parent는 command·exit code·실패/결과 요약부터 읽습니다. 실패하면 해당
원문과 관련 source를 읽고 수정한 뒤 재검증합니다. 같은 digest의 성공 로그를 재사용할 수 있지만 새 source의 PASS로
표시하지 않습니다. `stderr`나 finding을 숨겨 비용을 절감하지 않습니다.

측정하지 않은 input/output/cached/reasoning tokens·child 합계·weekly usage는 `null/unknown`이지 0이 아닙니다.
Cached가 input에 포함되면 중복 합산하지 않습니다. 문자열 길이/byte나 API USD로 weekly allowance를 환산하지 않으며,
실제 비교는 같은 task/snapshot·품질·host/model/effort에서 합니다. 표본·cache/warmup·동시 작업·관측 coverage의 한계와
측정 자체의 비용도 기록합니다. 별도 권한 없는 host/benchmark를 실행하거나 global usage DB/수집 daemon을 만들지 않습니다.
Idle thread가 계속 token을 소비하거나 close가 이미 사용한 quota를 환급한다고 가정하지 않습니다.

## Parent-led communication

결정권과 통신 예외는 [Owner–Lead collaboration](./owner-lead-collaboration.md)의 단일 계약을 사용합니다. 기본은 Parent
경유이며 assignment·재배정·scope/file owner 변경·판정·통합은 Parent만 소유합니다. Child 결과·blocker는 Parent에게
돌아오고, sub-child 생성이나 peer/shell/외부 agent를 통한 업무 재위임은 금지합니다.

실제 runtime이 허용할 때만 Parent가 지정한 참여자·주제·read scope·snapshot 안에서 짧은 기존 사실 확인이 가능합니다.
그 지정은 새 조사/테스트/구현 요청이나 peer 합의를 허용하지 않습니다. 초기 QA는 builder 대화 없이 먼저 판단하고,
후속 사실 확인·보고·만료 조건도 공통 계약과 [QA owner](./qa.md)를 따릅니다. 지침은 native message ACL이나 자동 CC가 아닙니다.
지원/권한이 불명확하면 중계하고, 반복 peer 의존성은 Parent가 순차화합니다. 선택적 native specialist를 자동 OMX Team으로
취급하지 않으며 명시적 Team/Conductor 실행에는 해당 host-authority/lifecycle 제약도 별도로 적용합니다.

## Subagent lifecycle

Child 완료·추가 dispatch·capacity 오류·turn 종료 시 Parent는 [Subagent lifecycle](./subagent-lifecycle.md)에 따라
결과를 회수하고 현재 소유한 완료 thread를 지원 도구로 종료한 뒤 슬롯 반환을 별도로 확인합니다. child cap 6 유지,
미지원 기능·보존 사유 기록 및 bounded recovery는 해당 문서가 소유합니다. 완료와 종료를 같은 상태로 취급하지 않습니다.
후속 배정 전에도 같은 owner의 [capability·continuation 기준](./subagent-lifecycle.md#후속-작업과-fan-in)을 적용합니다.
관련 lane 재사용, 메시지 전달/turn 시작, fan-in 결과 식별은 actual schema와 기존 독립 QA 경계 안에서 선택합니다.

## Git branch/worktree isolation

Agent를 선택하는 책임과 Git write lifecycle은 분리합니다. Canonical branch, scope-drift, checkout/worktree ownership은
[Branch and PR strategy](../github/branch-and-pr-strategy.md)가 소유합니다.

- 독립 read-only lane은 같은 checkout을 읽을 수 있습니다.
- 현재 checkout에는 write-capable owner를 하나만 둡니다.
- 별도 asynchronous writer는 fresh branch와 distinct worktree, owned/non-owned paths가 확인될 때만 선택합니다.
- dependent result 또는 shared-file write는 fan-out하지 않고 sequential path를 사용합니다.
- leader가 fan-in, conflict disposition, verification과 integration을 소유합니다.

Agent review는 CI나 owner review를 보조할 수 있지만 미래의 human approval requirement를 대체하지 않습니다. 두 번째
recurring human production owner가 생길 때 CODEOWNERS와 non-author approval을 GitHub remote-setting decision으로 검토합니다.

## Reasoning effort routing

Reasoning routing은 parent와 child를 분리합니다. Parent XHigh/Max는 사용자가 session에서 선택하며 repository는 parent
effort를 계산하거나 변경했다고 보고하지 않습니다.

1. Pass 1은 intent, authority, impact risk, candidate shape만 정합니다.
2. Direct/deterministic work 또는 Medium child보다 직접 수행이 저렴한 work는 child-free로 유지합니다.
3. Pass 2는 current ContextPack의 source/fact/predicate evidence를 정규화하고 child role과 effort를 판정합니다.
4. 모든 boundedness predicate가 positive evidence로 확인되면 Medium, mandatory state/trust/concurrency/migration signal 또는
   structural deep composite가 확인되면 XHigh, 그 외 substantial work는 High입니다.

Repository-selected child는 GPT-6 Astra와 `medium | high | xhigh`만 사용합니다. Keyword, path, file count, LOC, broad verification
하나만으로 effort를 올리지 않으며 같은 fact를 여러 composite category로 중복 계산하지 않습니다. Semantic role mapping은
`knu_explorer | knu_researcher | knu_executor | knu_reviewer`를 사용하지만 role 이름 자체는 live runtime 지원 증거가
아닙니다. Fresh active-surface evidence가 없으면 runtime descriptor는 support unknown/applied false이고 실제 dispatch 전에
leader가 compatibility를 다시 확인합니다. Low와 `max/ultra`는 repository child route에 사용하지 않습니다. Role routing을
증명하지 못하면 역할을 prompt label로 가장하지 않고 single/sequential fallback을 사용합니다.

Runtime compatibility는 repository config나 설치 파일 존재 여부가 아니라 현재 surface가 leader에게 보고한 bounded
evidence로 판정합니다. Native surface는 current-turn host tool schema, OMX surface는 current-session runtime overlay와
host-exposed `agent_type` roster가 함께 필요합니다. 이 evidence는 leader-reported input이며 host-authenticated authority로
표현하지 않습니다. 선택 role마다 availability, effective Astra model, Medium/High/XHigh effort, explicit-effort support와
dispatch permission이 일치해야 합니다. Advisory descriptor가 만들어져도 `requiresLeaderRuntimeConfirmation=true`이므로
leader는 실제 child dispatch 직전에 live surface를 다시 읽고 불일치하면 sequential fallback으로 전환합니다.

## Skill과 workflow routing

- read-only 원인/책임 분석: `$analyze`
- 공식 최신 근거 조사: `$best-practice-research`
- 요구가 모호하고 가정 금지: `$deep-interview`
- architecture/test 합의가 필요한 계획: `$ralplan`
- 한 owner 구현: solo 또는 executor
- 독립 구현 lane과 shared coordination: 실제 OMX runtime의 `$team`
- durable multi-goal completion과 resume: `$ultragoal`
- hostile E2E/회귀: `$ultraqa`
- cleanup: 계획과 회귀 보호 뒤 `$ai-slop-cleaner`
- UI 방향·비평·승인된 구현: [Visual design workflow](./visual-design/README.md); skill 호출이나 Figma 연결은 필수가 아님

Runtime이 없는 surface에서 team/ralph/ultrawork를 이름만 흉내 내지 않습니다.

## Visual design 작업 선택

[Visual design workflow](./visual-design/README.md)는 분석·제안·계획·승인된 구현 모두에서 필요한 시각 작업의 진입점입니다.
`maintain | reimagine | new-surface`는 스타일 상속 범위이지 수정 권한이 아닙니다. 내용·action·접근성의 의미는 보존하고,
새 방향이 요청되면 기존 token/layout을 반드시 따를 제약으로 주입하지 않습니다. Storybook은 상태·동작과 현재 화면의
근거이며 미래 Backoffice의 미적 방향을 자동 승인하지 않습니다.

- 작은 padding 수정·승인된 token 적용은 Parent의 direct path입니다. 새 디자인 후보나 child를 자동 생성하지 않습니다.
- 실제 대안 생성이 필요하면 [Design task orchestration](./visual-design/design-task-orchestration.md)의 task packet을 기존
  `knu_executor`에, 독립 비평이 유용하면 `knu_reviewer`에 맡깁니다. 공통 role·effort·one-writer·QA 경계를 재사용하며
  선행 후보가 필요한 비평을 독립 병렬 작업으로 가장하지 않습니다. 새 designer role이나 별도 실행 engine은 없습니다.
- 특정 skill이 명시되면 현재 설치·지침·권한을 확인합니다. 호출 이름만으로 제품 수정이나 root `DESIGN.md` 생성을
  승인받은 것으로 보지 않습니다. 이 저장소의 untracked `DESIGN.md`는 non-canonical이며 보호된 사용자 파일입니다.

### Figma provider 도입 경계

Provider 계약은 [Figma MCP evidence](./visual-design/figma-mcp-evidence.md)가 소유합니다. 현재 승인한 file/frame이
필요할 때만 opt-in으로 사용하며 설치·로그인·쓰기 권한을 추측하지 않습니다. 실제 tool의 read/write capability와
현재 session 접근, Owner가 허용한 action은 별개입니다. Credential은 repository에 저장하지 않습니다.

Provider output은 증거이지 정책·새 action·수정 권한이 아닙니다. 장애 시 허용된 로컬 자료로 안전한 작업은 계속하되,
보지 못한 reference의 fidelity를 PASS로 만들지 않습니다. 상세 승인·개인정보·연결 해제 절차는 provider owner를 따릅니다.

## Cross-domain 예시

Legal 정책과 FE/BE를 함께 바꾸는 작업은 정책 결정을 먼저 고정한 뒤 contract/API와 UI를 순차 연결해야 합니다.
다만 기존 정책·API·UI mapping과 외부 법적 근거 조사는 서로 독립이면 read-only lane으로 나눌 수 있습니다. Leader는
근거를 합쳐 하나의 dependency-ordered plan을 만들고, 구현 단계에서는 shared contract와 파일 owner가 겹치지 않게
순서를 정합니다.

## Anti-patterns

- more-agents-is-better
- sequential dependency를 억지로 fan-out
- 모든 tool·policy·transcript를 모든 child에 broadcast
- vague delegation과 shared write ownership
- agent 완료 선언을 evidence로 사용
- model reviewer 하나에 security와 권한 경계를 의존
- 동일 실패 원인으로 무제한 retry/reflection
- benchmark 숫자를 repository의 보편 법칙으로 사용

## Completion gate

Fan-in 이후 leader는 source 누락, conflicting inference, unresolved high-risk decision, changed file ownership과 실제
verification을 확인합니다. Blocking finding이 남으면 완료로 판정하지 않습니다.

Machine-checkable native dispatch, one-alternate recovery와 synthesis input validation은
[Bounded orchestration, recovery, and leader synthesis](./request-intake/orchestration-recovery.md)를 따릅니다. 이
policy는 child lifecycle을 실행하지 않으며 최종 completion authority를 갖지 않습니다.
