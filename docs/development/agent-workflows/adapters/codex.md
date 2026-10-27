# Codex and OMX execution adapter

이 문서는 공통 [orchestration](../orchestration.md)·[execution](../agent-execution-contract.md)·[QA](../qa.md)를 소비하는 Codex/OMX 전용 모델·effort·dispatch·복구 owner입니다. 다른 host에 자동 적용하지 않습니다. 기존 finite cohort(routing 후보 자격)와 필수 Astra QA는 유지합니다. Lane별 model admission grant는 2026-10-07 삭제됐습니다.

Child 완료·추가 배정·capacity 오류·turn 종료 시 Parent가 [subagent lifecycle](../subagent-lifecycle.md)에 따라 결과 회수, explicit-close/verified-no-close/unknown과 slot 증거를 구별합니다. Child 상한은 6(root 제외, V2가 표시하는 slot 7은 root 포함)이며 close 미지원만으로 release 또는 실패를 단정하지 않습니다. V2 runtime-managed에서는 같은 lane 후속에 `followup_task`를 우선하되(수락·해제 전 child만, 수락·해제한 child는 hook이 deny하고 보완은 새 dispatch) 최초 독립 QA는 fresh scoped context를 유지합니다. `/agents`는 선택적인 operator evidence이지 필수 기반이 아닙니다.

## 구조

Codex 실행 접점은 여섯 층입니다. 각 층은 다른 층의 보장을 대신하지 않습니다.

