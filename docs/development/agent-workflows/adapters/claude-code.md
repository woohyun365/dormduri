# Claude Code project adapter

공통 책임은 [실행 계약](../agent-execution-contract.md), [orchestration](../orchestration.md),
[QA](../qa.md), [위임 계약](../request-intake/delegation.md)이 소유합니다. 이 문서는 Claude의 실행 접점만
연결하며 Codex의 모델·effort·상한·runtime 규칙을 복사하지 않습니다.

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
목록·memory·Claude Home 설정·OMC state를 직접 탐색하지 않습니다. 오류/unknown을 clean으로 바꾸지 않습니다. 미추적 일반 파일은 내용 digest로 결합하며(파일당8MiB/총32MiB),
ignored 입력은 Git fingerprint 밖입니다. Native task가 명시한 ignored 파일은 별도 inventory로 결합하지만 ignored 디렉터리 전체를 자동 조사하지 않습니다. Codex 전용 `codex:preflight`를 대신 호출하지 않습니다.
현재 설정·loaded roles·실제 permissions는 별도 관측이 필요하고 Git hash가 이를 인증하지 않습니다.
Git filter의 설정 key만 bounded 조회해 clean/process·fsmonitor를 해당 명령에서 비활성화합니다. Submodule gitlink는
미점검 nested 설정을 실행하지 않도록 worktree 조회 전에 차단합니다. Snapshot은 비원자적 local 진단이며
`claude-git-baseline/v3`의 length-framed raw status/index stage records/HEAD binary diff/미추적 파일 digest를 SHA-256으로 결합합니다.
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

`claude:workflow --native`는 완전한 task 입력 없이 상태만 진단하는 명령이므로 실행하지 않습니다.
JS validator의 `dispatchAuthorized:false`는 host 권한을 발급하지 않는다는 뜻이며 `runtimeQualified:false`도 해당 실행의 전체 검증을 대신하지 않습니다. 모든 정상 native 사용을 영구 금지한다는 뜻이 아닙니다.

## 구조

Claude 실행 접점은 다섯 층입니다. 각 층은 다른 층의 보장을 대신하지 않습니다.

- `CLAUDE.md`: 항상 참인 저장소 규칙과 진입점입니다. `@AGENTS.md`를 import하고 이 문서로 연결합니다.
- Skills: 절차입니다. `/knu-delegate`·`/knu-review`·`/knu-settle`이 helper 호출 순서를 안내하며 권한을 부여하지 않습니다.
- Subagents: 역할과 도구입니다. `.claude/agents/knu_*.md`가 역할별 도구를 정합니다.
- Hooks: 관측·prompt 주입·file guard입니다. Hook 부재·crash 시 실행 자체의 fail-closed를 보장하지 않습니다. KNU hook
  오류가 호출을 막는 경우는 이벤트마다 다르며([Native registry](./claude-native-registry.md)), 남는 보장은 완료 판정 거부입니다.
- Permissions: settings의 permission `deny` 규칙에 맞는 호출은 확인 없이 막힙니다(hard deny). 규칙은 명령 텍스트 일치일
  뿐 보안 경계가 아닙니다. `ask` 규칙은 확인 단계이며 gate로 쓰지 않습니다. auto에서 `Agent(<role>)` ask 규칙이 prompt
  없이 child를 시작한 관측이 있습니다([Model profiles](./claude-model-profiles.md)). 추적되는 `.claude/settings.json`에는
  permission 규칙을 두지 않습니다.
- Auto mode classifier: 판정은 누락될 수 있어 보장이 아닙니다. 대응은
  [classifier 판정 없음](../../troubleshooting/tooling/claude-auto-classifier-no-verdict.md)을 따릅니다. autoMode의
  `hard_deny` 범주는 위 Permissions의 hard deny와 다릅니다.

## Reference 문서

Routine 절차에 필요한 내용은 이 문서에 있습니다. 다음 세부는 필요할 때만 읽습니다.

