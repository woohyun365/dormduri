---
name: knu-review
description: 이 저장소에서 code review·"리뷰해줘" 요청이나 Codex Parent가 위임한 lane·자신의 변경에 독립 리뷰(knu_reviewer)를 붙일 때 기준 문서를 고르고 reviewer dispatch를 만들고 등록해 spawn하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 독립 리뷰

규칙의 원본은 [QA workflow](../../../docs/development/agent-workflows/qa.md)의
[Portable QA packet](../../../docs/development/agent-workflows/qa.md#portable-qa-packet)과
[리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차), Codex 회차 운용은
[Context delivery](../../../docs/development/agent-workflows/adapters/codex-delegation.md#context-delivery)입니다.

Reviewer에게 기대 결론을 주지 않습니다. QA packet의 요청·acceptance·요구 절에 결론·범위 축소 문구("flag하지 말 것", "최대 low",
"계획이 그렇게 정함" 등)를 쓰지 않고, 범위는 읽기 범위(변경 파일)·기준 선택으로만 줄입니다.

리뷰 근거는 이 절차로 등록·spawn한 reviewer child의 관측뿐입니다. Host 자체 리뷰(built-in `/review`, Codex Ultra 자식, fork
자식)의 결과는 보조 의견으로 표시하고 PASS·완료 근거나 finding 처분 근거로 쓰지 않습니다. 보조 의견이 결함을 가리키면 Parent가
재현해 다음 회차 입력으로 씁니다.

1. `pnpm -s codex:delegate -- review --lanes <laneId[,laneId…]> --token <dispatch token> --round <N> --out <review.json>`으로
   reviewer dispatch를 만듭니다. Reviewer는 계층과 무관하게 `knu_reviewer`(effort pin xhigh)와 Astra입니다.
2. `pnpm -s codex:register -- --dispatch <review.json>`으로 등록하고 출력의 `sessionId`와 `registered[]`의 `digest`를 기록합니다.
3. 기준 문서: `node scripts/agents/common/review-criteria-selection.mjs -- <리뷰 대상 경로…>`의 출력을
   `.artifacts/tools/codex-native/<sessionId>/<reviewId>.criteria.json`(`reviewId`는 `review.json`의 값)에 저장합니다. 리뷰 대상 경로는
   lane이나 Parent가 바꾼 파일이고, 선택 규칙은 Claude 진입점과 같은
   [자동 선택](../../../docs/development/agent-workflows/review-criteria/README.md#자동-선택)입니다. 출력의 `documents`(문서·항목과
   선택 이유), `documentCount`·`itemCount`가 그 리뷰의 기록입니다. `unmatchedPaths`의 경로는 기준 없이 리뷰되므로 spawn 전에
   확인합니다. 다른 문서가 필요하면
   `node scripts/agents/common/review-criteria-selection.mjs --criteria documents,agent-workflow-tooling -- <리뷰 대상 경로…>`처럼
   id를 `--` 앞에 줘 override하고(`--` 뒤 인자는 모두 경로입니다), 기록에는 자동 선택 결과(`automatic`)도 남습니다.
   이어서 같은 경로로 `node scripts/agents/common/review-context-inputs.mjs -- <리뷰 대상 경로…>`의 출력을
   `.artifacts/tools/codex-native/<sessionId>/<reviewId>.context.json`에 저장합니다(Parent가 PR `## Lifecycle` 초안 파일을 쓰면
   `--lifecycle-draft <경로>`를 `--` 앞에 줍니다). 출력 `inputs`(intent·결정 기록·정책 문서·초안과 포함 이유)가 그 리뷰의
   [리뷰어 입력](../../../docs/development/agent-workflows/review-criteria/README.md#리뷰어-입력)입니다.
4. 2단계 출력 `registered[]`의 `spawnArguments`를 그대로 spawn 도구에 넘깁니다. 메시지는 QA packet입니다. Frozen source 기준(HEAD·변경 파일),
   lane acceptance, 3단계 기록의 기준 문서, 읽기 범위를 담고, 2회차부터는 이전 finding과 처분만 delta로 줍니다. 3단계 리뷰어 입력의
   `inputs[].path`를 읽기 범위에 넣고 입력 줄에는 경로와 포함 이유만 적습니다(입력이 없으면 "없음", 초안이 없으면 "등급 기록 없음:
   feature로 봄", 초안이 있으면 그 `변경 등급`·`등급 근거`·`정책 영향 없음`·`인용 규칙`은 근거가 아니라 diff와 대조할 Parent 주장).
   판정 지시에는 "요구가 말하지 않은 동작은 intent·결정 기록과 합리적 사용자 기대로 판정하고, 판정하지 않은 동작은 결과
   `unjudgedBehaviors`에 이유와 함께 적는다"와 "같은 유형의 결함이 다른 위치에도 있으면 그 finding의 `sameTypeLocations`에
   `path:line`으로 적는다"를 넣습니다([Portable QA packet](../../../docs/development/agent-workflows/qa.md#portable-qa-packet)). 실행 중이거나 멈춘
   reviewer에 대한 `followup_task`·`send_message`는 hook이 `review-child`로 deny하므로 더할 질문은 새 회차로 보냅니다.
5. Reviewer 완료 뒤 `$knu-settle`로 reviewer를 수락합니다. 리뷰 대상 lane은 결과를 반영한 뒤 수락합니다. 결과의 `dispatchId`는 그 회차의 `reviewId`입니다. Parent가 finding을
   재현하거나 기각 근거를 남기며, 구현자 자신의 PASS는 독립 리뷰가 아닙니다.
