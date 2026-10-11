# Claude native registry

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## 일반 interactive auto 세션

기본 실행은 `claude --permission-mode auto`입니다. [시작과 승인 안내](../getting-started.md#claude-code-실행과-승인)를
따르고 실제 UI에서 auto 적용을 확인합니다. Home·project 설정과 owner가 사용 중인 OMC를 그대로 로드합니다.
`--safe-mode`, `--restricted`, project-only settings, 빈 MCP, 강제 tool 축소로 운영 환경을 대체하지 않습니다.
새 세션의 project `.claude/settings.json`은 hook만 추가하며 permission mode/allow/deny·plugin 설정을 덮어쓰지 않습니다.

`scripts/agents/claude/native-session.mjs`는 별도 Claude 프로세스를 만드는 launcher가 아니라 현재 세션의
SessionStart → task 등록 → native Agent PreToolUse → PostToolUse/Failure → SubagentStop·완료 알림 → 공통 QA 연결입니다.

1. SessionStart의 `session_id`를 사용합니다. cwd·최근 artifact에서 세션을 추측하지 않습니다.
2. Lead가 현재 요청·source·역할·acceptance·read/write 범위·QA 필요 여부와 [task profile](./claude-model-profiles.md#finite-native-subagent-model-candidates)을 명시합니다.
3. `pnpm claude:native register --input <JSON file>`로 task를 등록합니다. 입력은 `workflowInput`, `sessionId`,
   `prompt`, `expectedResolvedModel`입니다. `workflowInput`은 `prepareClaudeWorkflow`의 입력이며
   `nativeRequest`에 profile·선택 근거·task facts·issuedAt/expiresAt, `directAssignment`에 owner/dispatchId/
   acceptance/writeOwnership, `reviewDisposition`에 required/reason을 둡니다. currentSnapshot 생략 시 현재 Git을
   읽고, 제공하면 현재 source와 대조합니다. 임의 모델·역할 pin 대신 기존 model-policy를 재사용합니다. 독립 reviewer는
   [`independentReview`](./claude-same-host-review.md#same-host-independent-review)를 추가하며 일반 task의 QA disposition을 임의로 끄지 않습니다. 등록이 거부되면
   [등록·리뷰 거부](../../troubleshooting/tooling/claude-native-registration-and-review-rejections.md)를 확인합니다.
   일상 경로는 `pnpm claude:native prepare --spec <JSON file>`입니다. Spec에는 `sessionId`·`request`와 Lead가 고른 `role`·
   `profileId`·`selectionBasisRef`(필수)·`expectedResolvedModel`·task 분류(`kind`·`impactRisk`·`complexity`·`uncertainty`·
   `childValue`)·`owner`·read/write 범위·`acceptance`·`reviewDisposition`·`facts`(각 `confidence` 포함)·`prompt`만 둡니다.
   선택 필드는 `lifetimeMinutes`·`independentReview`·`recovery`뿐이며 다른 필드는 `unknown-field`로 거부합니다.
   `recovery`는 [Recovery 결속](#recovery-결속)을 따릅니다. Helper는 수명(기본 15분, 최대 30분)·role 파일의 도구 목록·ID를 채워 같은 register를
   호출하고 거부 사유를 policy 사유와 입력 필드까지 그대로 보여 줍니다. Profile을 추론하거나 dispatch를 승인하지 않으며
   출력은 `dispatchAuthorized:false`입니다.
4. 반환한 `agentInput` 객체 그대로 **현재 세션의 Agent 도구**를 호출합니다. `agentInput`은 등록 invocation과 같은 역할·model·description에
   prompt로 task marker 한 줄(`KNU_NATIVE_TASK:<taskId>:<digest>`)만 가집니다. 정상 PreToolUse는 전체 invocation과 같은 검사를 거친 뒤
   `updatedInput`으로 등록 invocation 전체를 child 입력에 주입합니다. 반환한 `invocation`을 그대로 호출해도 같은 검사로 동작합니다.
   model 누락·임의 변경·미지원 인자·prompt 변경·다른 session·만료·재사용·source drift는 두 입력 모두 같은 사유로 거부됩니다.
   이 등록은 업무/host 승인이나 악성 로컬 프로세스에 대한 인증 수단이 아닙니다. task artifact는 `.artifacts/tools/claude-native/`가 소유합니다.
   주입은 fail-open입니다. Hook이 실행되지 않으면 child는 marker 한 줄만 받고 PostToolUse 관측이 없어 `complete`가
   `no-completion-observation`으로 거부합니다([완료 관측 누락](../../troubleshooting/tooling/claude-native-completion-observation-missing.md)).
   다른 hook이 같은 입력을 다시 바꾸면(마지막 hook이 이김) PostToolUse 입력이 invocation과 달라 검증되지 않고 완료도 같은 사유로 거부됩니다.
   이때 writer task의 lease가 남으면 child 종료를 확인한 뒤 `pnpm claude:native release --task <taskId> --ended`로 해제합니다.
   관측 범위(Claude Code 2.1.285): background 호출에서 10,910자 invocation prompt가 그대로 주입됐습니다. Foreground 호출과
   linked reviewer invocation(12,000자 prompt와 review packet)의 주입은 관측하지 않았습니다. 주입이 적용되지 않은 task는 검증 실패로 끝나고
   같은 task는 다시 호출할 수 없습니다(`task already attempted`). Hook이 attempt를 먼저 기록하므로 hook 뒤에 호출이 거부된 task(auto
   classifier 판정 누락 등)도 같습니다. Child 종료를 확인하고 필요하면 lease를 해제한 뒤 새로 `prepare`한 task를
   전체 `invocation`으로 호출합니다.
5. 정상 PreToolUse는 `allow`를 반환하지 않습니다(주입도 결정 없는 `updatedInput`). 기존 auto classifier·permission rules·다른 hook이 계속 판단합니다.
   KNU role 또는 KNU marker를 가진 호출만 적용하고, 기존 OMC/기타 역할의 모델 통제를 대신하지 않습니다.
   필수 KNU 작업을 OMC 역할로 바꿔 이 계약을 피하지 않습니다([OMC 공존](./claude-code.md#omc-공존과-skill-routing)).
6. Auto의 Agent는 background로 시작될 수 있고 현재 schema에는 `run_in_background` 입력이 없습니다. PostToolUse의
   `async_launched`는 같은 session/tool/input의 child ID·요청 모델 관측만 저장하며 완료가 아닙니다. SubagentStop도
   다시 실행될 수 있으므로 종료 보장으로 취급하지 않습니다. 같은 child/tool의 부모 `task-notification completed`와
   Stop, 한정된 child transcript의 최초 prompt·실제 assistant 모델·handback/마지막 응답을 함께 대조합니다.
   transcript는 CLI 2.1.283 실측 schema이며 지연 flush는 complete에서 같은 Stop에 한해서 재검사합니다.
   Parent transcript는 해당 child ID·task marker가 있는 행만 파싱합니다. Child transcript 32 MiB/parent 128MiB 한도를 넘으면 gap이지 PASS가 아닙니다. Child 한도는 메모리 보호이며 그 아래에서는 모든 행을 검사합니다. 누락·다른 모델·재개에 따른 transcript
   변경을 거부하고 output은 semantic PASS로 자동 승격하지 않습니다. Bound child에 대한 SendMessage 재개는 새 등록
   없이 허용하지 않습니다. OMC의 다른 child messaging은 이 registry가 소유하지 않습니다.
7. `pnpm claude:native complete --task <taskId> --input <JSON file>`로 결과를 판정합니다. 입력은 공통 `results`,
   관측한 `responseDigest`, `acceptance` 배열의 criterion/passed/evidenceRef, 그리고 독립 QA가 필요한 builder의
   `reviewerTaskId` 또는 reviewer task 자신의 `reviewResult`입니다. 별도 `review` 객체로 대체하지 않습니다.
   일상 경로는 완료 알림 뒤 `pnpm claude:native settle --task <taskId>`로 관측을 정산해 판단할 응답·`responseDigest`·
   변경 경로를 보고, `settle --task <taskId> --judgment <JSON file>`로 판정하는 두 단계입니다. Judgment에는 Lead가 판단한
   응답의 `responseDigest`, `acceptance`, `checks`(필요하면 `findings`·`gaps`·`reviewerTaskId`)만 둡니다. Helper는 lane ID·
   finalSnapshot·관측된 변경 경로와 reviewer가 전달한 결과를 기록에서 채워 같은 complete를 호출합니다. 완료 관측이 없으면
   정산하지 않고, native subject가 없는 reviewer는 `parent-adjudication`으로 거부합니다.
   첫 단계는 task evidence 디렉터리에 `judgment-template.json`을 한 번 쓰고 `judgmentTemplatePath`로 알려 줍니다. Template에는
   `responseDigest`와 acceptance 기준이 채워져 있고, 독립 QA가 필요한 builder면 `reviewerTaskId: null`이 있습니다. Lead는 기준별
   `passed`·`evidenceRef`, `checks`와 필요하면 `reviewerTaskId`만 채워 그 파일을 `--judgment`로 넘깁니다. 다시 조회해도 편집한 파일은
   덮어쓰지 않습니다. 채우지 않은 항목은 `acceptance-unfilled:<기준 또는 순번>`·`reviewer-task-id-unfilled`·`checks-required`로
   complete 전에 거부됩니다. Template은 입력 보조이며 판정이 아닙니다. Native subject가 없는 reviewer에는 template이 없습니다
   (`judgmentTemplatePath: null`).
   강도: background 호출의 이 순서(알림 전 거부 → 관측 정산 → template → judgment 검증 → complete)는 helper를 쓸 때만
   결정적(deterministic-static)입니다. `complete`를 직접 호출해 우회해도 완료 관측이 없으면 `no-completion-observation`, 판정 입력이
   부족하면 `semantic-acceptance-required`·`same-response-semantic-check-required`·`native required QA requires linked reviewerTaskId`로
   거부됩니다. Foreground 호출은 PostToolUse가 바로 완료를 기록하므로 알림을 기다리지 않습니다.
   Result의 snapshot은 completion.json의 finalSnapshot을 사용합니다. 같은 응답에 대한 acceptance와 독립 QA를
   실제로 수행해야 하며 boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다. Parent는 finding과 변경 범위를
   독립 확인합니다. 오류·거부·취소·collector 누락이면 완료를 보고하지 않고 원인과 다음 행동을 남깁니다.
   `no-completion-observation`은 [완료 관측 누락](../../troubleshooting/tooling/claude-native-completion-observation-missing.md)의 task 기록 기준으로
   원인을 구분합니다. Stop이 기록됐는데 정산되지 않으면 `stopped-task-settlement-failed: <사유>`가 함께 나옵니다.
8. 등록부터 정산까지 Parent는 tracked·비ignored 경로를 수정하지 않습니다. Collector는 등록·정산 시점 파일 목록의 차이 중
   child write 범위 안의 변경만 child 변경으로 기록하고, 범위 밖 변경은 누가 바꿨는지 알 수 없으므로
   `unattributable-change:<path>`로 거부합니다. Write 범위 안의 Parent 수정은 구분할 수 없습니다. 그래서 이 세션의 writer
   task가 실행되는 동안 file guard(PreToolUse `Edit|Write|NotebookEdit`)가 Parent의 tracked·비ignored 경로 쓰기를 deny합니다.
   Bash·기타 도구 쓰기와 hook이 실행되지 않은 경우는 이 운영 규칙으로 막습니다
   ([Parent 동시 쓰기](../../troubleshooting/tooling/claude-native-parent-concurrent-write.md)). 같은 guard는 subagent가 native
   evidence(`.artifacts/tools/claude-native/**`)를 쓰는 것도 deny합니다. 완료 알림이 오면 편집 전에 먼저
   정산합니다. `--resume`한 세션의 완료 알림은 행 `sessionId`가 등록 세션이면 새 process `session_id`와 관계없이 대조합니다.
   Reviewer는 범위가 더 넓습니다. Helper가 ignored 리뷰 입력(ignored read path 아래와 `.plans/`·`.artifacts/`·`.local-docs/` 아래 ignored
   파일)을 manifest로 결속하므로 `review` 생성부터 그 reviewer 정산과 연결 builder 완료까지 그 ignored 경로를 바꾸면
   `review-input-stale`·`review-input-changed`로 거부됩니다([same-host 독립 review](./claude-same-host-review.md)). 정산 뒤 쓰는
   result·처분 기록·재현 로그는 리뷰 read path 밖에 둡니다.

### 운영 보장과 제한

- Auto의 목적은 일상 개발의 승인 병목 감소입니다. 읽기 전용은 reviewer/explorer의 역할 경계이지 전체 session의
  강제 모드가 아닙니다. Executor의 명시된 구현과 검증도 같은 workflow에서 다룹니다.
- 정적 entry의 `interactive-auto` eligibility와 실제 현재 session의 모델/권한 입증은 별개입니다. 전역
  `runtimeQualified:true`를 저장하거나 다른 session에 과거 PASS를 재사용하지 않습니다.
- Hook이 정상 실행될 때 요청 모델을 검사합니다. 실행 파일 부재·crash·malformed·timeout 또는 경쟁 설정으로
  hook이 작동하지 않으면 **실행 자체의 fail-closed를 보장하지 않습니다**. 누락된 pre/post 증거는 작업 완료를 막는
  기준이지 이미 일어난 실행을 취소하는 장치가 아닙니다. 이를 해결하려고 auto를 몰래 manual/bypass로 바꾸지 않습니다.
  진단과 복구는 [hook 장애와 완료 거부](../../troubleshooting/tooling/claude-native-hook-failure-and-completion-refusal.md)를 따릅니다.
- KNU hook이 실행된 뒤 오류로 끝나면 결과는 이벤트마다 다릅니다. PreToolUse는 exit 2로 그 호출을 막고, PostToolUse 계열은
  exit 2로 stderr를 Claude에게 보여 주되 막지 않습니다. SubagentStop·SessionStart는 exit 1(transcript의 non-blocking hook 오류)로
  끝나 child 정지를 막지 않습니다. 이 hook들은 다른 checkout에서 복사됐거나 손상된 task 기록을 건너뛰고, 그런 task는 완료
  판정에서 거부됩니다. 남는 한계: payload를 해석할 수 없거나(1 MB 초과·JSON 오류) 관리 대상 확인 전에 오류가 나면 exit 2가
  남아 비KNU 호출이나 정지를 막을 수 있습니다. 보장은 여전히 완료 판정 거부뿐입니다. File guard(`--hook --file-guard`)는
  별도 hook 항목이라 payload 오류를 포함한 모든 오류가 exit 1로 끝나며 편집을 막지 않습니다.
- FORCE 환경변수의 명시적 충돌은 hook에서 거부하지만 Home/managed/provider의 모든 모델 대체를 사전에 인증하는
  것은 아닙니다. 정상 환경을 scrub하지 않고 실행 후 모델을 확인합니다. 정상 설정 출처/role precedence와 충돌을
  관측하고 owner와 수정하며 Home/managed 설정을 자동으로 삭제·덮어쓰지 않습니다.
- Project hook/role/settings와 task source의 변경은 재등록이 필요합니다. Hook 장애 이후에도 prompt가 알아서
  준수했을 것이라 가정하지 않습니다. 새로운 설정·CLI 버전·역할·OMC 조합의 실제 지원은 해당 조합의 증거로 판단합니다.
- Auto mode 판정이 서버에서 누락되면 명령은 실행되지 않습니다. 연속 재시도, 권한 설정 자가 수정, tracked settings의 permission 규칙으로
  해결하지 않고 [classifier no verdict 대응](../../troubleshooting/tooling/claude-auto-classifier-no-verdict.md)을 따릅니다.
- 지원되는 auto 부모 모델과 child task 모델은 다른 선택입니다. Haiku child 가용성을 이유로 auto 부모도 Haiku로
  바꾸지 않습니다. [permission modes](https://code.claude.com/docs/en/permission-modes),
  [hooks](https://code.claude.com/docs/en/hooks), [설정 우선순위](https://code.claude.com/docs/en/settings)를 따릅니다.

### 프로젝트 역할과 실제 권한

| Role                 | 도구 선언                             | Effort  | 책임                                                 |
| -------------------- | ------------------------------------- | ------- | ---------------------------------------------------- |
| `knu_explorer`       | Read, Grep, Glob                      | `high`  | 한 repository 질문의 현재 source/owner/evidence 조사 |
| `knu_researcher`     | Read, Grep, Glob, WebSearch, WebFetch | `high`  | 이미 선택한 기술의 공식 근거 조사                    |
| `knu_executor`       | Read, Grep, Glob, Edit, Write, Bash   | `high`  | 명시적으로 소유한 구현·가까운 검증                   |
| `knu_executor_xhigh` | Read, Grep, Glob, Edit, Write, Bash   | `xhigh` | `knu_executor`와 같은 책임의 high-risk·상향 build    |
| `knu_reviewer`       | Read, Grep, Glob                      | `xhigh` | builder reasoning을 받지 않는 독립 source 검토       |

다섯 `.claude/agents/knu_*.md`는 effort를 고정하지만 영구 model pin은 없습니다([Model profiles](./claude-model-profiles.md)). 그렇다고 parent 자동 상속을 task별 승인된 모델 선택으로
간주하지 않습니다. Lead가 bounded responsibility·source·acceptance·read/write scope·단일 writer를 정합니다.
Child는 다른 child/외부 CLI로 재위임하지 않고 blocker를 Lead에 반환합니다. Reviewer의 테스트 제안은 실행 승인이 아니며
write-producing 테스트는 별도 runner가 소유합니다.

Role의 tools 선언은 실제로 해당 정의가 로드되고 host가 적용했을 때만 도구 제한입니다. 같은 이름의 managed/CLI/project/
user/plugin 정의와 parent permission mode를 확인합니다. Managed 역할 위치는 managed-settings directory 아래
`.claude/agents/`이며 파일명만으로 frontmatter `name` 충돌을 배제하지 않습니다. Parent의 `auto`·`acceptEdits`·
`bypassPermissions`는 child mode를 덮어쓸 수 있으므로 read-only 선언만으로 sandbox를 입증하지 않습니다.
[공식 subagents](https://code.claude.com/docs/en/sub-agents)의 현재 버전 규칙과 실제 session을 함께 확인합니다.

## Recovery 결속

[Recovery](./claude-code.md#recovery)의 재시도를 실패한 1차 task에 묶는 등록 규칙입니다. 단계는
[상향 사다리](./claude-model-profiles.md#recovery-상향-사다리)가 정합니다. 사유별 다음 행동은
[복구 등록 거부](../../troubleshooting/tooling/claude-native-registration-and-review-rejections.md#복구-등록-거부)를 따릅니다.

Spec의 `recovery`는 `{of: <1차 taskId>, cause}`입니다. Registry가 결속을 판정하고 `step`·`fromProfileId`·`fromRole`을 더해
`task.recovery`에 씁니다.

- `result-error`와 `omission`은 사다리를 한 단계 올립니다.
- `context-missing`은 같은 profile·역할로 다시 등록합니다(단계 0). Prompt에만 context를 보탤 수 있습니다.
- 단계 1·2의 재시도만 `complex-critical`의 critical signal 요구를 면제받습니다. 다른 admission 검사는 그대로 적용됩니다.

Registry는 workflow를 준비하기 전에 아래 순서로 판정합니다. 처음 걸린 사유 하나만 보고합니다. 판정 중에는 아무것도 쓰지 않습니다.

1. `recovery-cause`: `cause`가 세 원인 밖의 값입니다.
2. `recovery-not-bound`: 1차 task가 없거나 다른 세션의 task입니다. 사실이 다른 경우도 같습니다. 비교하는 사실은 `request`·
   `kind`·`impactRisk`·`complexity`·`uncertainty`·`childValue`·`owner`·`readScope`·`writeScope`·`acceptance`·
   `reviewDisposition`·`facts`입니다. 배열은 순서까지 같아야 합니다. 순서만 바꾼 spec은 다른 사실 묶음이고 marker도
   따로 씁니다. 그 우회는 아래 Lead 운영 규칙이 막습니다.
3. `recovery-chain`: 1차 task가 이미 재시도입니다. 재시도의 재시도는 없습니다.
4. `recovery-step`: 요청한 profile·역할이 원인에 맞는 사다리 단계가 아닙니다.
5. `recovery-not-ran`: 1차 task가 실행·관측되지 않았습니다. 1차 task에는 `attempt.json`과 `completion.json`이 있어야 합니다.
   저장된 관측이 유효해야 하고 현재 관측 오류가 없어야 합니다. 관측한 effort는 역할 effort와 같아야 합니다. Haiku는 effort
   대조에서 빠집니다. 1차 task 완료 뒤 working tree가 바뀌면(편집, commit, child 변경 되돌리기) 관측 오류가 생겨 이
   사유가 됩니다. 1차 task 완료부터 재시도 등록까지 tree를 바꾸지 않습니다.
6. `recovery-accepted`: 1차 task에 `accepted.json`이 있습니다.
7. `recovery-used`: 이 세션과 사실 묶음의 marker가 이미 있습니다. 같은 사실의 1차 task가 둘이어도 재시도 하나를 함께 씁니다.
   Superseded 1차 task는 `recovery-step` 다음에 바로 이 사유로 보고합니다. 재시도가 그 뒤 파일을 바꿔도 같습니다.

형식 오류는 이 순서 밖입니다.

- `recovery-format`: `recovery`가 `of`·`cause` 두 키의 객체가 아니거나 `of`가 task ID 형식이 아닙니다. `prepare`에서는 helper가
  먼저 거부합니다.
- `recovery-unregistered`: 입력의 `task.recovery`를 registry가 쓰지 않았습니다.

기록은 다음과 같습니다.

- 유효한 `complete`는 task 디렉터리에 `accepted.json`을 씁니다. 그 뒤 이 task에 결속하는 재시도는 `recovery-accepted`입니다.
- 결속한 재시도는 다른 등록 검사를 모두 통과한 뒤에만 기록합니다. 순서는 다음과 같습니다.
  1. Marker `.artifacts/tools/claude-native/recovery/<sessionId>/<fact digest>.json`을 배타적으로 만듭니다.
  2. 1차 task의 `recovery.json`에 재시도 `taskId`를 씁니다.
  3. 재시도의 `task.json`을 씁니다.
  4. 1차 task를 superseded로 표시합니다(`observation-error.json`의 `superseded-by-recovery`).
- Superseded 1차 task는 더 이상 완료할 수 없습니다.
- 거부된 등록은 아무것도 쓰지 않습니다.
- PreToolUse는 1차 task의 `recovery.json`이 이 재시도를 가리키지 않으면 `recovery binding mismatch`로 거부합니다.

상한과 한계는 다음과 같습니다.

- Registry는 결속한 재시도의 상한만 강제합니다. 세션과 사실 묶음마다 한 번입니다.
- `recovery` 없이 같은 사실을 다시 등록하면 일반 admission을 받습니다. 면제는 없습니다. 그 상한은
  [Recovery ceiling](../orchestration.md#recovery-ceiling)의 "이름만 바꾼 새 task로 상한을 초기화하지 않습니다"를 따르는
  Lead 운영 규칙입니다.
- 등록한 재시도가 실행되지 못해도 재시도 기회는 쓴 것입니다. 결속 만료(`expired binding`), 입력 파일 drift(`input file drift`),
  오래된 workflow(`stale workflow`), 주입 실패 뒤 `task already attempted`가 여기에 속합니다. 1차 task는 이미 superseded입니다.
  다른 재시도를 등록하지 않고 Owner에게 넘깁니다.
- 실패한 Agent 호출(PostToolUseFailure)은 해석된 모델이 없어 결속할 수 없습니다(`effective-model-mismatch`). Lead와 Owner가
  원인을 보고 다음 행동을 정합니다.
