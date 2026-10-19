# Claude same-host independent review

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## Same-host independent review

Reviewer 입력은 `pnpm claude:native review`로 만듭니다. `--subject <taskId>`만 주면 관측이 정산된 subject의 이번 회차
`snapshotDigest`와 `logHeader`를 출력하고, 완료 관측이 없으면 거부합니다. Runner는 `logHeader`를 검증 로그 첫 줄에 두고
각 실행을 `{command, exit, environment, observedResult, outputPaths, sourceDigest}` 기록으로 남깁니다. 수정 전 실패를 보이는
RED 기록은 `purpose:"red"`와 1~255의 `expectedExit`를 함께 두며, 실제 exit가 기대와 같을 때만 known failure가 아닙니다.
다른 exit(0 포함)는 known failure이고 기대·실제 exit는 packet `tests`와 결과 template에 함께 보입니다. Exit를 뒤집는 명령으로 기록하지 않습니다. `--runner-evidence`·
`--basis`·`--reviewer-model`을 더하면 packet, reviewer prompt, 결과 template, reviewer용 prepare spec이 나옵니다. Runner 기록의
`sourceDigest`가 이번 회차 digest가 아니거나 필드가 다르면 거부합니다. `--basis`가 안전한 참조 형식이 아니면 packet 파일을 쓰기 전에
`unsafe-reference:selectionBasisRef`로 거부합니다. Native subject의 read path는 subject `readScope`·쓰기 범위·
변경 경로와 runner 출력 경로이고, Parent subject의 read path도 subject `paths`와 runner 출력 경로를 함께 담습니다. Writer subject의 응답·추론은 packet과 prompt에 넣지 않습니다. Read-only subject는 응답이
산출물이므로 helper가 정산된 응답을 subject task 디렉터리의 `subject-response.txt`에 한 번 쓰고 read path 맨 앞에 두며, prompt는
그 주장과 자기평가가 근거가 아니라고 적습니다. Parent가 응답을 옮겨 적는 parent-adjudication으로 우회하지 않습니다. Template의
`commandsActuallyRun`은 runner 기록에서만 채우고, 정산 때 reviewer 결과가 prompt에 결속된 그 기록과 같아야 합니다. Reviewer spec은 유일한 reviewer 조합(`knu_reviewer`·`complex-critical`)과
review 필수 facts를 `--basis` 출처로 채운 초안이며, Lead가 확인한 뒤 `prepare`에 넘깁니다. `--parent-subject`는 등록할 세션을
알 수 없으므로 `--session`이 필요합니다. Helper는 complete를 호출하지 않으며 정산은 아래 규칙을 따릅니다.

독립 리뷰의 근거는 이 절차로 등록한 `knu_reviewer` task의 관측뿐입니다. Host 자체 리뷰(built-in `/code-review`, Ultracode·Workflow
리뷰, fork 자식, Codex Ultra 자식)의 결과는 OMC code-reviewer와 같은 보조 의견이며 PASS·builder 완료·finding 처분의 근거가
아닙니다.

