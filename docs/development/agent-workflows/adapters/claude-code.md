# Claude Code project adapter

공통 책임은 [실행 계약](../agent-execution-contract.md), [orchestration](../orchestration.md),
[QA](../qa.md), [위임 계약](../request-intake/delegation.md)이 소유합니다. 이 문서는 Claude의 실행 접점만
연결하며 Codex의 모델·effort·상한·runtime 규칙을 복사하지 않습니다.

## Cross-host direct CLI reviewer (static boundary)

[Claude-target bridge](../../../../scripts/agents/claude/review-bridge.mjs)는 아래 native child와 다른 transport입니다.
현재 command descriptor는 `enabled:false`이며 고정 fake CLI만 검증합니다. Lead가 별도 승인한 local subscription
CLI를 실행하는 구조와 native Agent 호출을 혼동하지 않습니다. `--restricted`, `--agent`, role 파일 존재만으로
project loading·실제 도구/권한·구독 인증·effective model을 입증하지 않습니다. OMC advisor도 프로젝트 reviewer의
대체 증거가 아닙니다. [교차 인계 계약](./cross-model-handoff.md#direct-cli-review-bridge-static-preparation-only)을
따르며 native 차단을 다른 CLI나 API-key SDK로 우회하지 않습니다.

## Loading and scope

`CLAUDE.md`는 `@AGENTS.md`를 import하고 이 adapter로 연결합니다. 현재 요청에 필요한 guide만 읽습니다.
공통 instructions를 네 role에 복제하거나 전체 docs를 startup context에 넣지 않습니다.

```sh
pnpm claude:preflight -- --mode fresh
pnpm claude:workflow -- --mode fresh --request '변경 내용을 설명해줘.'
pnpm claude:preflight -- --mode resume --plan .plans/example-plan.md
pnpm claude:workflow -- --mode resume --plan .plans/example-plan.md --request '이 계획을 분석해줘.'
```

`claude/session-preflight.mjs`는 raw Git 상태와 명시적으로 선택한 공통 `.plans` reader를 소비합니다. Fresh는 계획
목록·memory·Claude Home 설정·OMC state를 직접 탐색하지 않습니다. 오류/unknown을 clean으로 바꾸지 않으며 미추적 파일 내용과
ignored 입력은 source fingerprint의 한계로 표시합니다. Codex 전용 `codex:preflight`를 대신 호출하지 않습니다.
현재 설정·loaded roles·실제 permissions는 별도 관측이 필요하고 Git hash가 이를 인증하지 않습니다.
Git filter의 설정 key만 bounded 조회해 clean/process·fsmonitor를 해당 명령에서 비활성화합니다. Submodule gitlink는
미점검 nested 설정을 실행하지 않도록 worktree 조회 전에 차단합니다. Snapshot은 비원자적 local 진단이며
`claude-git-baseline/v2`의 length-framed raw status/index stage records/HEAD binary diff를 SHA-256으로 결합합니다.
Dirty `currentSnapshot.dirtyDiffDigest`는 `sha256:`을 붙인 실제 fingerprint와 일치해야 합니다.

`claude/workflow-entry.mjs`의 `prepareClaudeWorkflow`는 공통 intake/context/문서 경로·명시 direct assignment·계획
진단을 연결합니다. `validateClaudeWorkflowResults`는 같은 원본 입력에서 계약을 다시 계산하고 공통 lane/result/fan-in
및 독립 QA packet을 검사합니다. 여섯 intent와 fresh/resume는 별도 축이며 Analyze·Plan을 제품 수정 권한으로 바꾸지
않습니다. CLI는 진단용이고 API의 source/assignment/QA 입력을 자동 발명하지 않습니다. 정적 `valid`는 실제 작업·검증·
권한 완료가 아닙니다.
표시용 objective는 공통 sanitized summary를 재사용하고 원문을 출력하지 않습니다. 전체 요청의 `requestDigest`를 별도로
계산해 lane identity와 QA wrapper에 연결합니다. QA 입력의 `requestDigest`도 현재 값과 일치해야 하므로 요약 뒤의
요구 변경이나 redaction으로 서로 다른 요청이 같은 요약이 되어도 결과를 재사용하지 않습니다. Digest는 인증·암호화나
비밀의 안전한 저장을 보장하지 않습니다.

Native 요청은 `--native`로 차단 상태를 진단할 수 있으나 실행 명령이 아닙니다. 현재 exit2와 `blocked`를 반환하며
`dispatchAuthorized:false`, `runtimeQualified:false`를 유지합니다. Native 미지원은 권한 있는 direct 작업을 전역
금지한다는 뜻이 아닙니다. JS API가 Claude native Agent tool을 직접 실행한다고 가장하지 않습니다.

### 프로젝트 역할과 실제 권한

| Role             | 도구 선언                             | 책임                                                 |
| ---------------- | ------------------------------------- | ---------------------------------------------------- |
| `knu_explorer`   | Read, Grep, Glob                      | 한 repository 질문의 현재 source/owner/evidence 조사 |
| `knu_researcher` | Read, Grep, Glob, WebSearch, WebFetch | 이미 선택한 기술의 공식 근거 조사                    |
| `knu_executor`   | Read, Grep, Glob, Edit, Write, Bash   | 명시적으로 소유한 구현·가까운 검증                   |
| `knu_reviewer`   | Read, Grep, Glob                      | builder reasoning을 받지 않는 독립 source 검토       |

네 `.claude/agents/knu_*.md`에는 영구 model pin이 없습니다. 그렇다고 parent 자동 상속을 task별 승인된 모델 선택으로
간주하지 않습니다. Lead가 bounded responsibility·source·acceptance·read/write scope·단일 writer를 정합니다.
Child는 다른 child/외부 CLI로 재위임하지 않고 blocker를 Lead에 반환합니다. Reviewer의 테스트 제안은 실행 승인이 아니며
write-producing 테스트는 별도 runner가 소유합니다.

Role의 tools 선언은 실제로 해당 정의가 로드되고 host가 적용했을 때만 도구 제한입니다. 같은 이름의 managed/CLI/project/
user/plugin 정의와 parent permission mode를 확인합니다. Managed 역할 위치는 managed-settings directory 아래
`.claude/agents/`이며 파일명만으로 frontmatter `name` 충돌을 배제하지 않습니다. Parent의 `auto`·`acceptEdits`·
`bypassPermissions`는 child mode를 덮어쓸 수 있으므로 read-only 선언만으로 sandbox를 입증하지 않습니다.
[공식 subagents](https://code.claude.com/docs/en/sub-agents)의 현재 버전 규칙과 실제 session을 함께 확인합니다.

## Finite native-subagent model candidates

[Claude model policy](../../../../scripts/agents/claude/model-policy.mjs)는 공통 risk/complexity·task authority를 소비합니다.
Lead가 현재 facts를 근거로 선택하며 role 이름·토큰 잔량만으로 자동 결정하지 않습니다.

| Task profile         | 요청 family alias | 조건                                      |
| -------------------- | ----------------- | ----------------------------------------- |
| `bounded-extraction` | `haiku`           | 낮은 위험·고정 입력·단일 추출·명시 oracle |
| `bounded-standard`   | `sonnet`          | bounded read/build·scope·검증·독립 QA     |
| `complex-critical`   | `opus`            | 복잡/고위험 또는 독립 review              |

이는 finite 후보이지 가용성·동등 품질·routine admission 보장이 아닙니다. `selectedBy/approvedBy` 문자열과 caller가
공급한 runtime report는 인증된 host grant가 아닙니다. 현재 static descriptor는 `dispatchAllowed:false`, `applied:false`,
`runtimeQualification:not-run`입니다. Source/config/scope/expiry·writer 충돌·missing/child-chosen/free-form 모델·unknown
runtime·unapproved fallback은 거부합니다. Source가 바뀌면 이전 binding을 재사용하지 않습니다.

### 명시적 native qualification caller

`scripts/agents/claude/native-qualification.mjs`는 `prepareClaudeNativeQualification()`과
`runClaudeNativeQualification()`으로 현재 workflow의 profile/binding을 실제 Claude CLI 내부 native Agent 호출에
연결하는 **검증 전용 API**입니다. 일반 `claude:workflow --native`의 차단을 해제하거나 교차 CLI bridge를 대신하지
않습니다. API를 호출할 수 있다는 사실은 외부 전송·모델 비용·host 권한 승인이 아닙니다.

- `prepareClaudeWorkflow()`의 current task/source와 full requestDigest, adapter source, project role bytes,
  task snapshot, 명시 launch config, 만료와 run/session identity를 별도로 묶습니다. 임의 JSON으로 복원한 plan은 실행하지 않습니다.
- 현재 구현은 명시한 파일의 `Read`만 지원하는 read-only qualification입니다. 추가 tool, write scope, custom project
  settings가 있으면 거부합니다. Native 역할 정의의 도구 목록을 runtime에서 모두 허용했다는 뜻이 아닙니다.
- `--safe-mode`와 `--restricted`는 이 caller에 사용하지 않습니다. Project role discovery를 유지하며
  `--setting-sources project`, 제한된 tools, 빈 MCP, `manual` 및 `--permission-prompts none`을 사용합니다.
  이 검증에만 OMC plugin을 명시적으로 비활성화하며 Home 설정을 수정하지 않습니다. Collector는 startup hook과
  builtin 이외 plugin, 다른 cwd·permission mode를 거부합니다. 이는 이미 실행된 startup side effect를 되돌리는 sandbox가
  아니므로 승인된 disposable fixture만 사용하고 숨겨진 managed 설정을 인증했다고 주장하지 않습니다.
- 모든 native Agent/Read/Grep/Glob 호출에 `permissions.ask`를 적용하고 `PermissionRequest` hook이 정확한 session,
  source/config, role, model, prompt와 파일 범위를 확인합니다. Agent grant는 한 번만 발급합니다. Hook 허용 결과는
  일반 dispatcher 활성화나 영구 permission 변경이 아닙니다.
- Agent는 기본적으로 승인 질문이 없는 도구이므로 `dontAsk`와 불완전한 allowlist만으로 default-deny를 주장하지 않습니다.
  `Tool(param:value)`는 ask/deny용이며 model parameter allow 규칙으로 사용하지 않습니다.
- Read 성공과 실행 중인 process의 stream을 `native-run-evidence.mjs`로 검증한 결과는 common result/QA validator에도
  전달합니다. 구조 검사만으로 의미상 acceptance를 입증하지 않았으므로 common result는 `partial`과 명시적 QA gap을
  유지합니다. Native readiness와 독립 QA가 미충족이면 common assessment도 완료로 승격되지 않습니다.

Collector는 실제 CLI의 init, Agent tool use, task lifecycle, forwarded child messages, structured tool_use_result,
terminal result를 같은 session/task/tool에 연결합니다. Chunk별 동일 message ID는 허용하지만 UUID 중복·역순·누락,
foreign session, 실제 시작·완료 prompt 변경, 모델/도구 불일치, timeout/비정상 종료/source drift를 거부합니다. Import한 event JSON은 구조 검사 자료이지
실행 provenance나 host authority가 아니며, 실제 caller만 자신의 subprocess stream과 종료 상태를 소유합니다.

`--no-session-persistence`가 child transcript까지 없애는 것은 아닙니다. Fixture 정리와 별도로 실제 session/task에 속한
출력 symlink 및 transcript를 확인합니다. Event의 임의 경로를 따라 삭제하지 않고 승인된 정확한 경로만 정리하며,
Home settings·다른 session·공유 runtime root는 보존합니다.

### 요청·차단·관측의 세 경계

1. **요청 선택:** 명시 task profile/binding으로 어떤 모델을 요청했는지 결정합니다.
2. **호출 전 차단:** 실제 host가 잘못되거나 누락된 모델 요청을 막았는지 별도로 입증합니다.
3. **호출 후 관측:** 해석된 시작 모델·실행 중 변경·완료와 같은 run의 결과를 연결합니다.

현재 native strict admission은 미입증이며 위 source entry는 이를 활성화하지 않습니다. 정상 hook의 deny 성공만으로
startup failure/crash/malformed output/timeout 때도 차단된다고 주장하지 않습니다. Command hook 실패는 일반 permission
판정으로 진행될 수 있습니다. 이것이 모든 default-deny 조합의 허용을 의미하지는 않습니다. 다만 `ask:Agent`와 `dontAsk`에
PreToolUse allow를 더하는 조합은 matching ask가 남아 정상 허용 경로도 입증되지 않습니다.
[Permission과 hooks](https://code.claude.com/docs/en/permissions#extend-permissions-with-hooks),
[hook 실패 처리](https://code.claude.com/docs/en/hooks)를 확인합니다.

이 검증 caller는 [headless 승인 계약](https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs)의
`manual` + `--permission-prompts none`을 사용합니다. Matching ask에 대한 PermissionRequest의 유효한 allow가 없으면
비대화식 실행은 거부되도록 구성합니다. 이 조합의 유한 정상·오류 시험을 모든 interactive mode, 다른 hook 조합이나
Home/managed 정책의 일반 보장으로 확대하지 않습니다. PermissionRequest에는 `tool_use_id`가 없으므로 caller가 소유한
일회용 request grant와 실제 Agent 입력을 대조하며 존재하지 않는 hook 필드를 만들어 연결하지 않습니다.

공식 parameter rule의 `Agent(model:opus)`는 literal 입력 비교이며 model 누락은 그 값 규칙에 매치되지 않습니다.
이를 task별 정확한 하나의 모델·provider-effective identity 강제로 과장하지 않습니다. Native invocation → frontmatter →
env default → parent 우선순위 외에도 FORCE override·managed 허용 모델 대체가 있습니다. Managed exact allowlist 역시
허용 집합 제한과 개별 task 선택은 별개입니다. [Model 설정](https://code.claude.com/docs/en/model-config)과
[env 규칙](https://code.claude.com/docs/en/env-vars)을 현재 설치 버전에서 확인합니다.

### 결과와 observation 경계

CLI `stream-json`의 complete assistant/user message `parent_tool_use_id`와 hook의 `session_id`·`agent_id`·
`tool_use_id`는 같은 envelope가 아닙니다. Agent PostToolUse의 `resolvedModel`은 시작 또는 background 전환 시점 모델이고
`modelsUsed`는 변경 관측입니다. Parent modelUsage나 응답 문장을 child model 입증으로 사용하지 않습니다.
[CLI streaming](https://code.claude.com/docs/en/headless#follow-subagent-messages)과 실제 설치본의 machine record를 대조합니다.

같은 tool ID라도 다른 parent/session/run/source/config/binding의 record를 합치지 않습니다. Child session ID가 parent와
다를 수 있으므로 단순 ID 동일성도 올바른 관계 검사의 대체물이 아닙니다. 누락·중복·역순·취소·불명확 provenance는 gap으로
남깁니다. 검증 전용 entry에는 구조 collector가 있지만 일반 native admission을 허용하는 qualified collector로
승격하지 않았습니다. 임의 JSON receipt를 actual host observation으로 취급하지 않습니다. [qualification matrix](../../../../scripts/ci/fixtures/claude-subagent-model-qualification-matrix.json)는 test scenario이지
현재 세션의 PASS 증거가 아닙니다.

## Plan continuity

공통 [session continuity](../session-continuity.md#active-plan-lifecycle)가 lifecycle을 소유합니다.

- 새 계획은 `.plans/<plan-id>-plan.md`에 하나의 canonical Plan ID로 생성합니다. Native Plan Mode 파일은 초안이며
  현재 요청·source와 비교해 명시적으로 채택합니다. runtime draft를 자동 이동·덮어쓰거나 이중 계획으로 동기화하지 않습니다.
- Resume는 위 명령의 명시 plan 경로와 현재 branch/HEAD/변경 상태를 확인합니다. 진단용 경로만 전달해서 실행 권한이나
  checkpoint 일치를 얻지는 않습니다. `--continuation`에 `expectedPlanId`와 `checkpointSnapshot`(branch/head/diffHash)의
  JSON을 명시하면 현재 Git 진단과 대조합니다. 입력은 4096자로 제한하며 미제공 snapshot을 발명하지 않습니다.
  Missing/moved/terminal/reference/duplicate/불완전 identity는 공통 reader 판정을
  따릅니다. Full corpus 경고와 identity completeness도 구별합니다.
- Codex에 인계할 때 같은 `.plans` path/ID와 snapshot, changed files, verification, blocker, 다음 행동 및 기존 writer
  해제를 전달합니다. Codex runtime state를 Claude에 복사하거나 Codex 명령을 Claude preflight로 사용하지 않습니다.
- 완료 AC와 통합 근거가 충족되면 `.plans/finished/YYYY/MM/<domain>/`, 취소/대체는 `.plans/cancelled/YYYY/MM/<domain>/`에
  이동하고 링크를 갱신합니다. 독립 미완료 supporting plan을 함께 완료하지 않습니다.
- OMC 사용은 owner 선택입니다. 같은 repository 계획을 소비하되 실제 OMC 초안 경로·session 소유권·resume/stop API는
  현재 runtime의 확인된 절차를 따릅니다. `.omc/plans`를 자동 canonical로 추측하거나 `.omx` 명령/state를 사용하지 않습니다.
  OMC 없이도 위 Git/계획 진단은 작동합니다. 특정 session resume/cleanup 지원은 별도 live 증거가 필요합니다.

## Project visual skills

Taste (`design-taste-frontend`)와 Redesign (`redesign-existing-projects`)은 **Codex-only**입니다. Claude에 이식·설치·호출하지
않으며 개인 Codex skill을 수정하지 않습니다. Claude UI 작업은 공통 VisualBrief/content/a11y/독립 검토 계약을 직접
따르고 대체 skill 설치를 요구하지 않습니다. [Visual skill 선택](../visual-design/design-task-orchestration.md#task-fit-skills)을
참고합니다.

## Bounded fresh-host qualification

`repository-prepared`와 `runtime-qualified`는 별개입니다. Source entry/정적 테스트가 실제 model/role/permission을
입증하지 않습니다. Native pilot은 별도 승인된(separately authorized) 범위·비용·호출 수·timeout·정리 조건을 먼저 고정하고
필요한 최소 payload만 전송합니다. 로그인 완료나 Phase 요청을 secret·무제한 호출·권한 확대 승인으로 해석하지 않습니다.

Disposable fixture에서 readonly 도구 부재·자발적 거부·host denial을 구별하고, executor의 허용 write/test·실패 보고·
독립 QA·취소/결과 회수도 따로 관측합니다. 실제 지원 없는 mode는 scoped NO-GO로 두며 prompt/advisory로 몰래 낮추거나
다른 모델로 fallback하지 않습니다. Source/config/host drift가 있으면 관련 qualification을 다시 수행합니다.
Home/managed 정책을 바꾸거나 bypass로 성공시키지 않습니다.
