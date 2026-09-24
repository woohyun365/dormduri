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

### Primary 작업과 증거 재사용

Parent는 unresolved question·범위·acceptance를 정할 만큼 triage한 뒤 **primary analysis owner**를 하나 선택합니다.
이미 직접 끝낸 분석을 같은 목적의 child에게 다시 풀게 하지 않습니다. 근거가 최신이면 결과를 재사용하고, 작은 lookup이나
단일 dependency chain은 child 0으로 끝냅니다. Child를 쓰는 경우 기존 결과 계약에 근거 위치·실제 command/exit/result·
대안·불확실성을 받아 [criterion별 QA](./qa.md#portable-qa-packet)로 통합합니다. 긴 설명이나 completed 상태는 완료 증거가 아닙니다.

원문 확인, source 변경, 모순 해소, 실패 재현, 필요한 **독립 QA**는 불필요한 중복이 아닙니다. 재조회·재검증의 이유와 관련
snapshot만 task-local evidence에 짧게 남기며 비용 때문에 생략하지 않습니다. Primary 중복 여부와 의미상 누락은 사람이 읽는
작업 계약/독립 QA로 판단합니다. Fixture 문자열 검사나 새 점수 엔진이 agent의 실제 준수를 보장한다고 표현하지 않습니다.

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
결과를 회수하고 capability별 분기로 explicit-close·검증된 no-close·unknown을 구별합니다. 필요한 지원 close만 수행하며
작업 결과·정리 의무·자원 반환을 각각 기록합니다. child cap 6 유지, 미확인 관측·보존 사유 및 bounded recovery는 해당 문서가
소유합니다. 완료와 종료를 같은 상태로 취급하지 않으며, missing close만으로 runtime 결함이나 모든 dispatch 실패를 단정하지 않습니다.
후속 배정 전에도 같은 owner의 [capability·continuation 기준](./subagent-lifecycle.md#후속-작업과-fan-in)을 적용합니다.
관련 lane 재사용, 메시지 전달/turn 시작, fan-in 결과 식별은 actual schema와 기존 독립 QA 경계 안에서 선택합니다.
여러 root를 보는 `/agents`는 [선택적 operator 절차](../troubleshooting/tooling/agent-thread-limit-reached.md#선택적-agents-운영과-정상-exitresume)이지 single-root 작업의 필수 인프라가 아닙니다.

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

Reasoning routing은 Parent와 child를 분리합니다. Parent effort는 사용자가 session에서 선택하며 repository는 Parent
effort를 계산하거나 변경했다고 보고하지 않습니다.

1. Pass 1은 intent, authority, impact risk, candidate shape만 정합니다.
2. Direct/deterministic work 또는 Medium child보다 직접 수행이 저렴한 work는 child-free로 유지합니다.
3. Pass 2는 current ContextPack의 source/fact/predicate evidence를 정규화하고 child role과 effort를 판정합니다.
4. 모든 boundedness predicate가 positive evidence로 확인되면 Medium, mandatory state/trust/concurrency/migration signal 또는
   structural deep composite가 확인되면 XHigh, 그 외 substantial work는 High입니다.

Repository-selected child의 기본값은 GPT-6 Astra이며 effort는 `medium | high | xhigh`를 유지합니다. Keyword, path, file count, LOC, broad verification
하나만으로 effort를 올리지 않으며 같은 fact를 여러 composite category로 중복 계산하지 않습니다. Semantic role mapping은
`knu_explorer | knu_researcher | knu_executor | knu_reviewer`를 사용하지만 role 이름 자체는 live runtime 지원 증거가
아닙니다. Fresh active-surface evidence가 없으면 runtime descriptor는 support unknown/applied false이고 실제 dispatch 전에
leader가 compatibility를 다시 확인합니다. Low와 `max/ultra`는 일반 repository child route에 사용하지 않습니다. Bound recovery invocation은 아래 별도 계약을 따릅니다. Role routing을
증명하지 못하면 역할을 prompt label로 가장하지 않고 single/sequential fallback을 사용합니다.

Runtime compatibility는 repository config나 설치 파일 존재 여부가 아니라 현재 surface가 leader에게 보고한 bounded
evidence로 판정합니다. Native surface는 current-turn host tool schema, OMX surface는 current-session runtime overlay와
host-exposed `agent_type` roster가 함께 필요합니다. 이 evidence는 leader-reported input이며 host-authenticated authority로
표현하지 않습니다. 선택 role마다 availability, 추천과 일치하는 model/effort 해석, explicit-effort support와
dispatch permission이 일치해야 합니다. Advisory descriptor가 만들어져도 `requiresLeaderRuntimeConfirmation=true`이므로
leader는 실제 child dispatch 직전에 live surface를 다시 읽고 불일치하면 sequential fallback으로 전환합니다.
첫 실행은 configuration resolution을 사용하며 실행 전 값을 effective telemetry라고 쓰지 않습니다. 실행 후 관측은 별도 검사합니다.

### Parent-high 운영과 quality stop

Owner가 **Parent Astra high**를 선택하는 운영 형태에서도 작은 작업은 직접 처리합니다. 분리 가능한 깊은 미해결 문제만
기존 semantic evidence와 active schema 확인을 거쳐 **Astra xhigh child**에 배정합니다. 전체 문제 정의·범위·cross-owner
통합이 어려우면 Parent xhigh를 권고하며, 높은 child effort가 Parent의 통합 판단을 대신하지는 않습니다.

- 적용은 관련 구현·검증·운영 handoff가 완료된 뒤 실제 host의 session control에서 선택합니다. 이 지침 추가, 설정 파일 값,
  child descriptor만으로 현재 Parent high 적용을 주장하지 않습니다. Parent/global/reviewer 설정을 자동 변경하지 않습니다.
- 첫 실제 업무에서 required tests와 [독립 QA trigger](./qa.md#independent-review-disposition)를 유지하고 acceptance 누락·
  scope 위반·substantive finding·수정/복구 원인을 기록합니다. 작은 작업마다 새 QA child를 만들지는 않습니다.
- 보안/권한/범위/데이터 invariant 위반 또는 잘못된 완료 주장이 확인되면 해당 작업의 무인 계속을 멈추고 원인·영향을 확인합니다.
  **원인을 먼저 구분한 뒤 effort를 판단**합니다. Source/환경/권한/테스트 공백부터 바로잡고, Parent의 framing·통합 추론 부족이
  의심되거나 같은 누락이 재발하면 Parent xhigh 재검토를 권고합니다. 격리 가능한 기술 문제만이면 bounded xhigh child를 씁니다.
- 상향은 원인 입증이나 품질 회복 보장이 아닙니다. 입력 부족·권한 거절·필수 독립 검증 부재를 effort로 우회하지 않습니다.
  기존 retry ceiling·QA gap 처리를 유지하고 해결 불가능하면 근거를 보존해 handoff합니다.

Ordinary Astra도 공급된 context 불일치를 dispatch consumer가 거절합니다. Supported native scoped/explicit 호출의 정확한
인자와 legacy/reuse 경계는 [context delivery](./request-intake/delegation.md#context-delivery)가 소유합니다. 이 경계의 회귀
검사와 실제 Parent-high 품질/사용량 관측은 별개이며, 검증되지 않은 동등 성능·weekly 절감 수치를 보고하지 않습니다.

### Quality-gated model advice

Role/effort를 먼저 판정한 뒤 선택 입력 `modelRequest`가 있을 때만 finite model 후보를 추천합니다. 입력이 없으면 기존
Astra-only compatibility와 출력이 유지됩니다. 결정적인 grep/check/list는 child 없이 도구로 처리합니다.

| Task profile      | 후보 model / invocation effort | 범위                                                                                |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `bounded-build`   | `gpt-6-sol` / xhigh            | 구현·test, 단일 write owner, acceptance·regression·독립 Astra QA                    |
| `bounded-read`    | `gpt-6-sol` / xhigh            | lookup·analysis read-only, acceptance·독립 검사. Researcher는 pilot-only            |
| `bounded-extract` | `gpt-6-luna` / xhigh           | 낮은 영향도의 고정 repository 입력·output schema·단일 semantic extraction·독립 검사 |

- Astra: Parent, 최종 QA, architecture/auth/trust/transaction/migration/concurrency, 미해결 실패·위험/품질 gap.

현재 정적 후보는 완전한 Medium boundedness, high-confidence facts, 빈 gap/domain/composite signal, non-high impact를
모두 요구하는 **보수적인 첫 cohort**입니다. Medium이라는 이유만으로 모델을 내리지 않습니다. Task/cohort/검증 fact와
write/context/runtime/admission gate도 통과해야 하며 broader High cohort는 추가 품질 근거 전까지 Astra입니다.
Luna도 semantic complete Medium을 요구하되 세 profile의 invocation effort는 xhigh입니다. Semantic 위험도와 모델별 호출 effort는 별도 축입니다. 일반 Low effort·Parent 모델 변경·일반 role을 이용한 project pin 우회는 포함하지 않습니다.

Parent는 선택 근거를 짧은 sanitized evidence reference로 남깁니다. 결정적 도구로 충분한지, semantic 작업의
목표·acceptance·입력·context가 완전한지, dependency/owner/검증 경계가 유한한지, 직접 oracle·독립 검사가 있는지,
위험·가역성·쓰기 범위가 적합한지, 해당 profile/role의 승인·실패 이력이 유효한지를 확인합니다.
파일 수·LOC·keyword 점수로 선택하지 않으며 xhigh가 재작업을 줄였다는 주장은 matched evidence 없이 하지 않습니다.
Max worker/복구, Parent·운영 reviewer 변경은 허용하지 않습니다.
[실행 기록과 원인/복구 관측](./request-intake/orchestration-recovery.md#bounded-model-run-evidence)은 선택을 기록할 뿐
semantic eligibility나 admission을 완화하지 않습니다.

현재 채택 범위와 새 세션의 선택 순서는 [Routine task-model operation](#routine-task-model-operation)을 따릅니다.
추천은 `applied=false`입니다. [정확한 request/검증 fact 계약](./request-intake/delegation.md#model-recommendation)과
[pilot/adoption·runtime admission](./request-intake/orchestration-recovery.md#model-admission)을 따릅니다.
별도 허용된 최초 pilot은 adoption GO 전에도 비교할 수 있지만, pilot 허용/PASS는 운영 채택 GO가 아닙니다.
Parent는 일반 bounded task에서 이 표를 소비해 적합한 modelRequest를 채웁니다. 자동 keyword classifier나 scheduler는 없습니다.
기본값/최종 QA는 Astra입니다. 실행·읽기 역할은 model pin 없이 task 선택을 받지만, 실제 loaded role에 pin이 있으면
lower model 인자로 이를 우회하지 않습니다. 설정 파일과 native 지원은 아래처럼 별도로 확인합니다.
지원된 명시적 모델·effort/scoped fork와 source/config/권한을 확인한 descriptor만 실제 native 호출에 전달합니다.
Lower-model lane은 하나씩 실행합니다. 품질/지원 불일치는 pending writer를 회수한 뒤 Astra로 최대 한 번 복귀하며,
quota/capacity/permission 거절을 모델 변경으로 우회하지 않습니다.

공식 단가의 비용 우위는 task-aware 선택의 근거입니다. 호출별 usage/weekly 측정 부재는 품질 GO/운영 채택의 차단 조건이
아니지만, 총 task 비용·weekly 절약을 측정했다고 주장할 수는 없습니다. 정적 테스트 성공도 실제 모델 사용의 증거가 아닙니다.

### Bound Astra recovery invocation

실행된 candidate의 적격 실패에는 같은 역할·쓰기 owner·도구 범위를 보존한 별도 recovery selection을 사용합니다.
`astra-bounded-recovery`는 원인과 남은 acceptance가 좁고 context·oracle가 충분한 non-high-risk 작업의 **Low invocation**이며,
ordinary modelRequest나 semantic Medium 판정을 바꾸지 않습니다. Unknown/deep/high-risk는 기존 semantic effort를 따른
`astra-standard-recovery` 또는 handoff, QA·identity·permission/quota/cap 문제는 이 경로로 우회하지 않습니다.
Pending writer 회수 후 정확한 첫 실패·현재 rescue source/config/scope·승인·예산·시간에 bind한 alternate 한 번만 가능합니다.
한 번의 Low 실패 뒤 더 높은 effort로 추가 호출하지 않습니다. 이 정적 경로의 지원은 실제 rescue 품질/운영 채택 증거가 아닙니다.
현재 routine Low 채택은 [검증된 executor cohort](./agentic-architecture-decisions.md#routine-model-adoption)에 한정합니다.
Explorer/researcher 등 미채택 역할에 helper가 Low를 추천해도 실행 GO가 아니며, Parent direct/검증된 Astra 경로 또는
새 evidence handoff를 사용합니다. Standard recovery를 강제하려고 cause·semantic effort를 조작하지 않습니다.
[Recovery selection과 admission 계약](./request-intake/orchestration-recovery.md#bound-recovery-selection-and-admission)을 따릅니다.

### Central profile migration boundary

`scripts/agents/model-profiles.mjs`가 finite task profile의 model/effort/허용 role·task·도구·검증 키를 소유합니다.
Parent는 profileId를 고르고 현재 binding을 request → contract → admission → config resolution → execution report →
recovery에 연결합니다. Raw model/구형 GPT-5.6 request는 거절하며 모델별 TOML clone이나 provider adapter/scheduler를 만들지 않습니다.

미래 세대 변경은 해당 중앙 데이터와 가까운 회귀 테스트를 바꾸고 `policyRevision`을 갱신합니다. Eligibility 코드 변경도 revision을
갱신해야 합니다. Profile 전체 hash가 변경되면 source/config가 같아도 기존 승인·사후 보고·recovery binding을 재사용하지 못합니다.
설치된 registry와 정확히 비교하므로 synthetic hash나 scope digest 재계산만으로 새 모델을 허용할 수 없습니다.
현재 host/loaded role 확인 → 필요한 새 pilot·품질 GO/범위 승인 순서는 그대로입니다. 실패 시 Astra-only 또는 마지막 승인된 GPT-6
profile을 current source/config에 다시 승인해 복귀하며 retired GPT-5.6을 자동 복구하지 않습니다. Hash는 native 실행·권한 인증이 아닙니다.

세대교체·철회는 다음 순서로 재현합니다.

1. 변경 profile의 신규 dispatch를 중단하고 current registry/binding·source/config·채택 결정·미완료 writer를 확인합니다.
2. 선택된 실제 모델의 exact ID/effort/지원·품질 근거를 확인한 뒤 **중앙 profile data + 새 policyRevision**으로 변경합니다.
   Eligibility를 바꾸면 그 알고리즘도 owner이며 revision이 필요합니다. 역할별 TOML 복제나 `latest` alias로 넘기지 않습니다.
3. 기존 static/integration 회귀로 새 binding, stale grant/resolution/post/recovery 거절을 검증합니다. 검증되지 않은 미래 ID를
   실제 registry에 등록하지 않습니다. 새 모델 canary는 별도 bounded 권한·환경·독립 QA 후 채택합니다.
4. 새 채택 결정과 이번 task의 새 source/config/scope/time/budget admission을 만들고 live host를 다시 확인합니다.
   테스트의 synthetic revision은 데이터 seam 검사이지 새 모델 실행·품질 증거가 아닙니다.
5. **Data rollback도 새 revision**으로 게시하고 새 승인으로 연결합니다. 현재 validator가 installed data와 비교하는 것이지,
   과거 code와 grant를 함께 복원하는 운영자를 막는 monotonic history store는 아닙니다. Git revert만으로 옛 grant·5.6을
   되살리지 않습니다. 급한 중단은 registry/config를 바꾸기보다 아래 Astra-only 철회를 우선합니다.

Reproduction: `scripts/ci/model-profiles.test.mjs`의 revision/rollback fingerprint 검사와
`scripts/ci/orchestration-policy.test.mjs`의 routine withdrawal→fresh re-admission·stale binding 회귀. 실제 설정 변경 없이
fixture로 config drift/pin 복원에 대한 차단을 검증합니다. Parent/default/reviewer generation은 별도 설정·권한 결정입니다.

### Task model configuration and fresh loading

| 설정 owner                       | 계약                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `.codex/config.toml`             | child 기본 Astra/high, 상한6. Parent 모델·provider·전역 설정은 소유하지 않음 |
| `knu_executor`                   | model/effort pin 없음, 기존 workspace-write 및 단일 write owner 유지         |
| `knu_explorer`, `knu_researcher` | model/effort pin 없음, 기존 read-only 및 각 조사 책임 유지                   |
| `knu_reviewer`                   | Astra model pin, read-only, effort는 기존 evidence 판정 유지                 |

Custom agent TOML의 model/effort는 해당 필드의 explicit spawn → agents default → Parent 상속보다 우선합니다.
따라서 pin 제거는 **명시적 모델 선택을 받을 수 있는 설정**이지 기본값을 Sol로 바꾸는 조치가 아닙니다. Parent는 허용된
cohort에서 model과 reasoning_effort를 함께 명시하며, 미분류/무요청 경로는 Astra 기본값을 유지합니다.
[공식 subagent 설정](https://learn.chatgpt.com/docs/agent-configuration/subagents)

설정 변경 후 실제 dispatch 전 Parent가 수행할 확인:

1. 현재 branch/HEAD/working tree와 프로젝트 config·네 role 파일의 digest를 기록하고 예상 변경만 있는지 확인합니다.
   이름·sandbox·instructions·기본값·reviewer pin·상한은 별도로 대조합니다.
2. 실제 host의 fresh native role/schema, explicit model/effort/scoped fork 지원과 loaded 설정의 출처를 확인합니다.
   역할 설명에 model 고정 문구가 없는 것과 특정 TOML bytes가 실제 로드된 것은 같은 증거가 아닙니다.
   파일만 읽고 `configurationResolution`을 만들거나 actual model을 관측했다고 쓰지 않습니다.
3. 현재 host에서 지원되는 refresh/loaded-config 확인 수단이 있으면 사용합니다. 없다면 정확한 config SHA·검증·현재 schema·
   남은 gap을 handoff하고 정상적인 새 repository process/conversation에서 다시 확인합니다. 공식 문서에 custom-agent hot
   reload 보장이 없다는 사실은 모든 host에서 restart가 필수라는 뜻도 아닙니다. MCP reload를 role reload로 대체하지 않습니다.
4. `codex resume`은 이전 대화를 재개하면서 override를 받을 수 있지만 custom-role 재발견을 증명하지 않습니다. 새 conversation이
   필요한 경우 [정상 exit/resume와 소유 경계](../troubleshooting/tooling/agent-thread-limit-reached.md#선택적-agents-운영과-정상-exitresume)를
   따릅니다. Parent가 현재 root를 임의 종료하거나 `/agents` 서버·별도 유료 CLI trial을 시작하지 않습니다.
5. 새 session에서도 actual native schema/설정 출처가 맞지 않으면 해당 모델 dispatch를 보류하고 Astra로 유지합니다.
   generic role·새 alias·전역 pin 변경으로 우회하지 않습니다. 지원 계약 확인과 실제 모델별 실행·독립 품질 검증은 별도 gate입니다.

[공식 설정 precedence](https://learn.chatgpt.com/docs/config-file/config-basic),
[CLI launch/resume](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
Fresh-load handoff는 source/config/현재 host 근거를 넘기는 절차이며 기존 child의 결과 회수·pending·residency를 대신하지 않습니다.
상세 자원 처리는 [Subagent lifecycle](./subagent-lifecycle.md)을 따릅니다.

Rollback은 이 역할 설정 변경의 corrective revert와 연결된 tests/docs 복원으로 한정합니다. 이전 source 구현이나 다른 owner
변경을 reset하지 않습니다. 이미 시작한 child는 설정 원복으로 종료/재설정됐다고 가정하지 않고 별도 lifecycle을 확인합니다.

## Routine task-model operation

[채택 결정과 한정된 실제 관측](./agentic-architecture-decisions.md#routine-model-adoption)의 **cohort GO**는
**개별 task 호출 승인**과 다릅니다. 승인된 일반 업무에서 Parent가 적격 profile을 선택하므로 매번 사용자에게 모델명을
다시 묻지 않습니다. 그러나 현재 작업 범위·runtime·예산·독립 QA를 생략하거나 과거 pilot grant를 재사용하지 않습니다.
운영 procedure는 model-mediated이며 script/schema만으로 task의 실제 의미나 권한을 인증하지 않습니다.

새 세션/일반 task의 cold-start 순서:

1. **현재 작업부터**: request → AGENTS → 이 owner와 현재 source/test. Branch/HEAD/diff·변경 owner·acceptance를 확인합니다.
   작은 deterministic 작업·단일 chain은 child0입니다. 분리 가능한 미해결 질문 하나에 primary owner를 배정하고
   [불필요한 중복과 독립 QA](#primary-작업과-증거-재사용)를 구별합니다.
2. **Task→profile**: current Pass 2 사실에서 complete Medium·non-high impact·빈 gap과 실제 oracle/검증 계획을 확인합니다.
   구현/test는 bounded-build, 유한 repo 분석은 bounded-read, 고정 입력의 low-impact 단일 추출은 bounded-extract입니다.
   Risk/owner/의미상 복잡도가 다르거나 미채택 role이면 Astra입니다. Semantic Medium과 후보 invocation xhigh는 별개입니다.
3. **완전한 packet**: [request/context 계약](./request-intake/delegation.md#model-recommendation)의 `purpose=routine`, 현재
   profileBinding, scope/도구/쓰기 owner·사실/실패·acceptance·stop/return을 작성합니다. 최초 QA는 fresh source-first context입니다.
   Full history를 복사하지 않되 필요한 실패·제약을 생략하지 않습니다. Candidate의 미해결 실패는 새 lower-model task로 숨기지 않습니다.
4. **이번 호출의 admission**: [modelUseByLane](./request-intake/orchestration-recovery.md#model-admission)에 이 cohort 결정과
   현재 사용자 업무 권한을 함께 reference합니다. 현재 source/config/scope digests, bounded 시간 창과 남은 child/time budget,
   checks·cleanup을 확인해 새 adoption/go packet을 만듭니다. 원래 권한이 부족하거나 범위를 늘리는 경우에만 해당 경계를
   협의합니다. 고정 과거 pilot 예산이나 영구 grant를 일반 업무 예산으로 쓰지 않습니다.
5. **Native 확인·실행**: current host schema·loaded role·모델/effort 지원·pin·permission·context를 재확인합니다.
   `createDispatchRecommendation()`의 supported spawnArguments를 실제 도구에 전달하되 완료 packet도 함께 전달합니다.
   Role 설명·파일 bytes·과거 PASS만으로 loaded/effective를 주장하지 않습니다. 후보는 동시1/단일 writer, cap6·host 한도 유지.
   지원/권한 불명은 Astra/direct 또는 handoff이지 generic role·새 root·서버로 우회할 이유가 아닙니다.
6. **결과·독립 QA**: 반환 child/task/source와 실제 oracle/회귀·독립 결과를 대조하고 `evaluateModelExecution()`과
   [criterion별 QA](./qa.md#portable-qa-packet)로 확인합니다. Parent/default/최종 QA는 Astra이며 reviewer effort는 근거로 선택합니다.
   `prepareLeaderSynthesis()`로 failed/blocked/conflicting evidence를 보존하고 근거 없는 completed/self-PASS를 수용하지 않습니다.
7. **실패·기록·cleanup**: [bound recovery](./request-intake/orchestration-recovery.md#bound-recovery-selection-and-admission)는
   원인·identity·writer 회수·현재 rescue 권한·adopted role을 확인한 alternate 한 번뿐입니다. Usage가 없으면 null로 남기고
   [run evidence](./request-intake/orchestration-recovery.md#bounded-model-run-evidence)에 controlled fault와 실제 miss를 구분합니다.
   실제 결과 회수·pending·지원되는 cleanup·release는 [lifecycle](./subagent-lifecycle.md)로 따로 판정합니다.

### Suspension and Astra-only rollback

- 품질/지원/scope 변화 시 해당 cohort의 신규 사용을 멈추고 [admission 철회](./request-intake/orchestration-recovery.md#routine-admission-lifetime)를
  기록합니다. Scope/권한·보안·허위 완료는 [quality stop](#parent-high-운영과-quality-stop)을 적용합니다.
- Pending writer의 결과·도구·변경을 먼저 회수합니다. 현재 source로 새 Astra ordinary contract를 판정하거나 Parent가 직접 처리합니다.
  Candidate의 model 필드만 Astra로 바꾸거나 scope를 늘려 재시도하지 않습니다. Quota/cap/permission 거절은 다른 모델로 우회하지 않습니다.
- 재채택은 문제 원인과 required checks·독립 QA, current profile/host/source/config를 다시 확인한 **새** bounded admission입니다.
  단순한 config 복원이 adoption GO를 복구하지 않습니다. 설정 rollback이 정말 필요하면 정확한 권한·diff로 수행하며 현재 child가
  자동 종료/재설정되었다고 가정하지 않습니다. 여기서는 TOML을 변경하는 자동 rollback command를 만들지 않습니다.

최종 whole-change QA/통합 증거와 **Parent-high** 시작은 별도 gate입니다. 이 routine cohort 결정은 Parent 설정을 바꾸지
않으며 [Parent-high 준비·품질 stop](#parent-high-운영과-quality-stop)을 대체하지 않습니다. 단가·cache는 선택의 입력일 뿐
Parent+child+QA+수정/복구 총 비용의 절감 실측이 아닙니다. Token/weekly 수집이 없어도 품질 판정은 가능하지만 절감 숫자는
만들지 않습니다. Portfolio/전체 통합 평가는 현재 운영 계약이나 이 작은 표본과 별도로 검증합니다.

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
