---
name: knu-settle
description: 이 저장소에서 Codex Parent가 위임한 child나 reviewer가 멈춘 뒤 hook 기록과 결과·독립 QA로 완료를 확인한 뒤 수락하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 정산

규칙의 원본은 [Routine task-model operation](../../../docs/development/agent-workflows/adapters/codex.md#routine-task-model-operation)
6·7단계와 [완료 관측](../../../docs/development/agent-workflows/adapters/codex-native-registry.md#subagent-hook-guardrail과-완료-관측)입니다.

1. Lane child는 `pnpm -s codex:completion -- --lane <laneId> --token <dispatch token> --role <agent_type> --model <계약 model>`로
   hook 기록과 lane 계약을 대조합니다. 역할과 model은 delegation 파일의 그 dispatch 값입니다.
2. 반환 결과를 실제 source·oracle·회귀 결과와 대조합니다. Failed·blocked·conflicting evidence는 지우지 않고 보존하며,
   hook 기록이 없거나 bind·등록 봉인·계약 model·역할 effort와 맞지 않는 completed와 self-PASS는 받지 않습니다.
3. 수락 전에 독립 QA를 받습니다. 구현 lane은 필수 Astra QA를 `$knu-review`로 받고, 그 밖의 lane은 QA trigger를 따릅니다.
   대조나 QA가 찾은 결함은 아직 수락·해제하지 않은 같은 child에 `followup_task`로 돌려줍니다.
4. 대조와 QA를 통과해 완료로 받을 child와, 끝난 reviewer는 `pnpm -s codex:accept -- --task <task_name> --role <agent_type> --model <계약 model>`로
   수락하고, 출력의 `registrationDigest`가 등록 때의 `digest`와 같은지 확인합니다. 수락한 child에는 후속 작업을 주지 않으며
   보완은 새 dispatch입니다.
5. 실패한 lane은 pending writer를 회수하고, child가 끝났는데 수락하지 않을 writer는
   `pnpm -s codex:release -- --task <task_name> --ended`로 해제한 뒤(Parent 쓰기 guard가 닫힘) [Recovery ceiling](../../../docs/development/agent-workflows/request-intake/orchestration-recovery.md#recovery-ceiling)에
   따라 재시도 한 번 또는 Parent 판단·handoff로 갑니다. Stop 기록 없이 끝난 writer는 해제가 `child-running`으로 거부되므로 새 Parent
   session에서 다시 시작합니다. 이 skill은 재시도 dispatch를 만들지 않습니다.
6. 결과 회수·pending·cleanup은 [subagent lifecycle](../../../docs/development/agent-workflows/subagent-lifecycle.md)로 따로 판정합니다.
