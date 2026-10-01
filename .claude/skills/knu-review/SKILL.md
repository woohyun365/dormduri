---
name: knu-review
description: 이 저장소에서 위임 결과나 Parent가 작성한 변경을 같은 host의 독립 knu_reviewer로 검토받을 때 review packet을 만들고 reviewer를 등록하는 절차입니다.
---

# KNU 독립 리뷰

규칙의 원본은
[Same-host independent review](../../../docs/development/agent-workflows/adapters/claude-same-host-review.md#same-host-independent-review)입니다.
Reviewer에게 기대 결론을 전달하거나 PASS로 유도하지 않습니다.

## Native subject 경로 (위임한 task의 QA)

독립 QA가 필요한 builder는 이 경로의 reviewer만 `reviewerTaskId`로 연결할 수 있습니다.

1. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --subject <taskId>`로 이번 회차 `logHeader`와 digest를 받습니다.
2. Runner(Parent)가 `logHeader`를 첫 줄에 둔 검증 로그를 남기고 runner evidence JSON을 만듭니다. 각 기록은
   `{command, exit, environment, observedResult, outputPaths, sourceDigest}`이고 수정 전 실패(RED)는
   `purpose:"red"`·`expectedExit`를 더합니다. Exit를 뒤집어 기록하지 않습니다.
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --subject <taskId> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --session ${CLAUDE_SESSION_ID}`
4. 출력 `reviewerSpec`을 확인해 파일로 저장하고 `prepare --spec`으로 등록한 뒤 `agentInput`으로 Agent를 호출합니다.
5. 알림 뒤 `/knu-settle`로 reviewer를 정산하고, builder judgment의 `reviewerTaskId`에 reviewer task id를 적습니다.

## Parent 작성 diff 경로

Native subject가 없는 Parent 변경의 검토입니다. Builder의 `reviewerTaskId`를 대신할 수 없습니다.

1. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --parent-subject <absolute-subject-path> --session ${CLAUDE_SESSION_ID}`로
   `logHeader`를 받습니다.
2. 그 digest로 runner evidence를 만듭니다.
3. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native review --parent-subject <absolute-subject-path> --runner-evidence <absolute-evidence-path> --basis <ref> --reviewer-model <model-id> --session ${CLAUDE_SESSION_ID}`
4. 출력 `reviewerSpec`으로 `prepare --spec`하고 `agentInput`으로 Agent를 호출합니다. Packet은 prompt에 싣지 않고
   `.artifacts/tools/claude-review-packets/<reviewId>.json`에 씁니다. Prompt에는 `KNU_REVIEW_PACKET_FILE:<경로> <digest>` 한 줄만
   남고 reviewer가 그 파일을 먼저 읽습니다. 출력 `packetFile`이 같은 경로와 digest입니다.
5. 정산은 `parent-adjudication`입니다. `/knu-settle`의 reviewer 종류 구분을 따릅니다.

## 공통

- Reviewer prompt는 12,000자를 넘을 수 없습니다. Parent 경로는 packet이 파일로 빠진 뒤 크기이고, 남는 초과는 runner 기록과
  acceptance 문장 길이에서 옵니다. Native subject 경로는 acceptance·read path·runner 기록을 줄입니다.
- Reviewer가 실행 중일 때 read 범위의 입력(계획·증거 포함)을 수정하지 않습니다.
- 같은 subject가 연속으로 PASS가 아니면 quality stop입니다. Owner에게 다음 행동을 묻습니다.
