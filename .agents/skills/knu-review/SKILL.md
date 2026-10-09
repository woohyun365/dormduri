---
name: knu-review
description: 이 저장소에서 Codex Parent가 위임한 lane이나 자신의 변경에 독립 리뷰(knu_reviewer)를 붙일 때 reviewer dispatch를 만들고 등록해 spawn하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 독립 리뷰

규칙의 원본은 [QA workflow](../../../docs/development/agent-workflows/qa.md)의
[Portable QA packet](../../../docs/development/agent-workflows/qa.md#portable-qa-packet)과
[리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차), Codex 회차 운용은
[Context delivery](../../../docs/development/agent-workflows/adapters/codex-delegation.md#context-delivery)입니다.

1. `pnpm -s codex:delegate -- review --lanes <laneId[,laneId…]> --token <dispatch token> --round <N> --out <review.json>`으로
   reviewer dispatch를 만듭니다. Reviewer는 계층과 무관하게 `knu_reviewer`(effort pin xhigh)와 Astra입니다.
2. `pnpm -s codex:register -- --dispatch <review.json>`으로 등록하고 출력의 `digest`를 기록합니다.
3. 출력의 `spawnArguments`를 그대로 spawn 도구에 넘깁니다. 메시지는 QA packet입니다. Frozen source 기준(HEAD·변경 파일),
   lane acceptance, 리뷰 기준, 읽기 범위를 담고, 2회차부터는 이전 finding과 처분만 delta로 줍니다.
4. Reviewer 완료 뒤 `$knu-settle`로 수락합니다. 결과의 `dispatchId`는 그 회차의 `reviewId`입니다. Parent가 finding을
   재현하거나 기각 근거를 남기며, 구현자 자신의 PASS는 독립 리뷰가 아닙니다.
