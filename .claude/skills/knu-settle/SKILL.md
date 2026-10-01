---
name: knu-settle
description: 이 저장소에서 KNU native task의 완료 알림(task-notification completed)을 받은 뒤 관측을 정산하고 판정할 때의 절차입니다.
---

# KNU native 정산

규칙의 원본은 [Routine operation](../../../docs/development/agent-workflows/adapters/claude-code.md#routine-operation) 5단계입니다.

1. 완료 알림을 받은 **다음** `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task <taskId>`로 관측을 정산합니다. 알림 전
   조회는 거부되며 같은 turn에서 반복하지 않습니다. Child의 hand-back이 먼저 와도 완료 관측이 아닙니다.
2. 결과의 `judgmentTemplatePath` 파일에서 acceptance마다 `passed`와 `evidenceRef`를, `checks`에 Parent가 직접 확인한 내용을
   채웁니다. `responseDigest`는 바꾸지 않습니다.
3. 독립 QA가 필요한 builder(template에 `reviewerTaskId: null`)는 판정 전에 `/knu-review`의 native subject 경로로 reviewer를
   정산하고 그 task id를 채웁니다.
4. `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task <taskId> --judgment <absolute-template-path>`로 판정합니다.

## Reviewer 종류

- Native subject reviewer: 위와 같이 template을 채워 `--judgment`로 정산합니다. 결과 JSON은
  `.artifacts/tools/claude-native/<taskId>/completion.json`의 응답에서 읽습니다.
- `parent-adjudication` reviewer: template이 없고 `--judgment`는 거부됩니다. Parent가 `completion.json`의 관측(valid·모델·변경
  경로)과 finding 재현으로 판정하고, `finalSnapshot` digest가 review `logHeader`와 같은지 확인합니다.
- Coverage gap이 있는 FAIL은 완료된 리뷰로 기록되지 않습니다. 재리뷰하거나 Parent가 교차 참조로 마감합니다.

정산 결과가 invalid면 완료를 보고하지 않고 사유와 다음 행동을 남깁니다. Boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다.
