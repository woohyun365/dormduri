# Codex model profiles and task model configuration

[Codex adapter](./codex.md)의 reference입니다. 모델·profile을 고르거나 세대를 바꾸거나 역할 설정을 바꿀 때 읽습니다. 배정 표와
routine 위임 순서는 진입 문서의 [Reasoning effort routing](./codex.md#reasoning-effort-routing)과
[Routine task-model operation](./codex.md#routine-task-model-operation)이 소유합니다.

## Quality-gated model advice

Pass 2 계층을 먼저 판정한 뒤 선택 입력 `modelRequest`가 있을 때만 finite model 후보를 추천합니다. API 입력에 요청이 없거나
후보가 admission을 통과하지 못하면 [Astra 배정](./codex.md#reasoning-effort-routing)이 그대로입니다. `codex:delegate`는 요청을
생략한 lane을 아래 표의 맞는 행으로 채우고, `false`면 Astra를 고정합니다. 결정적인 grep/check/list는 child 없이 도구로 처리합니다.
후보는 자기 역할 변형을 가지며, 그 역할의 pin effort가 곧 호출 effort입니다.

| Candidate profile | model / 역할(effort)                                  | 계층·impact                      | 범위                                                                  | 운영    |
| ----------------- | ----------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- | ------- |
| `extract`         | `gpt-6-luna` / `knu_explorer_xhigh`(xhigh)            | Medium, low                      | 고정 repository 입력·output schema·단일 semantic extraction·독립 검사 | routine |
| `standard-read`   | `gpt-6.1-sol` / `knu_explorer`·`knu_researcher`(high) | Medium, low·medium               | lookup·analysis·research read-only, acceptance·독립 검사              | routine |
| `elevated-read`   | `gpt-6.1-sol` / `_xhigh` 읽기 역할(xhigh)             | High·XHigh 또는 impact high 읽기 | 위와 같음                                                             | routine |
| `standard-build`  | `gpt-6.1-sol` / `knu_executor`(high)                  | Medium, low·medium               | 구현·test, 단일 write owner, acceptance·regression·독립 Astra QA      | routine |
| `elevated-build`  | `gpt-6.1-sol` / `knu_executor_xhigh`(xhigh)           | High(non-deep), low·medium       | 위와 같음                                                             | routine |

- Astra: Parent, 최종 QA, 구현의 XHigh·impact high(`deep-build`), 미해결 실패·위험/품질 gap, admission 밖 Pass 2 결과.

모든 후보는 complete boundedness 조건(high-confidence facts, 빈 gap/domain/composite signal)을 요구합니다. Standard profile은
complete Medium 계층, elevated profile은 같은 조건의 High 계층입니다(읽기는 XHigh와 impact high 읽기도 포함). Task/cohort/검증 fact와 write/context gate도 통과해야 합니다.
6.1 Sol 후보는 Owner 채택(2026-10-06)으로 routine입니다. 별도 품질 canary 없이 채택했으므로 작업마다 oracle·독립 검사,
구현의 필수 Astra QA와 [hook 관측](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)(관측 model·effort의 완료 대조)이 품질을 지킵니다.
Pilot 요청도 그대로 받습니다. Semantic 계층과 후보 역할의
effort는 별도 축입니다. Low effort·Parent 모델 변경·일반 role을 이용한 project pin 우회는 포함하지 않습니다.

Parent는 선택 근거를 짧은 sanitized evidence reference로 남깁니다. 결정적 도구로 충분한지, semantic 작업의
목표·acceptance·입력·context가 완전한지, dependency/owner/검증 경계가 유한한지, 직접 oracle·독립 검사가 있는지,
위험·가역성·쓰기 범위가 적합한지, 해당 profile/role의 승인·실패 이력이 유효한지를 확인합니다.
파일 수·LOC·keyword 점수로 선택하지 않으며 xhigh가 재작업을 줄였다는 주장은 matched evidence 없이 하지 않습니다.
Max worker/복구, Parent·운영 reviewer 변경은 허용하지 않습니다.
[Hook 기록과 실패 원인·조치 기록](../request-intake/orchestration-recovery.md#bounded-model-run-evidence)은 실행을 관측할 뿐
semantic eligibility나 admission을 완화하지 않습니다.

현재 채택 범위와 새 세션의 선택 순서는 [Routine task-model operation](./codex.md#routine-task-model-operation)을 따릅니다.
추천은 `applied=false`입니다. [정확한 request/검증 fact 계약](./codex-delegation.md#model-recommendation)을 따르며 lane별
허가 packet은 없습니다. Pilot PASS는 운영 채택 GO가 아닙니다.
Parent는 일반 bounded task에서 이 표를 소비해 적합한 modelRequest를 채웁니다. `codex:delegate`는 요청을 생략한 lane에
Parent가 태그한 검증 fact와 Pass 2 결과로 맞는 행을 채웁니다(`defaultModelRequest()`). 자동 keyword classifier나 scheduler는 없습니다.
맞는 행이 없는 lane·`false` lane과 최종 QA는 Astra입니다. Reviewer를 포함한 모든 `knu_*` 역할은 model pin 없이 profile model을 명시적으로 받지만,
실제 loaded role에 pin이 있으면 lower model 인자로 이를 우회하지 않습니다. 설정 파일과 native 지원은 아래처럼 별도로 확인합니다.
Descriptor의 `spawnArguments`를 그대로 native 호출에 전달하고, 호출 시점의 (역할, model) 쌍·fork는 hook이 다시 검사합니다.
Lower-model lane도 일반 동시 한도를 따릅니다(같은 role의 다른 model lane 포함). 품질/지원 불일치는 pending writer를 회수한 뒤 [재시도 한 번](../request-intake/orchestration-recovery.md#recovery-ceiling) 또는 Parent 판단·handoff로 넘기며,
quota/capacity/permission 거절을 모델 변경으로 우회하지 않습니다.

공식 단가의 비용 우위는 task-aware 선택의 근거입니다. 호출별 usage/weekly 측정 부재는 품질 GO/운영 채택의 차단 조건이
아니지만, 총 task 비용·weekly 절약을 측정했다고 주장할 수는 없습니다. 정적 테스트 성공도 실제 모델 사용의 증거가 아닙니다.

## Central profile migration boundary

`scripts/agents/codex/model-profiles.mjs`가 finite task profile의 model·허용 role·계층·task·도구·검증 키와 역할별 effort 표
`ROLE_EFFORTS`를 소유합니다. Effort 값은 각 역할 파일이 pin하며 test가 두 값을 결속합니다.
Parent는 profileId를 고르고 현재 binding을 request → contract → dispatch `spawnArguments` → hook 완료 대조에 연결합니다. Repository가 요청하는 child model은 `ALLOWED_CHILD_MODELS`(`BASELINE_CHILD_MODEL`과 profile model)뿐이고,
역할별로는 `ALLOWED_ROLE_MODELS`(각 profile의 역할 × 그 profile model)의 쌍만 요청합니다. 승격 사다리의 다음 단(같은 역할,
다음 model)도 이 쌍 안에 있습니다.
Raw model request는 입력 형태 검사로 거절합니다. Profile의 허용 목록 밖
model은 이름과 무관하게 `Model is outside the allowed child model list.` 하나로 거절합니다. Host가 확인한
child model·effort는 [hook 기록](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)이 근거입니다. Codex가 직접 읽는 `.codex` 기본값은 test로
`BASELINE_CHILD_MODEL`에 결속하고, 역할 파일의 `model` 필드는 test가 금지합니다. Effort 변형 역할은 있지만 모델별 TOML clone이나
provider adapter/scheduler는 만들지 않습니다.

미래 세대 변경은 해당 중앙 데이터와 가까운 회귀 테스트를 바꾸고 `policyRevision`을 갱신합니다. Eligibility 코드 변경도 revision을
갱신해야 합니다. Profile 전체 hash가 변경되면 source/config가 같아도 기존 binding을 재사용하지 못합니다.
설치된 registry와 정확히 비교하므로 synthetic hash나 scope digest 재계산만으로 새 모델을 허용할 수 없습니다.
현재 host/loaded role 확인 → 필요한 새 pilot·품질 GO/범위 승인 순서는 그대로입니다. 실패 시 Astra-only 또는 마지막 승인된
profile을 current source/config에 다시 승인해 복귀하며 허용 목록에서 빠진 모델을 자동 복구하지 않습니다. Hash는 native 실행·권한 인증이 아닙니다.

세대교체·철회는 다음 순서로 재현합니다.

1. 변경 profile의 신규 dispatch를 중단하고 current registry/binding·source/config·채택 결정·미완료 writer를 확인합니다.
2. 선택된 실제 모델의 exact ID/effort/지원·품질 근거를 확인한 뒤 **중앙 profile data + 새 policyRevision**으로 변경합니다.
   Eligibility를 바꾸면 그 알고리즘도 owner이며 revision이 필요합니다. 역할별 TOML 복제나 `latest` alias로 넘기지 않습니다.
3. 기존 static/integration 회귀로 새 binding과 stale binding 거절을 검증합니다. 검증되지 않은 미래 ID를
   실제 registry에 등록하지 않습니다. 새 모델 canary는 별도 bounded 권한·환경·독립 QA 후 채택합니다.
4. 새 채택 결정을 기록하고 live host에서 hook 관측(실제 model·effort)을 다시 확인합니다.
   테스트의 synthetic revision은 데이터 seam 검사이지 새 모델 실행·품질 증거가 아닙니다.
5. **Data rollback도 새 revision**으로 게시하고 새 승인으로 연결합니다. 현재 validator가 installed data와 비교하는 것이지,
   과거 code와 binding을 함께 복원하는 운영자를 막는 monotonic history store는 아닙니다. Git revert만으로 옛 binding이나 허용 목록에서
   빠진 모델을 되살리지 않습니다. 급한 중단은 registry/config를 바꾸기보다 아래 Astra-only 철회를 우선합니다.

Reproduction: `scripts/ci/agents/codex/codex-model-profiles.test.mjs`의 revision/rollback fingerprint 검사,
`scripts/ci/agents/codex/codex-orchestration-policy.test.mjs`의 후보 없는 Astra 배정·stale binding 회귀, 역할 파일의 model
pin·effort drift를 거절하는 `scripts/ci/agents/codex/project-codex-config.test.mjs`. 실제 설정 변경 없이 fixture로 검증합니다.
Dispatch는 config 입력을 받지 않으므로 loaded config의 drift는 dispatch 회귀가 아니라 이 config test와 hook 관측이 맡습니다. Parent/default/reviewer generation은 별도 설정·권한 결정입니다.

## Task model configuration and fresh loading

| 설정 owner                                                     | 계약                                                                                                                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.codex/config.toml`                                           | child 기본 Astra/high, child 상한 6. Parent 모델·provider·전역 설정은 소유하지 않음                                                                                              |
| `knu_executor_medium`, `knu_executor`, `knu_executor_xhigh`    | effort pin medium·high·xhigh, model pin 없음, workspace-write와 단일 write owner                                                                                                 |
| `knu_explorer*`, `knu_researcher*`(각 `_medium`·기본·`_xhigh`) | effort pin medium·high·xhigh, model pin 없음, read-only와 각 조사 책임                                                                                                           |
| `knu_reviewer`                                                 | effort pin xhigh, model pin 없음(`review` profile Astra), read-only                                                                                                              |
| `.codex/hooks.json`, `.codex/hooks/knu-*`                      | spawn guard(등록 대조·봉인)·수락 child 후속 deny·subagent 완료 기록, 허용 model·역할 쌍·roster 정책 사본([hook](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)) |

Custom agent TOML의 model/effort는 해당 필드의 explicit spawn → agents default → Parent 상속보다 우선합니다.
그래서 effort는 역할 pin이 정하고, dispatch descriptor는 spawn의 `reasoning_effort`를 그 값으로 채웁니다. Model pin이
없는 역할은 **명시적 모델 선택을 받을 수 있는 설정**이지 기본값을 Sol로 바꾸는 조치가 아닙니다. Parent는 profile의 model을
명시하며, 미분류 경로·맞는 행이 없는 무요청 lane·`false` lane은 Astra 기본값을 유지합니다.
[공식 subagent 설정](https://learn.chatgpt.com/docs/agent-configuration/subagents)

설정 변경 후 실제 dispatch 전 Parent가 수행할 확인([공통 원칙](../agent-execution-contract.md#configuration-changes)의 Codex 절차):

1. 현재 branch/HEAD/working tree와 프로젝트 config·열 개 role 파일·hook 파일의 digest를 기록하고 예상 변경만 있는지 확인합니다.
   이름·sandbox·instructions·기본값·model pin 부재·상한은 별도로 대조합니다.
2. 실제 host의 fresh native role/schema, explicit model/effort/scoped fork 지원과 loaded 설정의 출처를 확인합니다.
   역할 설명에 model 고정 문구가 없는 것과 특정 TOML bytes가 실제 로드된 것은 같은 증거가 아닙니다.
   파일만 읽고 actual model을 관측했다고 쓰지 않습니다(실제 model·effort는 hook 기록이 근거).
3. 현재 host에서 지원되는 refresh/loaded-config 확인 수단이 있으면 사용합니다. 없다면 정확한 config SHA·검증·현재 schema·
   남은 gap을 handoff하고 정상적인 새 repository process/conversation에서 다시 확인합니다. 공식 문서에 custom-agent hot
   reload 보장이 없다는 사실은 모든 host에서 restart가 필수라는 뜻도 아닙니다. MCP reload를 role reload로 대체하지 않습니다.
4. `codex resume`은 이전 대화를 재개하면서 override를 받을 수 있지만 custom-role 재발견을 증명하지 않습니다. 새 conversation이
   필요한 경우 [정상 exit/resume와 소유 경계](../../troubleshooting/tooling/agent-thread-limit-reached.md#선택적-agents-운영과-정상-exitresume)를
   따릅니다. Parent가 현재 root를 임의 종료하거나 `/agents` 서버·별도 유료 CLI trial을 시작하지 않습니다.
5. 새 session에서도 actual native schema/설정 출처가 맞지 않으면 해당 모델 dispatch를 보류하고 Astra로 유지합니다.
   generic role·새 alias·전역 pin 변경으로 우회하지 않습니다. 지원 계약 확인과 실제 모델별 실행·독립 품질 검증은 별도 gate입니다.

[공식 설정 precedence](https://learn.chatgpt.com/docs/config-file/config-basic),
[CLI launch/resume](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
Fresh-load handoff는 source/config/현재 host 근거를 넘기는 절차이며 기존 child의 결과 회수·pending·residency를 대신하지 않습니다.
상세 자원 처리는 [Subagent lifecycle](../subagent-lifecycle.md)을 따릅니다.

Rollback은 이 역할 설정 변경의 corrective revert와 연결된 tests/docs 복원으로 한정합니다. 이전 source 구현이나 다른 owner
변경을 reset하지 않습니다. 이미 시작한 child는 설정 원복으로 종료/재설정됐다고 가정하지 않고 별도 lifecycle을 확인합니다.

## Suspension and Astra-only rollback

- 품질/지원/scope 변화 시 해당 cohort의 신규 사용을 멈추고 철회를 [현재 profile 결정](../agentic-architecture-decisions.md#task-model-effort-structure)에
  기록합니다. **철회는 Parent의 운영 책임**이며 불일치 source/config/role·실패한 checks는 그대로 남깁니다. Scope/권한·보안·허위 완료는 [quality stop](./codex.md#parent-high-운영과-quality-stop)을 적용합니다.
- Pending writer의 결과·도구·변경을 먼저 회수합니다. 현재 source로 새 Astra ordinary contract를 판정하거나 Parent가 직접 처리합니다.
  Candidate의 model 필드만 Astra로 바꾸거나 scope를 늘려 재시도하지 않습니다. Quota/cap/permission 거절은 다른 모델로 우회하지 않습니다.
- 재채택은 문제 원인과 required checks·독립 QA, current profile/host/source/config를 다시 확인한 **새** 채택 결정입니다.
  단순한 config 복원이 adoption GO를 복구하지 않습니다. 설정 rollback이 정말 필요하면 정확한 권한·diff로 수행하며 현재 child가
  자동 종료/재설정되었다고 가정하지 않습니다. 여기서는 TOML을 변경하는 자동 rollback command를 만들지 않습니다.