- `AGENTS.md`: 세션 시작 때 읽히는 저장소 규칙과 진입점입니다. Codex는 root부터 작업 디렉터리까지 디렉터리마다 instruction
  파일 하나를 이어 붙이고, 합친 크기가 `project_doc_max_bytes`(기본 32 KiB)에 닿으면 더 붙이지 않습니다. 그래서 루트
  `AGENTS.md`는 이 한도 안에 두고 하위 `AGENTS.md`·`AGENTS.override.md`를 두지 않습니다(`agent-guidance-boundary.test.mjs`).
  [공식 AGENTS.md 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- 이 문서: 위임·리뷰·완료 판정의 routine 규칙입니다. 세부는 아래 reference를 필요할 때 읽습니다.
- Skills: `.agents/skills`의 Parent 반복 절차이며 권한을 부여하지 않습니다([호출 규칙](#routine-task-model-operation)).
- 역할: `.codex/agents/knu_*.toml`이 역할별 effort pin·지시를 정합니다. Model은 profile이 정하며 역할 파일에 두지 않습니다.
- Hooks: project hook(`.codex/hooks.json`)이 호출 시점 guardrail(writer 실행 중 Parent의 tracked·비ignored 경로 `apply_patch` deny 포함)과 child 완료 기록을
  맡습니다. Hook 부재·실패에서는 호출이 막히지 않습니다. Spawn의 남는 보장은 완료 판정 거부이고 Parent 쓰기는 운영 규칙만 남습니다(완료 판정은 Parent 쓰기를 탐지하지 않음, [Native registry](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)).
- Sandbox·approval: 사용자·세션이 정하고 child가 물려받습니다. 저장소는 project 기본값·실행 규칙(`.codex/rules`)을 두지 않고 역할 파일의
  `sandbox_mode`는 이를 override하지 않는 writer 표시입니다([permission mechanism](./codex-native-registry.md#codexomx-permission-mechanism)).

## Reference 문서

Routine 순서는 이 문서에 있습니다. Cold-start 2단계가 보내는 [Astra 배정](#reasoning-effort-routing)의 역할·effort 배정 표는
[Effort routing](./codex-effort-routing.md)에 있고, 다음 세부는 필요할 때만 읽습니다.

- [Effort routing](./codex-effort-routing.md): Pass 1·2 판정, child 계층과 역할 effort 배정 표, 재시도, dispatch
  descriptor입니다. 역할과 effort를 배정할 때 읽습니다.
- [Model profiles](./codex-model-profiles.md): 후보 profile 표와 admission, profile 세대교체, 역할 설정과 fresh loading, cohort
  철회입니다. 모델·profile을 고르거나 바꿀 때 읽습니다.
- [Native registry](./codex-native-registry.md): spawn 등록·hook guardrail·완료 관측·수락과 Codex/OMX 권한 수단입니다. 등록·완료
  거부 사유나 hook 동작을 확인할 때 읽습니다.
- [Diagnostics](./codex-diagnostics.md): `codex:preflight` resume 진단의 필드·identity·freshness·bounded read입니다. 계획 재개
  진단을 해석할 때 읽습니다.
- [Qualification](./codex-qualification.md): Claude Lead를 위한 top-level `codex exec` 교차 reviewer의 정적 경계와 native live
  pilot 절차입니다. Bridge나 live pilot을 다룰 때 읽습니다.
- [Codex delegation](./codex-delegation.md): candidate schema·`modelRequest`·context delivery·count와 write policy입니다. Lane
  입력을 만들 때 읽습니다.

## Repository workflow entry

```sh
pnpm codex:workflow -- --request '변경 원인을 분석해줘.' --mode fresh --json
pnpm codex:workflow -- --request '지정 작업을 분석해줘.' --mode resume --plan .plans/example-plan.md --json
pnpm codex:preflight -- --fresh
```

`codex/workflow-entry.mjs`의 `prepareCodexWorkflow`는 공통 intake/context/readset → 기존 Codex delegation/dispatch 추천 → 공통 bounded lane 검증을 연결합니다. CLI는 현재 요청의 deterministic 진단이며 provider·native agent·OMX를 실행하지 않습니다. API 입력은 정해진 key만 받고 그 밖 key는 `Unsupported workflow input: <key>` TypeError입니다(삭제된 runtime evidence·admission 입력이 조용히 무시되지 않게). 명시한 plan 외에 local memory를 탐색하지 않습니다.

API의 `directAssignment` 또는 선택된 child별 `assignments`, `currentSnapshot`, `adapterIdentity`는 Parent가 현재 source와 비교해 제공합니다. Missing binding은 gap이며 자동 권한이 아닙니다. `validateCodexWorkflowResults`는 원래 입력에서 계약을 다시 계산하고 common fan-in과 독립 QA exchange를 검사합니다. `reviewDisposition: { required, reason }`에 공통 QA trigger를 검토한 Lead 판단을 명시합니다. 오탈자 등 저위험 direct 작업의 `not-needed` 의미를 보존하고, disposition 누락은 gap입니다. Bounded-build의 필수 Astra QA는 면제하지 않습니다. QA가 필요하면 현재 task/owner/snapshot뿐 아니라 lane acceptance와 read/write scope에 대응하는 완료 PASS를 요구합니다. 제출된 coverage·관측 모델은 Lead가 실제 증거와 다시 대조해야 합니다. 결과 `valid`는 정적 정합성뿐입니다. 실제 호출·model/permission·finding 재현·Astra QA·종료 입증은 계속 Parent와 host의 책임입니다.

`codex:preflight`는 Codex Git/OMX snapshot 명령이며 request CLI의 alias가 아닙니다. 기본 계획 탐색은 `.plans`, 명시적 legacy `.omx/plans` 읽기만 과도기 호환입니다. `planDiscovery.complete/issues` 및 선택된 `planBinding`으로 불완전한 inventory와 잘못된 상태를 드러냅니다. Legacy reader 제거 조건은 필요한 callers와 owner-local 계획 migration 완료입니다. 파일을 자동 생성·이동하거나 runtime `.omx/context`를 옮기지 않습니다.

### 저장소 root와 runtime state 위치

- Codex와 OMX는 저장소 root에서 시작합니다. OMX 0.21.6은 `OMX_ROOT`·`OMX_STATE_ROOT`가 없으면 현재 작업 디렉터리의
  `.omx`를 state root로 쓰고 위치 표식을 지원하지 않습니다. 하위 디렉터리에서 시작하면 그 아래에 `.omx`가 생깁니다.
- Agent가 만든 screenshot·dev server log·검증 출력은 `.omx/`나 app 하위 디렉터리가 아니라
  [`.artifacts/`](../../../../.artifacts/README.md#배치-규칙)에 둡니다. repository script는 `resolveArtifactPath()`를 씁니다.
- `pnpm check:fast`(pre-commit)는 `scripts/git/workspace-layout-check.mjs`로 root 밖 `.omx`·`.omc`와 옛 root 이름을 탐지해
  commit을 멈춥니다. 탐지이지 차단 장치가 아니므로 발견하면 내용을 옮기고 시작 위치를 바로잡습니다.

## Reasoning effort routing

Pass 1·2, child 계층과 역할 effort 배정 표, 재시도, dispatch descriptor는 [Effort routing](./codex-effort-routing.md)에 있습니다.

### Parent-high 운영과 quality stop

공통 조건은 [Quality stop](../orchestration.md#quality-stop)을 따르며, 이 절은 Codex Parent Astra high·xhigh 운영을 더합니다.
연속 non-PASS 회차와 finding의 Parent 처분은 [리뷰 회차](../qa.md#리뷰-회차)를 따릅니다.

Owner가 **Parent Astra high**를 선택하는 운영 형태에서도 작은 작업은 직접 처리합니다. 분리 가능한 깊은 미해결 문제만
기존 semantic evidence와 active schema 확인을 거쳐 **Astra XHigh 배정**(읽기는 `_xhigh` 역할 xhigh, 구현은
`deep-build`)으로 보냅니다. 전체 문제 정의·범위·cross-owner
통합이 어려우면 Parent xhigh를 권고하며, 높은 child effort가 Parent의 통합 판단을 대신하지는 않습니다.

- 적용은 관련 구현·검증·운영 handoff가 완료된 뒤 실제 host의 session control에서 선택합니다. 이 지침 추가, 설정 파일 값,
  child descriptor만으로 현재 Parent high 적용을 주장하지 않습니다. Parent/global/reviewer 설정을 자동 변경하지 않습니다.
- 첫 실제 업무에서 required tests와 [독립 QA trigger](../qa.md#independent-review-disposition)를 유지하고 acceptance 누락·
  scope 위반·substantive finding·수정/복구 원인을 기록합니다. 작은 작업마다 새 QA child를 만들지는 않습니다.
- 보안/권한/범위/데이터 invariant 위반 또는 잘못된 완료 주장이 확인되면 해당 작업의 무인 계속을 멈추고 원인·영향을 확인합니다.
  **원인을 먼저 구분한 뒤 effort를 판단**합니다. Source/환경/권한/테스트 공백부터 바로잡고, Parent의 framing·통합 추론 부족이
  의심되거나 같은 누락이 재발하면 Parent xhigh 재검토를 권고합니다. 격리 가능한 기술 문제만이면 bounded xhigh child를 씁니다.
- 상향은 원인 입증이나 품질 회복 보장이 아닙니다. 입력 부족·권한 거절·필수 독립 검증 부재를 effort로 우회하지 않습니다.
  기존 retry ceiling·QA gap 처리를 유지하고 해결 불가능하면 근거를 보존해 handoff합니다.

Ordinary Astra도 공급된 context 불일치를 dispatch consumer가 거절합니다. 선택된 lane의 spawn 인자는 context를 생략하든
scoped로 공급하든 contract에서 정해지며, 공급 context의 호환성과 reuse 경계는 [context delivery](./codex-delegation.md#context-delivery)가
소유합니다. 이 경계의 회귀
검사와 실제 Parent-high 품질/사용량 관측은 별개이며, 검증되지 않은 동등 성능·weekly 절감 수치를 보고하지 않습니다.

## Routine task-model operation

공통 채택·철회 원칙은 [Routine adoption](../orchestration.md#routine-adoption)을 따르며, 이 절은 Codex cohort와 호출 절차를 정합니다.

[현재 profile 결정](../agentic-architecture-decisions.md#task-model-effort-structure)과 [한정된 실제 관측](../agentic-architecture-decisions.md#routine-model-adoption)의 **cohort GO**는
**개별 task 호출 승인**과 다릅니다. 승인된 일반 업무에서 Parent가 적격 profile을 선택하므로 매번 사용자에게 모델명을
다시 묻지 않습니다. 그러나 현재 작업 범위·독립 QA를 생략하거나 과거 pilot PASS를 채택 근거로 재사용하지 않습니다.
Profile model이 바뀐 cohort는 새 model ID·effort의 native live 관측과 [세대교체 절차](./codex-model-profiles.md#central-profile-migration-boundary)의
cohort 품질 근거·독립 QA를 마칠 때까지 Q(routine으로 쓰지 않음)이며, 이전 model의 관측 행은 historical로 남습니다.
예외는 Owner가 품질 근거 전에 routine으로 채택한 경우이며 결정에 그 사실과 대신 지키는 gate를 기록합니다(6.1 Sol, DA-018).
행별 현재 상태는 위 채택 결정의 표가 소유합니다.
운영 procedure는 model-mediated이며 script/schema만으로 task의 실제 의미나 권한을 인증하지 않습니다.

아래 반복 절차는 repository skill(`.agents/skills`)로 호출합니다. 진입은 `$knu-workflow`, 위임(2·3·5단계)은 `$knu-delegate`,
독립 리뷰는 `$knu-review`, 수락·정산(6·7단계)은 `$knu-settle`입니다. Skill은 이 문서가 안내하는 `package.json` script(진입은
[Repository workflow entry](#repository-workflow-entry))와 `scripts/agents/common/review-criteria-selection.mjs`만 호출하고 규칙은 이 문서와 링크된 문서가 소유합니다. Parent 전용이라 child 역할 파일은 `[[skills.config]]`의 `enabled = false`로 넷 다 끕니다.

새 세션/일반 task의 cold-start 순서:

1. **현재 작업부터**: request → AGENTS → 이 owner와 현재 source/test. Branch/HEAD/diff·변경 owner·acceptance를 확인합니다.
   작은 deterministic 작업·단일 chain은 child0입니다. 분리 가능한 미해결 질문 하나에 primary owner를 배정하고
   [불필요한 중복과 독립 QA](../orchestration.md#primary-작업과-증거-재사용)를 구별합니다.
2. **Task→profile**: current Pass 2 사실에서 complete boundedness·빈 gap과 실제 oracle/검증 계획을 확인하고, 계층·impact가
   [후보 표](./codex-model-profiles.md#quality-gated-model-advice)의 한 행에 맞는지 봅니다. Medium 읽기는 `standard-read`, High·XHigh·impact high 읽기는 `elevated-read`, Medium 구현은
   `standard-build`, High(non-deep)·low·medium impact 구현은 `elevated-build`, 고정 입력의 low-impact 단일 추출은 `extract`입니다.
   Risk/owner/의미상 복잡도가 다르거나 미채택 role이면 [Astra 배정](#reasoning-effort-routing)입니다.
   `modelRequest`를 생략한 lane은 `codex:delegate`가 Parent가 태그한 검증 fact로 맞는 행의 요청(`purpose=routine`)을
   채우고(`defaultModelRequest()`), 맞는 행이 없으면 생략해 Astra 배정으로 둡니다.
3. **완전한 packet**: [request/context 계약](./codex-delegation.md#model-recommendation)의 `purpose=routine`, 현재
   profileBinding, scope/도구/쓰기 owner·사실/실패·acceptance·stop/return을 작성합니다. 최초 QA는 fresh source-first context입니다.
   Full history를 복사하지 않되 필요한 실패·제약을 생략하지 않습니다. Candidate의 미해결 실패는 새 lower-model task로 숨기지 않습니다.
4. **권한 확인**: 이 cohort 결정과 현재 사용자 업무 권한을 함께 확인합니다. 원래 권한이 부족하거나 범위를 늘리는 경우에만
   해당 경계를 협의합니다. Lane별 허가 packet은 없습니다. 후보 자격은 routing이, 호출 시점의 (역할, model) 쌍은 hook이,
   완료는 hook 기록 대조가 확인합니다.
5. **Native 실행**: `pnpm codex:delegate -- lanes --spec <spec> --out <파일>`이 spec의 Pass 2 ID·digest를 계산해
   `prepareCodexWorkflow()`·`createDispatchRecommendation()`으로 `{schema, dispatchToken, lanes, dispatches}` 파일을 씁니다.
   `dispatchToken`은 Parent가 spec에 위임마다 새로 정하며 CLI는 형식만 검사합니다. 그 파일을 `pnpm codex:register -- --dispatch <파일>`로 등록한 뒤 출력된
   `spawnArguments`(lane id와 token으로 만든 `task_name` 포함)를 실제 도구에 그대로 전달하되 완료 packet도 함께 전달합니다.
   출력의 `digest`는 수락 때 대조합니다. 등록이 없거나 인자가 다르면 hook이 spawn을
   deny합니다([등록·수락](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)).
   Role 설명·파일 bytes·과거 PASS만으로 loaded/effective를 주장하지 않습니다. 후보도 일반 동시 한도(child cap 6·host 한도)와 단일 writer를 따르고, writer 실행 중 Parent는 tracked·비ignored 경로를 쓰지 않습니다.
   지원/권한 불명은 Astra/direct 또는 handoff이지 generic role·새 root·서버로 우회할 이유가 아닙니다.
6. **결과·독립 QA**: 반환 child/task/source와 실제 oracle/회귀·독립 결과를 대조하고 `codex:completion`과
   [criterion별 QA](../qa.md#portable-qa-packet)로 확인합니다. Parent/default/최종 QA는 Astra이며 reviewer는 계층과 무관하게 `knu_reviewer`(effort pin xhigh)입니다.
   완료로 받을 child는 `pnpm codex:accept -- --task <task_name> --role <agent_type> --model <계약 model>`로 수락하고 출력의
   `registrationDigest`가 등록 때의 `digest`와 같은지 확인하며, 수락한 child는 후속 작업을 주지 않습니다. Reviewer는 `codex:delegate -- review`(`createReviewDispatch()`)로 만든 dispatch를 등록·spawn·수락하며 결과의 `dispatchId`는 그 round의 `reviewId`입니다.
   `prepareLeaderSynthesis()`에 Parent session의 hook 기록·수락 기록과 그 dispatch의 token을 넘겨 failed/blocked/conflicting evidence를 보존하고,
   hook 기록이 없거나 bind·등록 봉인·계약 model·역할 effort·수락 기록과 맞지 않는 completed와 self-PASS를 수용하지 않습니다([완료 관측](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)).
7. **실패·기록·cleanup**: 실패한 candidate는 writer 회수(끝난 writer는 `codex:release -- --task <task_name> --ended`) 뒤 재시도 한 번 또는 Parent 판단·handoff로 돌아갑니다. 재시도는
   결과 품질 실패일 때만 같은 역할의 한 단 위 model로 오릅니다([Recovery ceiling](../request-intake/orchestration-recovery.md#recovery-ceiling)). Usage가 없으면 null로 남기고
   [실패 원인·조치 기록](../request-intake/orchestration-recovery.md#bounded-model-run-evidence)에서 controlled fault와 실제 miss를 구분합니다.
   실제 결과 회수·pending·지원되는 cleanup·release는 [lifecycle](../subagent-lifecycle.md)로 따로 판정합니다.

최종 whole-change QA/통합 증거와 **Parent-high** 시작은 별도 gate입니다. 이 routine cohort 결정은 Parent 설정을 바꾸지
않으며 [Parent-high 준비·품질 stop](#parent-high-운영과-quality-stop)을 대체하지 않습니다. 단가·cache는 선택의 입력일 뿐
Parent+child+QA+수정/복구 총 비용의 절감 실측이 아닙니다. Token/weekly 수집이 없어도 품질 판정은 가능하지만 절감 숫자는
만들지 않습니다. Portfolio/전체 통합 평가는 현재 운영 계약이나 이 작은 표본과 별도로 검증합니다.

## Skill과 workflow routing

- 저장소 workflow 진입: `$knu-workflow`
- bounded child 위임: `$knu-delegate`
- 위임·변경의 독립 리뷰: `$knu-review`
- child·reviewer 완료 수락: `$knu-settle`
- read-only 원인/책임 분석: `$analyze`
- 공식 최신 근거 조사: `$best-practice-research`
- 요구가 모호하고 가정 금지: `$deep-interview`
- architecture/test 합의가 필요한 계획: `$ralplan`
- 한 owner 구현: solo 또는 executor
- 독립 구현 lane과 shared coordination: 실제 OMX runtime의 `$team`
- durable multi-goal completion과 resume: `$ultragoal`
- hostile E2E/회귀: `$ultraqa`
- cleanup: 계획과 회귀 보호 뒤 `$ai-slop-cleaner`
- UI 방향·비평·승인된 구현: [Visual design workflow](../visual-design/README.md); skill 호출이나 Figma 연결은 필수가 아님

Runtime이 없는 surface에서 team/ralph/ultrawork를 이름만 흉내 내지 않습니다.

## 사용자 질문 수단

묻는 형식은 [Discovery 질문 형식](../plan-authoring/discovery.md#질문-형식)과
[decision packet](../owner-lead-collaboration.md#짧은-협의-decision-packet)이 정하고, 이 절은 Codex의 수단만 정합니다.

- Default mode는 권장안과 되돌릴 수 있는지를 담은 평문 질문을 하나씩 묻고, 글로 쓴 객관식 선택지를 쓰지 않습니다.
- 선택지를 비교해야 하면 Plan mode(`request_user_input`, 질문 1~3개) 전환을 안내합니다.
- Default mode template의 "가정으로 진행"은 discovery 판정이 Defer·Infer인 항목에만 적용합니다. Escalate·Ask 항목은
  가정하지 않고 묻습니다.

## OMX 종료 기록 경계

**Codex/OMX에서만:** `omx_wiki/`는 명시적으로 승격한 재사용 지식만 소유합니다. 세션 종료 메타데이터는 repository
`.omx-config.json`의 `wiki.autoCapture: false`로 자동 생성하지 않으며, `session-log-*.md`는 Git 방어선에서도
제외합니다.