- [Native registry](./claude-native-registry.md): 일반 auto 세션의 등록·hook·관측 단계, 운영 보장과 제한, 프로젝트 역할과
  실제 권한입니다. 등록·정산 단계의 원문이나 hook 동작을 확인할 때 읽습니다.
- [Same-host review](./claude-same-host-review.md): 같은 host 독립 reviewer의 registry·packet·정산 규칙입니다.
  `/knu-review` 경로의 세부를 확인할 때 읽습니다.
- [Model profiles](./claude-model-profiles.md): task profile 표, 요청·차단·관측의 경계, 결과 observation 경계입니다.
  모델·profile을 고를 때 읽습니다.
- [Qualification](./claude-qualification.md): cross-host direct CLI reviewer의 정적 경계와 fresh-host qualification입니다.
  Bridge나 qualification을 다룰 때 읽습니다.

## Routine operation

새 세션의 일상 순서입니다. 작은 작업은 Lead가 직접 처리하고, 분리 가능한 bounded 작업만 KNU 역할에 위임합니다.

3~6단계는 프로젝트 skill `/knu-delegate`·`/knu-review`·`/knu-settle`(`.claude/skills/`)이 명령 형식과 순서를 안내합니다. Skill은
spec의 `sessionId`와 `review --session`에 현재 session ID(`${CLAUDE_SESSION_ID}`)를 넣고 기존 helper만 호출하며, 권한을 부여하지
않습니다(`allowed-tools` 없음). 규칙의 원본은 이 문서·reference 문서와 등록 거부 troubleshooting 문서입니다.

