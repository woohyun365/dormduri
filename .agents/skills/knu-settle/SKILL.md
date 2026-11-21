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
   Reviewer 결과는 그 작업 계획 증거 위치에 `r<N>-result.json`으로 저장하고, 처분 기록 파일은 Claude와 같은 형식의
   `r<N>-adjudication.json`(`review-adjudication/v1`, [처분 기록](../../../docs/development/agent-workflows/review-criteria/README.md#처분-기록))으로
   남깁니다(`reviews[].taskId`는 Codex task 이름, `reviews[].resultPath`는 그 결과 파일). 처분 기록 `subject`는 회차와 무관한
   변경 이름이고 같은 변경의 모든 회차가 같은 문자열을 씁니다. 재현되면 고친 뒤 `fixed`와 `fixRef`(수정 commit SHA, `sha256:`
   snapshot digest 또는 저장소 상대 경로)를 적습니다. 고치기 전에는 `fixed`를 쓰지 않습니다. 2회차부터 finding마다
   `origin`(`fix-induced`·`previously-missed`·`re-raised`)이 필요합니다. rebase·squash로 SHA가 바뀌면 앞 회차 기록은 그대로 두고
   다음 회차부터 새 SHA나 snapshot digest를 씁니다. Finding의 `sameTypeLocations`는 모두 고치거나 고치지 않은 위치를 그 finding
   처분 `reason`에 남깁니다. `unjudgedBehaviors`(판정하지 않은 동작) 줄은 처분 기록 `unjudged`에 줄마다 처분과 이유를 적습니다.
   Parent가 재현·대조해 결함이 없으면 `parent-checked`(그 log의 저장소 경로를 `reason`에 backtick으로), 이 변경의 결함이면
   `raised`, 이 변경 전부터 있던 결함이면 `pre-existing`, 이 변경 범위 밖이면 `out-of-scope`·`follow-up`입니다. 기록 검사와 ledger
   reader는 [Codex same-host review](../../../docs/development/agent-workflows/adapters/codex-same-host-review.md#처분-기록과-ledger)가
   소유합니다.
3. 수락 전에 QA trigger에 따라 독립 QA를 `$knu-review`로 받습니다.
   대조나 QA가 찾은 결함은 아직 수락·해제하지 않은 같은 child에 `followup_task`로 돌려줍니다.
4. 대조와 QA를 통과해 완료로 받을 child와, 끝난 reviewer는 `pnpm -s codex:accept -- --task <task_name> --role <agent_type> --model <계약 model>`로
   수락하고, 출력의 `registrationDigest`가 등록 때의 `digest`와 같은지 확인합니다. 수락한 child에는 후속 작업을 주지 않으며
   보완은 새 dispatch입니다.
5. 실패한 lane은 pending child를 회수하고, child가 끝났는데 수락하지 않을 lane child는
   `pnpm -s codex:release -- --task <task_name> --ended`로 해제한 뒤 [Recovery ceiling](../../../docs/development/agent-workflows/request-intake/orchestration-recovery.md#recovery-ceiling)에
   따라 재시도 한 번 또는 Parent 판단·handoff로 갑니다. Stop 기록 없이 끝난 child는 해제가 `child-running`으로 거부되므로 새 Parent
   session에서 다시 시작합니다. 이 skill은 재시도 dispatch를 만들지 않습니다.
6. 결과 회수·pending·cleanup은 [subagent lifecycle](../../../docs/development/agent-workflows/subagent-lifecycle.md)로 따로 판정합니다.
