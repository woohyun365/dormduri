---
name: knu-workflow
description: 이 저장소에서 Codex Parent가 새 요청이나 명시한 plan의 재개를 시작할 때 Git·계획 상태와 workflow 진입 경로를 진단하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU workflow 진입

규칙의 원본은 [Repository workflow entry](../../../docs/development/agent-workflows/adapters/codex.md#repository-workflow-entry)와
[session continuity](../../../docs/development/agent-workflows/session-continuity.md)입니다.

1. `pnpm -s codex:preflight -- --fresh`로 branch·HEAD·working tree와 계획 inventory를 확인합니다. `이어서`나 plan이 명시된
   재개 요청만 resume 경로로 갑니다.
2. 새 요청은 `pnpm -s codex:workflow -- --request '<요청>' --mode fresh --json`, 재개는
   `pnpm -s codex:workflow -- --request '<요청>' --mode resume --plan <.plans 경로> --json`으로 진입 경로를 받습니다.
3. 출력이 가리키는 guide 중 현재 요청에 필요한 것만 읽습니다. 출력은 deterministic 진단이며 권한이나 실행 결과가 아닙니다.
4. Bounded 작업을 child에게 맡길 때는 `$knu-delegate`, 독립 리뷰는 `$knu-review`, child 완료 정산은 `$knu-settle`을 씁니다.