1. `pnpm claude:preflight -- --mode fresh`로 branch·HEAD·working tree와 계획 상태를 확인합니다.
2. `pnpm claude:workflow -- --mode fresh --request '<요청>'`으로 공통 intake 분류와 읽을 문서를 확인합니다.
3. 위임할 때만 Lead가 역할·profile·선택 근거·범위·acceptance를 정해 `pnpm claude:native prepare --spec <JSON file>`로 등록합니다.
4. 반환된 `agentInput` 그대로 Agent를 호출합니다(hook이 등록 prompt를 주입). 정산 전에는 [Parent도 tracked·비ignored 파일을 수정하지 않습니다](./claude-native-registry.md#일반-interactive-auto-세션).
5. Background child는 완료 알림(`task-notification completed`)을 받은 **다음** `settle --task <taskId>`로 관측을 정산합니다.
   Foreground 호출은 PostToolUse가 완료를 기록하므로 알림을 기다리지 않습니다. 알림 전 정산은
   거부되므로 알림을 받기 전에는 같은 turn에서 정산을 반복 시도하지 않습니다. 이어서 `settle --judgment`로 판정합니다.
   판정 입력은 첫 `settle`이 만든 `judgment-template.json`을 채워 씁니다(`settle --judgment <그 파일>`).
   Background child의 hand-back 메시지가 알림보다 먼저 와도 완료 관측이 아니므로 알림 뒤에 정산합니다. hand-back을 받은 turn은 text로
   끝내지 않고 finding 재현 같은 tool 작업으로 이어 가며, 알림이 그 turn에 오면 바로 정산합니다
   ([hand-back 뒤 알림](../../troubleshooting/tooling/claude-native-completion-observation-missing.md#hand-back-뒤-완료-알림이-오지-않음)). 알림 도착에 맞춰 발화하는 hook이 공식 문서에 없어 이 순서는 자동화하지 않습니다(추론).
6. 독립 QA가 필요하면 `pnpm claude:native review`로 packet을 만들고 reviewer를 같은 방식으로 등록·호출·정산합니다.
   Parent가 직접 작성한 변경은 `parent-adjudication`으로 판정합니다([Same-host independent review](./claude-same-host-review.md#same-host-independent-review)).

Auto mode 판정이 누락되면 [classifier no verdict 대응](../../troubleshooting/tooling/claude-auto-classifier-no-verdict.md)의
재시도·Owner 직접 실행 경로를 따릅니다.

채택·철회 원칙은 [Routine adoption](../orchestration.md#routine-adoption)을 따릅니다. 역할 파일이나 `.claude/settings.json`을 바꾸면
[Configuration changes](../agent-execution-contract.md#configuration-changes)에 따라 새 세션에서 바뀐 항목을 관측한 뒤 위임합니다.
역할·도구는 새 세션이 보고하는 agent 목록, hook은 새 세션의 hook 기록으로 위임 전에 확인합니다. 모델은 첫 위임에서
`expectedResolvedModel`과 native 기록의 `resolvedModel`을 대조해 확인하며, 다르면 그 결과를 쓰지 않습니다. 권한 규칙처럼 이
기록에 나타나지 않는 변경은 실제 허용·거절을 관측하기 전까지 적용됐다고 보지 않습니다.

Routine 위임 대상은 live 관측(CLI 2.1.284~2.1.286, owner Home·OMC 로드)이 있는 역할×profile 조합뿐입니다. 관측은 해당 조합이
동작했다는 증거이지 가용성·품질 보장이 아닙니다. Q 행은 live 증거가 생길 때까지 routine으로 쓰지 않습니다.
Live 증거는 필요조건일 뿐이며, Q 행을 routine으로 바꾸는 것은 이 표를 갱신하는 별도 채택 결정입니다.
`Q(관측 <버전>, 채택 대기)`는 live 관측은 있지만 채택 결정 전인 Q 행입니다.

Alias는 Agent 호출의 요청값이고 실제 모델은 Claude Code가 호출 시점에 정합니다. 같은 family의 Parent면 Parent의 exact 모델로
해석되므로 Parent 모델과 CLI 버전에 따라 달라질 수 있습니다([Model 설정](https://code.claude.com/docs/en/model-config)).
`prepare`의 `expectedResolvedModel`에 exact ID를 두고 관측값이 다르면 거부합니다. 아래 관측 ID 밖의 exact 모델로 해석되는
조합은 관측 전까지 routine이 아닙니다.

| 역할                 | Profile              | Alias    | Effort    | 관측된 모델 ID               | 작업                 | 상태                                  |
| -------------------- | -------------------- | -------- | --------- | ---------------------------- | -------------------- | ------------------------------------- |
| `knu_explorer`       | `bounded-extraction` | `haiku`  | —(미지원) | `claude-haiku-4-5-20251001`  | 고정 입력 추출       | 미사용(Haiku 5.5 migration plan 대기) |
| `knu_explorer`       | `bounded-standard`   | `sonnet` | high      | `claude-sonnet-5-5`(2.1.286) | 고정 입력 추출       | 관측                                  |
| `knu_executor`       | `bounded-standard`   | `sonnet` | high      | `claude-sonnet-5-5`(2.1.284) | bounded 구현·검증    | 관측                                  |
| `knu_researcher`     | `bounded-standard`   | `sonnet` | high      | `claude-sonnet-5-5`(2.1.286) | 공식 근거 읽기       | 관측                                  |
| `knu_reviewer`       | `complex-critical`   | `opus`   | xhigh     | `claude-opus-5-5`(2.1.286)   | 독립 source review   | 관측                                  |
| `knu_explorer`       | `bounded-standard`   | `sonnet` | high      | `claude-sonnet-5-5`(2.1.286) | repository 읽기 조사 | Q(관측 2.1.286, 채택 대기)            |
| `knu_executor`       | `complex-critical`   | `opus`   | high      | `claude-opus-5-5`(2.1.286)   | 복잡한 구현          | Q(관측 2.1.286, 채택 대기)            |
| `knu_executor_xhigh` | `complex-critical`   | `opus`   | xhigh     | `claude-opus-5-5`(2.1.286)   | 고위험 구현          | Q(관측 2.1.286, 채택 대기)            |

Effort 열은 역할 파일의 설정값이고(Haiku는 effort를 지원하지 않아 역할 값을 적용하지 않음), 상태의 "관측"은 모델 ID 관측입니다. 실제 effort는 정산이 task마다 child transcript로
대조합니다([Model profiles](./claude-model-profiles.md#역할-effort와-executor-단계)).

## Recovery

공통 상한은 [Recovery ceiling](../orchestration.md#recovery-ceiling)이 소유하며, 이 절은 Claude의 재등록과 모델·effort 상향을 정합니다.

위임한 작업이 실패하거나 acceptance를 채우지 못하면 먼저 그 task를 정산합니다. `release`한 task에는 결속할 수 없으므로 `release`는 관측 없이 끝난 child의 writer 회수에만 씁니다. 재시도는
**한 번만** 허용하며 새 task로 다시 등록합니다. 재시도는 실패한 1차 task에 결속합니다. Spec의 `recovery`에
`{of: <1차 taskId>, cause}`를 두고 1차 task와 같은 사실로 등록합니다. 1차 task는 실행·관측되어 있어야 합니다.
조건을 맞추려고 task 사실을 바꾸지 않으며 맞지 않으면 Owner와 다음 행동을 정합니다
([Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)).

이 상향은 공통 원칙의 자동 사다리가 아닙니다. 재시도는 한 번, 한 단계뿐이며 Lead가 원인을 보고 등록합니다. 공통 원칙은
다른 접근의 구체를 host adapter에 맡기고, Claude의 구체는 [상향 사다리](./claude-model-profiles.md#recovery-상향-사다리)가
정합니다. 거부 이유와 기록 순서는 [Recovery 결속](./claude-native-registry.md#recovery-결속)이 소유합니다.

- `result-error`(결과가 틀림)와 `omission`(파일 누락·테스트 미실행·중도 정지)은 사다리의 다음 단계로 올립니다.
- `context-missing`은 같은 profile·역할로 다시 등록합니다. Prompt에만 context를 보탭니다.
- Acceptance나 scope를 바꿔야 하면 재시도가 아닙니다. Owner와 정합니다.
- 올린 역할×profile이 [Routine operation](#routine-operation) 표의 Q 행이거나 표에 없으면 그 재시도가 해당 조합의 첫 live
  관측입니다. `expectedResolvedModel`에는 같은 alias가 현재 CLI 버전에서 관측된 ID(예: `opus` → `claude-opus-5-5`,
  2.1.284의 `sonnet` → `claude-sonnet-5-5`)를 두고, 결과는 그 조합의 증거로 기록할 뿐 routine 채택으로 보지 않습니다.
- 실패한 Agent 호출(PostToolUseFailure)은 해석된 모델이 없어 결속할 수 없습니다(`effective-model-mismatch`). Lead와 Owner가
  원인을 보고 다음 행동을 정합니다.
- 등록된 재시도가 실행되지 못해도 재시도 기회는 쓴 것입니다. 1차 task는 이미 superseded라 완료할 수 없습니다. 다음 행동은
  Owner와 정합니다.
- Registry는 결속한 재시도의 상한만 강제합니다. 결속 없는 같은 사실 재등록의 상한은 Lead 운영 규칙입니다.
- Quota·permission·QA 문제는 모델·effort 변경으로 우회하지 않습니다.
- 재시도도 실패하면 무인 계속을 멈추고 원인·증거를 보존해 Owner와 다음 행동을 정합니다.

Coverage gap이 있는 reviewer FAIL은 완료된 리뷰로 기록되지 않습니다. 재리뷰하거나 Parent가 교차 참조로 마감합니다.

## Parent 운영과 quality stop

공통 조건은 [Quality stop](../orchestration.md#quality-stop)을 따르며, 이 절은 Claude Parent 설정과 추가 stop 조건을 정합니다.

Claude Parent 기본값은 **Opus 5.5 high**입니다. Framing·통합 추론 부족이 재발하면 xhigh를 권고합니다. Fable은 사용 근거가
생기기 전에는 쓰지 않습니다. Parent 모델·effort는 Owner가 session control에서 직접 바꾸며, 이 문서나 설정 파일 값만으로
현재 Parent 설정을 주장하지 않습니다. Host는 이 규칙을 강제하지 않습니다(advisory).

- 공통 조건에 더해 같은 subject의 연속 non-PASS가 확인되면 **quality stop**입니다. 해당 작업의 무인 계속을 멈추고 원인을
  먼저 구분합니다.

## OMC 공존과 skill routing

저장소 작업의 지침 우선순위는 **현재 요청 > `AGENTS.md`·`CLAUDE.md` > 이 adapter > OMC·Home 권장**입니다.

- OMC agent·skill은 선택적 보조입니다. 보조 조사와 저장소에 쓰지 않는 초안(제안)만 만들고, Parent가 검토해 채택합니다.
- 위임한 저장소 쓰기와 필수 독립 QA는 **등록·정산된 KNU 역할**만 충족합니다. 정산은 `complete`(또는 `settle --judgment`)와
  Parent 작성 변경의 `settlement:"parent-adjudication"` 판정을 포함합니다. Lead 직접 구현은 그대로 허용됩니다.
- KNU hook은 KNU 역할·marker 호출에만 적용되어 OMC 사용을 막지 않습니다(hook 자체 오류의 남는 한계는 [운영 보장과 제한](./claude-native-registry.md#운영-보장과-제한)).
  이 규칙은 runtime 차단이 아니라 운영 규칙입니다.

| OMC 요청·skill                          | 저장소 workflow owner                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `plan`, `ralplan`, `deep-interview`     | [Plan authoring](../plan-authoring/core.md). OMC 초안은 `.plans` 계획으로 채택하기 전 제안입니다.          |
| `execute`, `autopilot`, `ralph`, `team` | [Branch와 PR 전략](../../github/branch-and-pr-strategy.md)과 Lead 직접 구현 또는 `knu_executor` 위임       |
| `review`, `verify`, code reviewer       | [QA](../qa.md#independent-review-disposition)의 필수 독립 review는 `claude:native review`와 `knu_reviewer` |
| `research`, document specialist         | 공식 근거가 acceptance에 필요하면 `knu_researcher`                                                         |
| `wiki`, `remember`, notepad             | Local memory입니다. Source of truth가 아닙니다(`AGENTS.md` §1)                                             |

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

### 저장소 root와 runtime state 위치

- Claude Code는 저장소 root에서 시작하고, Bash에서 하위 디렉터리로 작업 위치를 영구히 옮기지 않습니다. 하위 경로는
  절대 경로, `git -C <dir>`, 명령 인자, 또는 subshell `( cd <dir> && … )`로 다룹니다.
- OMC 5.5.0에서는 hook이 넘긴 작업 위치를 state root 계산에 그대로 써서, 하위 디렉터리에서 도구를 호출하면 그 위치에
  `.omc`가 생기는 것을 관측했습니다. 추적 파일 `.omc-workspace`는 OMC가 위로 올라가며 찾는 표식이라 state를 root `.omc`로
  모읍니다. OMC를 쓰지 않는 설치에는 영향이 없습니다.
- Agent가 만든 screenshot·log·검증 출력은 `.omc`가 아니라 [`.artifacts/`](../../../../.artifacts/README.md#배치-규칙)에 둡니다.
- `pnpm check:fast`(pre-commit)는 `scripts/git/workspace-layout-check.mjs`로 root 밖 `.omc`·`.omx`와 이름을 바꾸기 전의 local 작업 공간 root를 탐지해 commit을 멈춥니다. 탐지이지 차단 장치가 아니므로 발견하면 내용을 옮기고
  원인이 된 작업 위치를 바로잡습니다.

## Project visual skills

Taste (`design-taste-frontend`)와 Redesign (`redesign-existing-projects`)은 **Codex-only**입니다. Claude에 이식·설치·호출하지
않으며 개인 Codex skill을 수정하지 않습니다. Claude UI 작업은 공통 VisualBrief/content/a11y/독립 검토 계약을 직접
따르고 대체 skill 설치를 요구하지 않습니다. [Visual skill 선택](../visual-design/design-task-orchestration.md#task-fit-skills)을
참고합니다.
