---
name: knu-settle
description: 이 저장소에서 KNU native task가 끝난 뒤(background는 완료 알림 task-notification completed 뒤, foreground는 Agent 결과 뒤) 관측을 정산하고 판정할 때의 절차입니다.
---

# KNU native 정산

규칙의 원본은 [Routine operation](../../../docs/development/agent-workflows/adapters/claude-code.md#routine-operation) 5단계입니다.

1. Background child는 완료 알림을 받은 **다음** `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task <taskId>`로 관측을
   정산합니다. Foreground 호출은 PostToolUse가 완료를 기록하므로 알림을 기다리지 않습니다. 알림 전
   조회는 거부되며 알림 전에는 반복하지 않습니다. Background child의 hand-back이 먼저 와도 완료 관측이 아닙니다. hand-back을 받은 turn은
   text로 끝내지 않고 finding 재현 같은 tool 작업으로 이어 가며, 알림이 그 turn에 오면 바로 정산합니다. Text로만 끝내면 알림이
   다음 입력까지 오지 않을 수 있습니다.
2. 결과의 `judgmentTemplatePath` 파일에서 acceptance마다 `passed`와 `evidenceRef`를, `checks`에 Parent가 직접 확인한 내용을
   채웁니다. `responseDigest`는 바꾸지 않습니다.
3. 독립 QA가 필요한 builder(template에 `reviewerTaskId: null`)는 판정 전에 `/knu-review`의 native subject 경로로 reviewer를
   정산하고 그 task id를 채웁니다. Reviewer 없는 researcher(template에 `quoteCheck: null`)는 첫 `settle` 결과의
   `quoteCheckResponsePath`(정산된 응답)를 `--response`로 `/knu-delegate`의 인용 대조를 실행하고, 그 출력 경로를 `quoteCheck`에
   채웁니다. 출력은 저장소 안·native task evidence 밖 ignored 경로(예: 그 작업의 계획 증거 경로 `.artifacts/plans/<umbrella Plan ID>/<bounded Plan ID>/`. `.artifacts` 바로 아래 새 디렉터리는 layout guard가 `artifacts-unknown-child`로 막습니다)에 둡니다. 정산은 출력이 없거나 다른 task·응답을 가리키거나 응답에 없는 주장을 대조했으면 거부하고, 통과하면 결과의
   `quoteCheck.candidates`(`found`)만 evidence 후보로, `excluded`는 사유와 함께 제외로 남깁니다.
4. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task <taskId> --judgment <absolute-template-path>`로 판정합니다.

helper 명령(pnpm `-s`) 출력의 첫 줄은 pnpm이 내는 `$ node …` 줄이고 JSON은 그 다음 줄부터입니다(또는
`scripts/agents/claude/native-session.mjs`를 node로 직접 실행).

## Reviewer 종류

- Native subject reviewer: 위와 같이 template을 채워 `--judgment`로 정산합니다. 결과 JSON은
  `.artifacts/tools/claude-native/<taskId>/completion.json`의 응답에서 읽습니다.
- `parent-adjudication` reviewer: template이 없고 `--judgment`는 거부됩니다. Parent가 settle 결과의 `observationErrors`가
  비었는지(모델·변경 경로 포함)와 finding 재현으로 판정합니다. Helper가 reviewer prompt 첫 줄 `logHeader`의 snapshot을 대조해
  다르면 `review-snapshot-mismatch`를 넣습니다. 읽기 전용 reviewer는 의존 집합(read path·결속 입력·transcript가 보인 읽기)
  안 변경이 없으면 등록 snapshot과, 있으면 `finalSnapshot`과 대조하므로 다른 세션의 집합 밖 편집·commit은 settle 결과
  `dependencyJudgment`에 기록만 남습니다. 저장소 전체 판정(`basis: repository`)이면 HEAD tree·dirty diff·untracked 입력 digest로
  대조해, 같은 tree의 fast-forward·squash merge처럼 commit만 바뀌었으면 mismatch를 넣지 않고 `headChanged: true`만 남습니다.
  Review-read hook이 거부한 Grep·Glob(task 디렉터리 `review-read-denials.jsonl`)은 의존 판정에서 빠지고, read 범위 밖 Read 대상은
  `readOutsidePaths`에 기록만 남습니다. Packet 파일 review는 settle 결과의 `reviewPacket`을 함께 봅니다. Reviewer가 packet 파일을 성공적으로 읽지 않았으면
  `review-packet-unread`, 파일이 prompt의 digest와 다르면 `review-packet-changed`, prompt에서 packet 파일 줄이 빠졌으면
  `review-packet-missing`이 `observationErrors`에 들어가므로 재리뷰합니다. 리뷰 입력 사본이나 그 manifest가 바뀌었거나
  빠졌으면 `review-input-*`가, runner 파일이 등록 뒤 바뀌었으면 `review-runner-file-changed`가, 결과 template 파일이 바뀌었으면
  `review-template-changed`가 들어가므로 역시 결과를 쓰지 않고 `review-run`을 다시 실행해 재리뷰합니다. 이어 쓴 record가 있는
  회차(prompt runner 줄 끝 `(carried from <reviewId>)`, packet 디렉터리 `<reviewId>.carry.json`)는 결과를 쓰기 전에 runner의 확인
  기록(`<out-dir>/confirm/evidence.json`)을 결과 단위(exit·조각·test 결과 줄)와 snapshot으로 대조합니다.
  `carry-confirm-pending`이면 확인 실행이 끝난 뒤 같은 명령으로 다시 정산합니다(결과 파일·packet 닫기는 아직 없음).
  `carry-confirm-missing`·`carry-confirm-mismatch`면 결과를 쓰지 않고, 확인 기록을 이번 회차 record로 써서 같은 회차를 다시
  리뷰합니다(`review-run` 다시 실행, 이어 쓰지 않음). 사유 끝은 record 이름이고, `carry record`는 carry 기록이 없거나 prompt 기록의
  digest와 다름, `snapshot`은 확인 실행 중 checkout이 바뀜입니다.
- 기록만 남는 관측(이 기록만으로는 거부하지 않음): settle 결과의 `reviewInputOriginalsChanged`는 사본을 만든 뒤 바뀐 ignored 입력
  원본 경로입니다. Reviewer는 사본을 읽었으므로 거부하지 않습니다. 그 회차가 읽은 판은
  `.artifacts/tools/claude-review-packets/<reviewId>.inputs/<원본 경로>`에 있으니 finding을 재현하거나 다음 회차 입력을 만들 때
  지금 원본과 대조합니다. Reviewer의 Read·Grep·Glob이 바뀐 원본이나 그 상위 디렉터리를 path로 지목한 것이 관측되거나
  reviewer의 읽기를 가릴 수 없으면 기록이 아니라 `review-input-changed:<원본 경로>` 거부입니다(path 없는 검색과 저장소 root
  검색은 지목이 아님). `identityOutsideChanges`는 등록 뒤 바뀐 `scripts/agents/claude`·`scripts/agents/common` script 가운데 등록·정산
  code의 정적 import 닫힘 밖 파일(dispatch 전 검사 도구 등)입니다. Identity 대조에 쓰이지 않아 이 기록만으로는 거부하지 않습니다. 그
  파일이 reviewer의 의존 집합 안이거나 저장소 전체로 판정하는 리뷰면 같은 변경이 `unattributable-change:<경로>`로 `observationErrors`에
  따로 들어가고, 그때는 결과를 쓰지 않습니다. 닫힘 안 module, 역할 파일, settings가 바뀌면 `adapter/role/settings drift`로 거부되고
  그 task의 결과는 쓸 수 없으므로 다시 등록해 재리뷰합니다.
- Coverage gap이 있는 단일 reviewer FAIL은 완료된 리뷰로 기록되지 않습니다. 재리뷰하거나 Parent가 교차 참조로 마감합니다.
  1회차 그룹 구성원은 아래 처분 기록 규칙만 따릅니다.

## 회차 처분 기록

- 회차마다 `r<N>-adjudication.json`(`review-adjudication/v1`)을 계획 증거 위치에 써서
  `node scripts/agents/common/review-adjudication.mjs <파일>`이 exit 0인지 확인합니다. Parent reviewer의 result는 `settle --task`
  출력 `resultPath`의 결과 파일이고 처분 기록 `reviews[].resultPath`에 그 경로를 적습니다. 출력 `response` 문자열을 그대로
  저장하지 않습니다(`review-result-unparsed`면 결과 없는 회차입니다). Native subject reviewer는 전달한 result를 그대로
  `r<N>-result.json`(그룹은 `r<N>-result-<i>.json`)으로 저장합니다. 처분 기록 `subject`는 회차와 무관한 변경 이름이고 같은 변경의
  모든 회차가 같은 문자열을 씁니다([처분 기록](../../../docs/development/agent-workflows/review-criteria/README.md#처분-기록) 예시의
  `"<변경 이름>"`). 이 파일들과 재현 로그는 리뷰 read path(디렉터리 포함) 밖에 둡니다. Reviewer는 ignored 입력을 사본으로 읽으므로
  원본 디렉터리에 쓴 새 파일은 정산을 막지 않지만(subject `paths` 안 디렉터리면 다음 회차가 `new-file`로 전 범위), 사본 디렉터리(`<reviewId>.inputs/`)나 ignored가 아닌 read path 아래 ignored
  파일을 바꾸면 그 reviewer의 `review-input-changed`로 정산과 연결 builder 완료가 거부됩니다(그룹은 마지막 구성원 정산과 builder
  완료까지). 다른 reviewer의 같은 결함은 `duplicateOf`로 묶습니다. 구성원이 id 접두를 어겨 `duplicate-result-id`가 나면 기록으로
  풀 수 없으므로 native 경로는 새 builder task와 새 review로 가고, Parent 경로는 구성원마다 기록을 하나씩 씁니다.
- 재현되면 고친 뒤 `fixed`와 `fixRef`(수정 commit의 40자 SHA, `sha256:` snapshot digest 또는 저장소 상대 경로)를 적습니다. 고치기
  전에는 `fixed`를 쓰지 않습니다. 2회차부터 finding마다 `origin`(`fix-induced`·`previously-missed`·`re-raised`)이 필요합니다.
  rebase·squash로 SHA가 바뀌면 앞 회차 기록은 그대로 두고 다음 회차부터 새 SHA나 snapshot digest를 씁니다. Finding의
  `sameTypeLocations`는 모두 고치거나 고치지 않은 위치를 그 finding 처분 `reason`에 남깁니다.
- Result에 `unjudgedBehaviors`(판정하지 않은 동작) 줄이 있으면 처분 기록 `unjudged`에 줄마다(`<taskId>#u<index>`) 처분과
  이유를 적습니다. Parent가 재현·대조해 결함이 없으면 `parent-checked`(그 log의 저장소 경로를 `reason`에 backtick으로), 이 변경의
  결함이면 `raised`, 이 변경 전부터 있던 결함이면 `pre-existing`, 이 변경 범위 밖이면 `out-of-scope`·`follow-up`입니다. PASS
  회차도 같고, 처분이 빠진 줄은 `missing-unjudged`로 거부됩니다. 미판정 줄을 처분할 때는 그 줄의 주장과 같은 원천(같은 명령
  출력·같은 기록)을 쓰는 주장과 같은 문단의 주장을 한 번에 대조합니다. `raised`가 하나라도 있으면 그 문단 전체를 다시 대조한 뒤
  다음 회차를 요청합니다. 대조한 주장과 결과는 처분 근거 log에 남깁니다.
- 1회차 그룹의 non-PASS 구성원은 그 구성원의 blocking finding(critical·high·medium)을 Parent가 재현해 볼 때만 기각할 수 있습니다.
  재현 실행을 첫 줄이 그 회차 `logHeader`인 `.artifacts/` 로그로 남기고 `reason`에 그 경로를 backtick으로 적은 뒤 `rejected`로
  둡니다. 재현되면 고친 뒤 `fixed`와 `fixRef`를 적고 같은 변경의 다음 회차로 갑니다. 리뷰 전 runner 출력은 재현 근거가
  아닙니다.
- `notRun`이 있거나 blocking finding 없이 gap·`knownGaps`·low만 있는 구성원, gap·`knownGaps` 항목이 기각한 finding id를 적지 않은
  구성원은 처분으로 마감하지 않습니다. 새 builder task와 재리뷰로 갑니다. 다른 구성원의 PASS는 근거가 아닙니다.
- Native builder 판정 파일에 non-PASS 구성원이 있으면 `reviewerTaskId`에 PASS 구성원을, `reviewAdjudication`에 처분 기록의 root 기준
  경로를 적습니다. 규칙의 원본은 [builder 완료와 1회차 그룹](../../../docs/development/agent-workflows/adapters/claude-same-host-review.md#builder-완료와-1회차-그룹)입니다.
- 리뷰 회차를 측정하는 PR은 마지막 회차를 정산한 뒤 `node scripts/agents/claude/review-ledger-source.mjs`를 실행해 행을 남깁니다.

정산 결과가 invalid면 완료를 보고하지 않고 사유와 다음 행동을 남깁니다. Boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다.
