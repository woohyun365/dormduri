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
   정산하고 그 task id를 채웁니다.
4. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task <taskId> --judgment <absolute-template-path>`로 판정합니다.

## Reviewer 종류

- Native subject reviewer: 위와 같이 template을 채워 `--judgment`로 정산합니다. 결과 JSON은
  `.artifacts/tools/claude-native/<taskId>/completion.json`의 응답에서 읽습니다.
- `parent-adjudication` reviewer: template이 없고 `--judgment`는 거부됩니다. Parent가 settle 결과의 `observationErrors`가
  비었는지(모델·변경 경로 포함)와 finding 재현으로 판정하고, `finalSnapshot` digest가 review `logHeader`와 같은지 확인합니다.
  Packet 파일 review는 settle 결과의 `reviewPacket`을 함께 봅니다. Reviewer가 packet 파일을 성공적으로 읽지 않았으면
  `review-packet-unread`, 파일이 prompt의 digest와 다르면 `review-packet-changed`, prompt에서 packet 파일 줄이 빠졌으면
  `review-packet-missing`이 `observationErrors`에 들어가므로 재리뷰합니다.
- Coverage gap이 있는 단일 reviewer FAIL은 완료된 리뷰로 기록되지 않습니다. 재리뷰하거나 Parent가 교차 참조로 마감합니다.
  1회차 그룹 구성원은 아래 처분 기록 규칙만 따릅니다.

## 회차 처분 기록

- 회차마다 계획 증거 위치에 reviewer가 전달한 result를 그대로 `r<N>-result.json`(그룹은 `r<N>-result-<i>.json`)으로 저장하고
  `r<N>-adjudication.json`(`review-adjudication/v1`)을 써서 `node scripts/agents/common/review-adjudication.mjs <파일>`이 exit 0인지
  확인합니다. 다른 reviewer의 같은 결함은 `duplicateOf`로 묶습니다. 구성원이 id 접두를 어겨 `duplicate-result-id`가 나면 기록으로
  풀 수 없으므로 native 경로는 새 builder task와 새 review로 가고, Parent 경로는 구성원마다 기록을 하나씩 씁니다.
- 1회차 그룹의 non-PASS 구성원은 그 구성원의 blocking finding(critical·high·medium)을 Parent가 재현해 볼 때만 기각할 수 있습니다.
  재현 실행을 첫 줄이 그 회차 `logHeader`인 `.artifacts/` 로그로 남기고 `reason`에 그 경로를 backtick으로 적은 뒤 `rejected`로
  둡니다. 재현되면 `fixed`이고 같은 변경의 다음 회차로 갑니다. 리뷰 전 runner 출력은 재현 근거가 아닙니다.
- `notRun`이 있거나 blocking finding 없이 gap·`knownGaps`·low만 있는 구성원, gap·`knownGaps` 항목이 기각한 finding id를 적지 않은
  구성원은 처분으로 마감하지 않습니다. 새 builder task와 재리뷰로 갑니다. 다른 구성원의 PASS는 근거가 아닙니다.
- Native builder 판정 파일에 non-PASS 구성원이 있으면 `reviewerTaskId`에 PASS 구성원을, `reviewAdjudication`에 처분 기록의 root 기준
  경로를 적습니다. 규칙의 원본은 [builder 완료와 1회차 그룹](../../../docs/development/agent-workflows/adapters/claude-same-host-review.md#builder-완료와-1회차-그룹)입니다.
- 리뷰 회차를 측정하는 PR은 마지막 회차를 정산한 뒤 `node scripts/agents/claude/review-ledger-source.mjs`를 실행해 행을 남깁니다.

정산 결과가 invalid면 완료를 보고하지 않고 사유와 다음 행동을 남깁니다. Boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다.