Parent subject의 `request`는 요구사항(사용자 요청·issue·plan acceptance)이고 구현 설명·추론·자기평가를 넣지 않습니다. `review`는
`paths`의 `.omc/`·`.omx/`·`.codex/state/`·`.claude/projects/` 아래 경로, Home(`~`) 경로, 절대 경로를 `local-state-path:<path>`로
거부합니다. 추적 `.claude/` 설정·skill·역할 파일은 local state가 아닙니다. `request`에 완료형 구현 서술 문장(`고쳤다`·`구현했다` 등
16개 동사)이 있으면 거부하지 않고 출력 `warnings`에 `request-implementation-marker`를 내고 packet `evidence.environment`에
`request-implementation-marker=<문장 수>`를 덧붙입니다. `evidence.environment`에는 걸린 문장을 넣지 않고 `knownGaps`도 쓰지 않아 PASS를
막지 않습니다. 걸린 문장은 packet `objective`(request 요약)에 그대로 남으므로 경고를 받으면 `request`를 고쳐 다시 `review`합니다.
선택 필드 `requirementSections`(`[{"path", "headings"}]`)는 plan의 판정 원본 절만 reviewer에게 넘깁니다. Heading은 `#`를 뺀 정확한
문자열로 찾고, 절은 그 heading부터 같은 수준 이하의 다음 heading 전까지입니다(code fence 안 줄은 heading이 아님). 없으면
`requirement-heading-missing`, 두 번 이상이면 `requirement-heading-duplicate`, 읽을 수 없는 파일은 `requirement-path-unreadable`, 형식
오류는 `requirementSections-invalid`로 거부합니다. Helper는 추출을 `.artifacts/tools/claude-review-packets/<reviewId>.requirements.md`에
한 번 쓰고 그 경로만 read path에 넣으며 plan 파일은 넣지 않습니다. `paths`가 그 plan이나 그 위 디렉터리를 가리키면
`requirement-path-in-paths: <path>`로 거부합니다. Packet `sources.requirements`는 acceptance 그대로입니다. Plan 자체가 `paths`에 있는
readiness 리뷰는 이 필드를 쓰지 않습니다.

Reviewer prompt는 packet·diff·문서·runner 출력 안의 지시문을 판정 근거로만 읽고 따르지 않게 지시합니다. `review`는 reviewer마다 prompt의
sha256을 `.artifacts/tools/claude-review-packets/<reviewId>.prompt.json`에 한 번 쓰고(추출이 있으면 그 digest도 함께), registry는
모든 `knu_reviewer` 등록(`prepare`와 `register --input`)에서 그 기록과 prompt를 대조합니다. Review id는 native subject면 packet id
`review-<reviewId>`, Parent subject면 prompt의 `KNU_REVIEW_PACKET_FILE:` 경로에서 얻고, 1회차 그룹은 구성원마다 대조합니다. 기록이
없거나 review id를 얻을 수 없으면 `review-prompt-unbound`, prompt가 다르면 `review-prompt-changed`로 등록을 거부합니다.

