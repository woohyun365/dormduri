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

1. `pnpm -s codex:delegate -- review-run --lanes <laneId[,laneId…]> --token <dispatch token> --round <N> --paths <리뷰 대상 경로[,경로…]> --out <출력 디렉터리>`가
   기준 문서 선택, 리뷰어 입력 수집, reviewer dispatch 등록을 한 번에 합니다. Reviewer는 계층과 무관하게 `knu_reviewer`(effort pin
   xhigh)와 Astra입니다. 리뷰 대상 경로는 lane이나 Parent가 바꾼 파일입니다. 다른 기준 문서가 필요하면
   `--criteria documents,agent-workflow-tooling`처럼 id를 더해 override하고, PR `## Lifecycle` 초안 파일이 있으면
   `--lifecycle-draft <경로>`를 더합니다. Stdout은 `review-run ok …` 또는 `review-run failed …` 한 줄이고 결과는
   `<출력 디렉터리>/review-run.json`(`sessionId`·`taskName`·`reviewId`·등록 `digest`·`spawnArguments`·`criteria`·`contextInputs`)과
   `<출력 디렉터리>/spawn-arguments.json`입니다. 기준 선택, 입력 추출, 등록 가운데 하나라도 거부되면 exit 1이고 등록하지 않으며
   `review-run.json`의 `error`에 사유가 남습니다. `binding-values-invalid`·`context-output-*`는
   [등록·리뷰 거부 해소](../../../docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md#해결)를 따릅니다.
   `review`와 등록, 기준 선택·리뷰어 입력 CLI를 따로 실행하는 경로도 그대로 동작합니다.
2. 기록을 확인합니다. 기준 문서 선택은 `.artifacts/tools/codex-native/<sessionId>/<reviewId>.criteria.json`에 남고, 선택 규칙은
   Claude 진입점과 같은 [자동 선택](../../../docs/development/agent-workflows/review-criteria/README.md#자동-선택)입니다. 기록의
   `documents`(문서·항목과 선택 이유), `documentCount`·`itemCount`가 그 리뷰의 기록입니다. `unmatchedPaths`의 경로는 기준 없이
   리뷰되므로 spawn 전에 확인하고, override한 기록에는 자동 선택 결과(`automatic`)도 남습니다. 리뷰어 입력은
   `.artifacts/tools/codex-native/<sessionId>/<reviewId>.context.json`의 `inputs`(intent·결정 기록·정책 문서·binding 행 추출·초안 절
   추출과 포함 이유)이고 [리뷰어 입력](../../../docs/development/agent-workflows/review-criteria/README.md#리뷰어-입력)을 따릅니다.
   고른 기준 문서에 걸린 binding `## 고른 값`·`## 저장소 규약` 행은
   `.artifacts/tools/codex-native/<sessionId>/<reviewId>.binding.md`에(걸린 행이 없으면 파일을 만들지 않음), 초안의 `## Lifecycle`
   절만 `.artifacts/tools/codex-native/<sessionId>/<reviewId>.lifecycle.md`에 남습니다.
3. `spawn-arguments.json`의 내용(`review-run.json`의 `spawnArguments`)을 그대로 spawn 도구에 넘깁니다. 메시지는 QA packet입니다. Frozen source 기준(HEAD·변경 파일),
   lane acceptance, 2단계 기록의 기준 문서, 읽기 범위를 담고, 2회차부터는 직전 회차의 finding과 처분, 그 뒤의 수정 diff, 수정이
   닿은 절·함수를 delta로 줍니다. 계획 리뷰의 등급별 리뷰 여부·입력은 [계획 리뷰 등급](../../../docs/development/agent-workflows/session-continuity.md#계획-초안-staging과-promote)이,
   2회차부터 delta만 읽는 범위와 전 범위로 돌아가는 조건은 [리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차)가
   정합니다. 2단계 리뷰어 입력의
   `inputs[].path`를 읽기 범위에 넣고 입력 줄에는 경로와 포함 이유만 적습니다(원본 초안과 binding 문서는 넣지 않음. 입력이 없으면
   "없음", 초안이 없으면 "등급 기록 없음: feature로 봄", 초안 절 추출이 있으면 그 `변경 등급`·`등급 근거`·`정책 영향 없음`·`인용 규칙`은
   근거가 아니라 diff와 대조할 주장).
   판정 지시에는 "요구가 말하지 않은 동작은 intent·결정 기록과 합리적 사용자 기대로 판정하고, 판정하지 않은 동작은 결과
   `unjudgedBehaviors`에 이유와 함께 적는다"와 "같은 유형의 결함이 다른 위치에도 있으면 그 finding의 `sameTypeLocations`에
   `path:line`으로 적는다"를 넣습니다([Portable QA packet](../../../docs/development/agent-workflows/qa.md#portable-qa-packet)). 실행 중이거나 멈춘
   reviewer에 대한 `followup_task`·`send_message`는 hook이 `review-child`로 deny하므로 더할 질문은 새 회차로 보냅니다.
4. Reviewer 완료 뒤 `$knu-settle`로 reviewer를 수락합니다. 리뷰 대상 lane은 결과를 반영한 뒤 수락합니다. 결과의 `dispatchId`는 그 회차의 `reviewId`입니다. Parent가 finding을
   재현하거나 기각 근거를 남기며, 구현자 자신의 PASS는 독립 리뷰가 아닙니다.
