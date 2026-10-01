# Claude same-host independent review

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## Same-host independent review

Reviewer 입력은 `pnpm claude:native review`로 만듭니다. `--subject <taskId>`만 주면 관측이 정산된 subject의 이번 회차
`snapshotDigest`와 `logHeader`를 출력하고, 완료 관측이 없으면 거부합니다. Runner는 `logHeader`를 검증 로그 첫 줄에 두고
각 실행을 `{command, exit, environment, observedResult, outputPaths, sourceDigest}` 기록으로 남깁니다. 수정 전 실패를 보이는
RED 기록은 `purpose:"red"`와 1~255의 `expectedExit`를 함께 두며, 실제 exit가 기대와 같을 때만 known failure가 아닙니다.
다른 exit(0 포함)는 known failure이고 기대·실제 exit는 packet `tests`와 결과 template에 함께 보입니다. Exit를 뒤집는 명령으로 기록하지 않습니다. `--runner-evidence`·
`--basis`·`--reviewer-model`을 더하면 packet, reviewer prompt, 결과 template, reviewer용 prepare spec이 나옵니다. Runner 기록의
`sourceDigest`가 이번 회차 digest가 아니거나 필드가 다르면 거부합니다. Native subject의 read path는 subject `readScope`·쓰기 범위·
변경 경로와 runner 출력 경로입니다. Writer subject의 응답·추론은 packet과 prompt에 넣지 않습니다. Read-only subject는 응답이
산출물이므로 helper가 정산된 응답을 subject task 디렉터리의 `subject-response.txt`에 한 번 쓰고 read path 맨 앞에 두며, prompt는
그 주장과 자기평가가 근거가 아니라고 적습니다. Parent가 응답을 옮겨 적는 parent-adjudication으로 우회하지 않습니다. Template의
`commandsActuallyRun`은 runner 기록에서만 채우고, 정산 때 reviewer 결과가 prompt에 결속된 그 기록과 같아야 합니다. Reviewer spec은 유일한 reviewer 조합(`knu_reviewer`·`complex-critical`)과
review 필수 facts를 `--basis` 출처로 채운 초안이며, Lead가 확인한 뒤 `prepare`에 넘깁니다. `--parent-subject`는 등록할 세션을
알 수 없으므로 `--session`이 필요합니다. Helper는 complete를 호출하지 않으며 정산은 아래 규칙을 따릅니다.

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

Read-only reviewer는 명령을 실행하지 않습니다. Packet `authority.runnerOwner`가 실행하고 evidence로 제공한 검증은 result의
`commandsActuallyRun`에 그 runner·exit·관측 결과·환경으로 기록하며 reviewer가 실행했다고 쓰지 않습니다. `notRun`은 누구도
수행하지 않은 필수 검증, `knownGaps`는 acceptance를 막는 미해결 gap이며, 공통 validator는 이 둘이나 coverage gap이 남은
PASS를 거부합니다. Parent는 필요한 runner 증거를 같은 source digest와 함께 packet에 먼저 제공하고, 실행되지 않은 검증을
PASS로 바꾸거나 reviewer에게 기대 결론을 전달하지 않습니다.

Builder complete 입력은 연결된 `reviewerTaskId`를 받습니다. Registry는 해당 reviewer의 실제 task·완료·result가 이
builder의 subject binding/full request/response/snapshot과 일치할 때만 공통 review wrapper를 파생합니다. Caller가 만든
별도 PASS 객체나 unrelated reviewer result로 대체하지 않습니다. Reviewer FAIL이면 Parent가 finding을 판정하고 builder는
PASS할 수 없습니다. 같은 subject를 실제로 dispatch한 다른 reviewer가 PASS가 아닌 receipt를 남겼거나, 완료 기록에 PASS가 아닌
결과를 전달했거나, 정산 전에 release되어 결과가 기록되지 않았다면 다른 reviewer의 PASS를 연결해도 builder는 완료되지 않습니다.
읽을 수 없는 native task·receipt·완료 기록도 완료를 막습니다. Agent 호출 자체가 실패해 결과 없이 오류만 돌아온 시도와 등록만 하고
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
false positive로 판정해도 native 경로에서는 새 builder task와 새 review로 해소합니다. 이 연결은 coordination과 completion evidence이며
host 인증이나 권한 grant가 아닙니다. Parent가 직접 작성한 diff처럼 native subject task가 없는 검토에는 이 terminal 규칙이
적용되지 않습니다. 이때 `review --parent-subject <file>`은 `settlement:"parent-adjudication"`과 QA가 필요한 일반 review task spec을
만듭니다. Packet은 prompt에 싣지 않고 helper가 `.artifacts/tools/claude-review-packets/<reviewId>.json`(ignored, native 증거
경로 아님)에 상한 검사를 통과한 뒤 한 번 씁니다. Prompt에는 `KNU_REVIEW_PACKET_FILE:<경로> <sha256 digest>` 한 줄이 남고, 그
경로가 reviewer read 범위에 들어갑니다. `settle --task`는 `reviewPacket`(경로, 기대·현재 digest, 성공한 `Read` 관측)을 더하고,
읽지 않았으면 `review-packet-unread`, 파일이 바뀌었으면 `review-packet-changed`, Parent reviewer prompt에 packet 파일 줄이
없으면 `review-packet-missing`을 `observationErrors`에 넣습니다. 그 reviewer는
`complete`로 PASS 정산되지 않으며, Parent가 reviewer의 `settle --task` 출력에서 `observationErrors`가
비었는지(effort 판정 포함)와 모델·변경 경로, finding 재현으로 판정하고 `finalSnapshot` digest가 review `logHeader`와 같은지
확인합니다. Effort는 관측 때 판정하므로 `completion.json`의 `valid`만으로는 판정하지 않습니다. Review prompt 첫 줄의 회차 digest가
현재 source와 다르면 `prepare`가 `review-snapshot-stale`로 거부합니다. 이 경로는 새 binding이나 gate 완화가 아닙니다.

Native writer는 repository당 하나의 active lease로 직렬화합니다. 확인된 완료/관측된 tool failure는 해당 task의
lease만 해제합니다. 비동기는 완료 알림 뒤 complete가 회수합니다. 세션 종료·취소·권한 거부로 Post 이벤트가 없으면 실제 child 종료를 먼저 확인한 뒤
`pnpm claude:native release --task <taskId> --ended`로 그 task만 해제합니다. Timeout/만료를 종료 증거로 추측하지
않습니다. Release는 작업 완료가 아니며 다른 writer의 lease를 삭제하지 않습니다.