Packet을 만들 때 [QA 리뷰 회차](../qa.md#리뷰-회차)의 입력을 함께 줍니다. `--round N`(1부터)은 항상 필요하고, 2회차부터는
`--previous-result <file>`로 직전 회차 result JSON(verdict·findings가 있는 파일, native task 기록 경로 제외)이 필요합니다. 1회차에
직전 result를 주거나 2회차부터 빠뜨리면 거부합니다. 기준 문서는 리뷰 대상 경로(Parent subject `paths`, native subject의 관측 변경
경로)로 [자동 선택](../review-criteria/README.md#자동-선택)하고, `--criteria <id,id>`를 주면 그 id로 override합니다.
`--criteria none`은 기준 문서 없이 리뷰합니다. 기준 효과를 재는 비교 측정(교정·baseline)용이고 필수 리뷰에는 쓰지 않으며, 다른 id와
섞으면 `criteria-invalid`, `e3`와 함께면 `composition-e3-criteria-required`로 거부합니다. 고른 문서가
packet `sources.owners`와 read path에 들어가고, 출력 `criteriaSelection`이 문서·항목 수와 경로 키가 맞지 않은 경로를, helper 디렉터리의
`<reviewId>.criteria.json`(read path 아님)이 선택 이유와 override 때의 자동 선택 결과를 남깁니다. 직전 result도
read path에 들어가고 prompt에 경로와 sha256 digest가 남습니다. Reviewer prompt는 회차에 따라 보고 범위를 다르게 지시합니다.
1회차는 넓게 보고하고 low를 5건까지, 2회차부터는 blocking finding만 보고합니다. 두 경우 모두 finding 0건을 허용하고, 기준
문서가 있으면 미충족 항목 id를 finding `criteriaItem`에 하나만 적고 기본 severity를 쓰게 합니다.

1회차에는 `--composition e2|e3 --reviewers 2|3`으로 같은 snapshot의 reviewer 그룹을 만들 수 있습니다. 1회차가 아니면
`composition-round-1-only`, 인원이 2·3이 아니면 `reviewers-invalid`, 둘 중 하나만 주거나 모르는 구성이면 `composition-invalid`로
거부합니다. 출력은 구성원마다 packet·prompt·결과 template·spec을 담은 `reviewers[]`와 `group`입니다. 구성원은 snapshot·acceptance가
같고 `packetId`·`dispatchId`가 다르며 reviewer id는 `reviewer-<i>`입니다. Native subject는 read path가 같고, Parent subject는
구성원마다 자기 packet 파일만 다릅니다. 각 prompt 둘째 줄은 `KNU review group <groupId> <i>/<N> <e2|e3>`이고 등록 digest로
결속됩니다. Prompt는 finding id를 `m<i>-`로 시작하고, 결과가 PASS가 아니면 각 coverage gap과 `knownGaps` 항목에 원인 finding id를
적게 합니다. `e3`는 기준 문서(자동 선택이나 `--criteria`)가 필요하고(`composition-e3-criteria-required`) 고른 기준 문서의 `### <문자><번호>.` 항목을 순서대로
이어 구성원 수만큼 연속 구간으로 나누고, 배정 항목은 finding `criteriaItem`과 같은 형식(`documents.md D2`)으로 적습니다. 항목이
구성원보다 적으면 `criteria-items-too-few`입니다. 구성원은 배정 항목을 빠짐없이 판정하고 다른 항목의 blocking 결함도 보고합니다. Acceptance coverage는 구성원 모두 전체를 채웁니다. 모든 prompt가 상한 안에
들어온 뒤에만 packet 파일을 씁니다. 계획 readiness 리뷰는 단일 reviewer입니다.

그룹 뒤 2회차는 단일 reviewer이며 `--previous-result`에 Parent의 `review-adjudication/v1` 처분 기록을 줄 수 있습니다. Helper는
기록을 `review-adjudication.mjs` validator로 검사하고 기록이 가리키는 각 result에도 직전 result와 같은 조건(root 안 일반 파일, native
task 기록 아님, verdict·findings JSON)을 적용합니다(`previous-result-invalid`·`previous-result-unreadable`). 기록과 각 result가 read
path에 들어가고 prompt에 경로와 digest가 남으며, prompt는 처분과 그 근거가 Parent의 주장이지 증거가 아니라고 적습니다.

Claude native reviewer는 공통 QA packet의 `same-host-independent-review` 방향을 사용합니다. 등록 입력의 선택적
`independentReview`는 `subjectTaskId`, `reviewerId`, `builderIds`, `packet`을 포함합니다. Registry는 실제 subject task와
관측 완료를 읽어 full request digest, binding, response, final snapshot에 packet을 연결합니다. Packet objective는 subject
request summary와 같고, write owner는 builder에 포함되며, reviewer는 builder와 다른 read-only lane owner여야 합니다.
Packet read scope는 reviewer task 범위 안에 있고 subject의 write ownership과 실제 변경 경로를 포함해야 합니다. Read-only
subject면 응답 artifact를 포함하고 그 내용이 정산된 응답과 같아야 하며, writer subject면 응답 artifact를 포함할 수 없습니다.
그 밖의 native task 기록(task·completion·transcript)과 그 상위 경로는 대소문자를 바꾼 경로, symlink, `.artifacts` 아래에서 연결된
디렉터리로도 read path가 될 수 없으며, helper는 runner 출력과 Parent subject 경로에서 먼저 거부합니다. `.artifacts` 밖
디렉터리 안의 symlink는 검사하지 않고 working tree 변경으로 snapshot에 드러나며, hard link는 탐지 대상이 아닙니다.
등록 뒤 artifact가 바뀌면 reviewer 입력 inventory 대조가 거부합니다. Subject의
모든 acceptance criterion은 reviewer completion에서 result coverage로 검사합니다. Reviewer는 packet `authority.runnerOwner`가
될 수 없습니다.
검증된 packet은 reviewer의 bound prompt에 포함되므로 caller가 실행 전에 바꾸거나 다른 subject에 재사용할 수 없습니다.

Reviewer는 같은 session에 있을 필요는 없지만 fresh session에서도 동일한 current source를 사용해 명시적으로 새 task를
등록해야 합니다. 이 조건을 충족한 terminal reviewer task만 자기 `reviewDisposition.required:false`를 사용할 수 있습니다.
이는 reviewer를 다시 review하는 무한 재귀를 막기 위한 종료 규칙이며 builder의 필수 QA를 해제하지 않습니다.

Reviewer complete 입력은 `reviewResult`를 사용합니다. 값은 실제 관측 응답에서 parse한 JSON과 구조적으로 같아야 합니다.
Native 관측 model의 일치를 별도로 확인한 뒤 공통 `validateAdapterReview`가 packet, current snapshot, 독립
reviewer/builder identity와 acceptance coverage를 검사합니다. `complete + PASS`와 `complete + FAIL`은 reviewer task의
terminal 결과가 될 수 있지만 FAIL은 builder PASS가 아닙니다. `partial`·`denied`·`timed-out`·`cancelled` 또는
`BLOCKED`는 reviewer completion이 아닙니다.

Reviewer는 write 범위가 비어 있으므로 정산 drift를 의존 집합으로 판정합니다([registry 8단계](./claude-native-registry.md)). 의존
집합은 등록 read 범위, packet `allowedReadPaths`, inputs manifest의 파일, child transcript의 Read 파일과 Grep·Glob 디렉터리입니다. 집합
안 변경이 없으면 `validateAdapterReview`의 current snapshot은 packet snapshot이고, complete 끝 fan-in의
`current-source-head-mismatch`·`current-source-diff-mismatch`·`current-untracked-input-mismatch`는 판정으로 대신해
`dependencyJudgment.replacedSourceGaps`에 남깁니다. 그래서 다른 세션의 집합 밖 편집·commit은 reviewer 결과를 무효로 만들지
않습니다. Fan-in의 다른 gap, adapter identity drift, 등록 전 `stale workflow`·`review-snapshot-stale`, builder 완료의 `review snapshot
mismatch` 대조는 그대로입니다. 저장소 전체로 판정하는 조건은 [registry 8단계](./claude-native-registry.md)를 따릅니다.

Read-only reviewer는 명령을 실행하지 않습니다. Packet `authority.runnerOwner`가 실행하고 evidence로 제공한 검증은 result의
`commandsActuallyRun`에 그 runner·exit·관측 결과·환경으로 기록하며 reviewer가 실행했다고 쓰지 않습니다. `notRun`은 누구도
수행하지 않은 필수 검증, `knownGaps`는 acceptance를 막는 미해결 gap이며, 공통 validator는 이 둘이나 coverage gap이 남은
PASS를 거부합니다. Parent는 필요한 runner 증거를 같은 source digest와 함께 packet에 먼저 제공하고, 실행되지 않은 검증을
PASS로 바꾸거나 reviewer에게 기대 결론을 전달하지 않습니다.

Builder complete 입력은 연결된 `reviewerTaskId`를 받습니다. Registry는 해당 reviewer의 실제 task·완료·result가 이
builder의 subject binding/full request/response/snapshot과 일치할 때만 공통 review wrapper를 파생합니다. Caller가 만든
별도 PASS 객체나 unrelated reviewer result로 대체하지 않습니다. Reviewer FAIL이면 Parent가 finding을 판정하고 builder는
PASS할 수 없습니다. 같은 subject를 실제로 dispatch한 다른 reviewer가 PASS가 아닌 receipt를 남겼거나, 완료 기록에 PASS가 아닌
결과를 전달했거나, 정산 전에 release되어 결과가 기록되지 않았다면 다른 reviewer의 PASS를 연결해도 builder는 완료되지 않습니다
(PASS가 아닌 결과를 처분 기록으로 마감하는 1회차 그룹 예외만 아래에 둡니다).
읽을 수 없는 native task·receipt·완료 기록도 완료를 막습니다. 예외는 다른 checkout에서 복사된 task 기록(task.json의 `root`가 이 checkout과
다른 절대 경로)이 이 subject를 가리키지 않을 때뿐이며 그 기록은 건너뜁니다. Agent 호출 자체가 실패해 결과 없이 오류만 돌아온 시도와 등록만 하고
dispatch하지 않은 reviewer는 막지 않습니다. Hook은 reviewer task마다 한 번의 Agent 호출과 그 세션 transcript 경로만 기록합니다.
그래서 builder를 완료할 때 연결한 reviewer를 포함한 같은 subject의 모든 reviewer에 대해, 기록된 세션 transcript(연결한 reviewer가
비동기로 정산됐다면 그 정산 transcript)에서 reviewer marker를 가진 Agent 호출과 결과를 대조합니다. Hook이 기록한 호출이 아니면서
오류로 끝나지 않은(진행 중 포함) 호출이 있으면 hook이 놓친 dispatch로 거부합니다. Hook이 기록했지만 이후 다른 hook·규칙·classifier가
거부해 오류만 돌아온 호출은 미정산으로 막지 않습니다. 비동기로 정산된 reviewer의 child transcript가 정산 뒤 바뀌었다면(예: hook 장애 중
SendMessage 재개) 기록된 판정을 믿을 수 없으므로 거부합니다. Transcript를 읽을 수 없거나 한도를 넘으면 대조 불가로 거부합니다.
Transcript 경로가 없는 이전 형식의 attempt, 어떤 reviewer attempt도 남기지 않은 세션의 호출, 다른 subagent 안에서 호출돼 child
transcript에만 남은 Agent 호출은 대조하지 못하며 hook 장애 경계를 따릅니다. Foreground로 완료된 reviewer는 transcript proof가
없으므로 hook 장애 중이나 사용자가 subagent 화면에서 직접 재개한 경우를 감지하지 못합니다. Transcript는 비동기로 기록되어 완료 시점의
proof가 정상 경로에서도 어긋날 수 있으므로 이 경로에 proof를 강제하지 않습니다. Hook이 정상이면 SendMessage를 통한 재개는 그 단계에서 거부되지만, 사용자가 패널에서 직접 재개한 경우에는 hook이 관여하지 않습니다. 거부 사유별 해소는
[등록·리뷰 거부](../../troubleshooting/tooling/claude-native-registration-and-review-rejections.md)를 따릅니다. 이는 [QA](../qa.md)의 Parent adjudication보다 엄격한 adapter 규칙입니다. Parent가 finding을
false positive로 판정해도 native 경로에서는 새 builder task와 새 review로 해소합니다. 유일한 예외는 아래
[builder 완료와 1회차 그룹](#builder-완료와-1회차-그룹)입니다. 이 연결은 coordination과 completion evidence이며
host 인증이나 권한 grant가 아닙니다. Parent가 직접 작성한 diff처럼 native subject task가 없는 검토에는 이 terminal 규칙이
적용되지 않습니다. 이때 `review --parent-subject <file>`은 `settlement:"parent-adjudication"`과 QA가 필요한 일반 review task spec을
만듭니다. Packet은 prompt에 싣지 않고 helper가 `.artifacts/tools/claude-review-packets/<reviewId>.json`(ignored, native 증거
경로 아님)에 상한 검사를 통과한 뒤 한 번 씁니다. Prompt에는 `KNU_REVIEW_PACKET_FILE:<경로> <sha256 digest>` 한 줄이 남고, 그
경로가 reviewer read 범위에 들어갑니다. `settle --task`는 `reviewPacket`(경로, 기대·현재 digest, 성공한 `Read` 관측)을 더하고,
읽지 않았으면 `review-packet-unread`, 파일이 바뀌었으면 `review-packet-changed`, Parent reviewer prompt에 packet 파일 줄이
없으면 `review-packet-missing`을 `observationErrors`에 넣습니다(그런 prompt는 등록부터 `review-prompt-unbound`로 거부됩니다).
등록한 prompt나 read 범위가 `requirementSections` 추출을 가리키면 `reviewRequirements`(경로, 기록·현재 digest)를 더하고, 추출이 prompt 기록의 digest와
다르거나 기록이 없으면 `review-requirements-changed`를 넣습니다. 그 reviewer는
`complete`로 PASS 정산되지 않으며, Parent가 reviewer의 `settle --task` 출력에서 `observationErrors`가
비었는지(effort 판정 포함)와 모델·변경 경로, finding 재현으로 판정합니다. Settle은 prompt 첫 줄 `logHeader`의 snapshot을 의존 집합
안 변경이 없으면 등록 snapshot과, 있거나 저장소 전체 판정이면 `finalSnapshot`과 대조해 다르면 `review-snapshot-mismatch`를 넣고,
판정을 `dependencyJudgment`로 냅니다. Effort는 관측 때 판정하므로 `completion.json`의 `valid`만으로는 판정하지 않습니다. Review prompt 첫 줄의 회차 digest가
현재 source와 다르면 `prepare`가 `review-snapshot-stale`로 거부합니다. 이 경로는 새 binding이나 gate 완화가 아닙니다.

Review snapshot은 tracked·비ignored 파일만 결속하므로 ignored 리뷰 입력(계획, 증거, runner 출력, 2회차 직전 결과와 처분 기록)은 helper가
따로 결속합니다. 대상은 reviewer read path 중 ignored read path 아래 파일과, 어느 read path든 그 아래 `.plans/`·`.artifacts/`·
`.local-docs/`(기록 위치) 안의 ignored 파일입니다. Helper 디렉터리의 파일(packet·manifest는 prompt 줄이, requirement 추출은 prompt
기록이 결속)과 native task 기록은 빠지고, 그 밖의 비ignored
디렉터리 안 ignored 파일(package 의존성·build 산출물)은 결속하지 않습니다(known limit). Helper는 파일마다 digest(mode·bytes, symlink는
링크 문자열)를 `.artifacts/tools/claude-review-packets/<reviewId>.inputs.json`에 한 번 쓰고 prompt 마지막 줄에
`KNU_REVIEW_INPUTS_FILE:<경로> <sha256 digest>`를 둡니다. 대상이 없으면 줄도 없습니다. 2,000개·파일 8 MiB·합계 32 MiB를 넘으면
`review-input-too-large`로 review를 만들지 않습니다. 1회차 그룹은 구성원마다 자기 manifest를 갖습니다.

`prepare`·`settle`·builder 완료는 줄이 아니라 등록된 read 범위에서 대상을 다시 계산합니다. 대상이 있는데 줄이 없으면
`review-input-manifest-missing`, 줄·경로·파일이 틀리면 `review-input-manifest-invalid`, manifest 파일이 바뀌면
`review-input-manifest-changed`, 파일이 생기거나 사라지거나 바뀌면 등록은 `review-input-stale: <path>`, 정산은
`review-input-changed:<path>`입니다. Read path가 저장된 이름과 대소문자만 다르면 Git이 아무 파일도 내지 않으므로
`review-input-path-case`로 거부합니다. Builder 완료는 연결 reviewer를 대조하고, 1회차 그룹의 non-PASS 구성원을 처분 기록으로 마감할
때는 결과를 전달한 구성원마다 이 대조를 해 구성원 task id를 괄호로 붙입니다. 그래서 `review` 생성부터 그 reviewer 정산·연결 builder 완료까지 리뷰 입력인 ignored 경로를 바꾸지
않고, 정산 뒤 쓰는 result·처분 기록·재현 로그는 리뷰 read path(디렉터리 포함) 밖에 둡니다. Runner가 실행된 시점의 입력은 결속하지
않으므로 마지막 입력 수정 뒤 runner를 실행하고 바로 `review`를 만듭니다.

## Builder 완료와 1회차 그룹

같은 subject의 reviewer 중 PASS가 아닌 것이 있어도, 연결한 reviewer가 1회차 그룹의 PASS 구성원이고 builder 판정에
`reviewAdjudication`(root 기준 `review-adjudication/v1` 처분 기록 경로)이 있으면 아래를 모두 만족할 때만 그 non-PASS가 완료를 막지
않습니다. 하나라도 어기면 기존 거부 사유와 함께 괄호 안 사유가 남습니다.

1. 처분 기록이 있습니다(`review-adjudication-required`).
2. 같은 subject에 dispatch된 모든 reviewer가 연결한 reviewer와 같은 group id·인원·구성의 그룹 줄을 갖고, 번호가 인원 이하입니다
   (`review-group-mismatch`). 그룹 밖 reviewer는 PASS여도 거부합니다. 실패가 기록된 Agent 호출(PostToolUseFailure)을 뺀 구성원의
   번호는 서로 다릅니다(`review-group-duplicate-member`). Hook 뒤에 거부되어 Post 이벤트가 없는 호출은 completion이 없어 빠지지
   않습니다. 결과가 JSON result 객체가 아니거나 receipt를 읽을 수 없는 non-PASS 구성원은 처분 대상에서
   빠지지 않고 완료를 막습니다(`review-group-unreadable-member`). 그룹 줄이 없는 단일 reviewer의 FAIL은 처분 기록으로 마감하지 않습니다.
3. 처분 기록이 validator 위반 없이 round 1이고, `reviews`가 결과를 전달한 구성원 전부를 가리키며, 각 `resultPath`가 그 구성원이 전달한
   result와 구조적으로 같습니다(`review-adjudication-invalid`, `review-adjudication-result-mismatch`). 기록과 result는 root 안 일반
   파일이고 native task 기록이 아닙니다.
4. Non-PASS 구성원은 `notRun`이 비어 있고(`review-not-run-not-rejectable`) blocking finding(critical·high·medium)이 하나 이상 있으며,
   null이 아닌 각 coverage gap과 각 `knownGaps` 항목이 그 구성원의 blocking finding id를 token으로 담습니다(`review-gap-not-rejectable`;
   `m2-F1`은 `m2-F10`에 맞지 않음). Finding id는 result의 `id`, 없으면 `<taskId>#<index>`입니다. 다른 구성원의 PASS는 근거가 아닙니다.
5. 전달된 severity나 기록 severity가 blocking인 finding은 직접 또는 `duplicateOf` 대상의 처분이 `rejected`입니다
   (`review-blocking-not-rejected`).
6. 각 `rejected`의 `reason`이 backtick으로 `.artifacts/` 아래 재현 로그를 하나 이상 가리키고, 그 파일은 native task 기록도 구성원
   packet의 runner 출력(`evidence.sanitizedLinks`; 다른 경로 표기와 같은 bytes의 사본 포함)도 아니며 첫 줄이 `KNU review snapshot <builder 최종 snapshot digest>`입니다
   (`review-rejection-unbound`).

미정산·release된 구성원, 정산 뒤 child transcript가 바뀐 구성원, 읽을 수 없는 기록, hook이 놓친 dispatch는 처분 기록으로 풀지 않습니다.
구성원이 모두 FAIL이면 연결할 PASS가 없으므로 새 builder task와 새 review로 갑니다. 처분 기록은 ignored 경로지만 완료 때 내용으로 직접
대조합니다. Parent 작성 diff의 그룹 집계·기각은 같은 기록과 같은 재현 로그 규칙을 `/knu-settle`이 요구할 뿐 runtime 강제는 없습니다.
회차 번호와 "같은 변경"의 판단은 Parent가 선언하며, 내용이 같은 새 builder task로 새 1회차 그룹을 만드는 경로는 runtime이 구별하지
못합니다.

Native writer는 repository당 하나의 active lease로 직렬화합니다. 확인된 완료/관측된 tool failure는 해당 task의
lease만 해제합니다. 비동기는 완료 알림 뒤 complete가 회수합니다. 세션 종료·취소·권한 거부로 Post 이벤트가 없으면 실제 child 종료를 먼저 확인한 뒤
`pnpm claude:native release --task <taskId> --ended`로 그 task만 해제합니다. Timeout/만료를 종료 증거로 추측하지
않습니다. Release는 작업 완료가 아니며 다른 writer의 lease를 삭제하지 않습니다.
