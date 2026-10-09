---
name: knu-settle
description: 이 저장소에서 Codex Parent가 위임한 child나 reviewer가 멈춘 뒤 hook 기록으로 완료를 확인하고 수락하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 정산

규칙의 원본은 [Routine task-model operation](../../../docs/development/agent-workflows/adapters/codex.md#routine-task-model-operation)
6·7단계와 [완료 관측](../../../docs/development/agent-workflows/adapters/codex-native-registry.md#subagent-hook-guardrail과-완료-관측)입니다.

1. Lane child는 `pnpm -s codex:completion -- --lane <laneId> --token <dispatch token> --role <agent_type> --model <계약 model>`로
   hook 기록과 lane 계약을 대조합니다. 역할과 model은 delegation 파일의 그 dispatch 값입니다.
2. 완료로 받을 child와 reviewer는 `pnpm -s codex:accept -- --task <task_name> --role <agent_type> --model <계약 model>`로
   수락하고, 출력의 `registrationDigest`가 등록 때의 `digest`와 같은지 확인합니다. 수락한 child에는 후속 작업을 주지 않습니다.
3. 반환 결과를 실제 source·oracle·회귀 결과와 대조합니다. Failed·blocked·conflicting evidence는 지우지 않고 보존하며,
   hook 기록이 없거나 계약 model·역할 effort·수락 기록과 맞지 않는 completed는 받지 않습니다.
4. 실패한 lane은 [Recovery ceiling](../../../docs/development/agent-workflows/request-intake/orchestration-recovery.md#recovery-ceiling)에
   따라 재시도 한 번 또는 Parent 판단·handoff로 갑니다. 이 skill은 재시도 dispatch를 만들지 않습니다.
5. 결과 회수·pending·cleanup은 [subagent lifecycle](../../../docs/development/agent-workflows/subagent-lifecycle.md)로 따로 판정합니다.
