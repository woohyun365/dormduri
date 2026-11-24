---
name: knu-review
description: 이 저장소에서 code review·"리뷰해줘" 요청이나 Codex Parent가 위임한 lane·자신의 변경에 독립 리뷰(knu_reviewer)를 붙일 때 기준 문서를 고르고 reviewer dispatch를 만들고 등록해 spawn하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 독립 리뷰

규칙의 원본은 [QA workflow](../../../docs/development/agent-workflows/qa.md)의
[Portable QA packet](../../../docs/development/agent-workflows/qa.md#portable-qa-packet)과
[리뷰 회차](../../../docs/development/agent-workflows/qa.md#리뷰-회차), Codex 회차 운용은
[Context delivery](../../../docs/development/agent-workflows/adapters/codex-delegation.md#context-delivery)입니다. 등록·회차·처분 기록과
ledger reader를 모은 reference는 [Codex same-host review](../../../docs/development/agent-workflows/adapters/codex-same-host-review.md)입니다.

Reviewer에게 기대 결론을 주지 않습니다. QA packet의 요청·acceptance·요구 절에 결론·범위 축소 문구("flag하지 말 것", "최대 low",
"계획이 그렇게 정함" 등)를 쓰지 않고, 범위는 읽기 범위(변경 파일과 그 소비자·실행 경로)·기준 선택으로만 줄입니다.

리뷰 근거는 이 절차로 등록·spawn한 reviewer child의 관측뿐입니다. Host 자체 리뷰(built-in `/review`, Codex Ultra 자식, fork
자식)의 결과는 보조 의견으로 표시하고 PASS·완료 근거나 finding 처분 근거로 쓰지 않습니다. 보조 의견이 결함을 가리키면 Parent가
재현해 다음 회차 입력으로 씁니다.

1. 등록 전에 아래 [Dispatch 전 단계](#dispatch-전-단계)를 실행합니다. 그 검사가 실패하거나 자체 정합 점검이 파일을 고치면 그
   뒤에 등록합니다. `pnpm -s codex:delegate -- review-run --lanes <laneId[,laneId…]> --token <dispatch token> --round <N> --paths <리뷰 대상 경로[,경로…]> --out <출력 디렉터리>`가
   기준 문서 선택, 리뷰어 입력 수집, reviewer dispatch 등록을 한 번에 합니다. Reviewer는 계층과 무관하게 `knu_reviewer`(effort pin
   xhigh)와 Astra입니다. 리뷰 대상 경로는 lane이나 Parent가 바꾼 파일과 그 소비자·실행 경로입니다(Dispatch 전 단계의
   Subject 경로). 다른 기준 문서가 필요하면
   `--criteria documents,agent-workflow-tooling`처럼 id를 더해 override하고, PR `## Lifecycle` 초안 파일이 있으면
   `--lifecycle-draft <경로>`를 더합니다. Stdout은 `review-run ok …` 또는 `review-run failed …` 한 줄이고 결과는
   `<출력 디렉터리>/review-run.json`(`sessionId`·`taskName`·`reviewId`·등록 `digest`·`spawnArguments`·`criteria`·`contextInputs`)과
   `<출력 디렉터리>/spawn-arguments.json`입니다. 기준 선택, 입력 추출, 등록 가운데 하나라도 거부되면 exit 1이고 등록하지 않으며
   `review-run.json`의 `error`에 사유가 남습니다. 출력 디렉터리가 저장소 안이면 Git이 ignore하는 경로여야 하고, 아니면
   `out-directory-not-ignored`로 파일을 쓰지 않고 실패합니다(저장소 밖 디렉터리는 그대로 받음). `binding-values-invalid`·`context-output-*`는
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
3. 1단계 전에 실행한 [Dispatch 전 단계](#dispatch-전-단계)의 기록을 QA packet `commands`에 넣습니다. `spawn-arguments.json`의 내용(`review-run.json`의
   `spawnArguments`)을 그대로 spawn 도구에 넘깁니다. 메시지는 QA packet입니다. Frozen source 기준(HEAD·변경 파일),
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
   reviewer에 대한 `followup_task`·`send_message`는 hook이 `review-child`로 deny하므로 더할 질문은 새 회차로 보냅니다. Spawn 전에 그
   메시지의 요청·acceptance·요구 절 문장을 `{"request": …, "acceptance": […], "requirements": …}` JSON 파일로 출력 디렉터리에 두고
   `node scripts/agents/common/review-prejudgment-phrases.mjs --input <파일> --session <sessionId> --host codex`로 사전 판단 문구를
   셉니다. 출력 `count`가 0보다 크면 `matches`의 문장(지적하지 말 것, severity 상한, 계획이 이미 골랐다는 문장)을 위 규칙대로
   고칠지 판단하고, 고치지 않고 보내면 QA packet의 `environment`에 `review-prejudgment-phrase=<count>`를 적습니다(0이면 packet은
   그대로). 이 검사는 막지 않고 경고마다 발동 기록 한 줄을 남깁니다
   ([사전 판단 문구 경고](../../../docs/development/agent-workflows/review-criteria/README.md#사전-판단-문구-경고)).
4. Reviewer 완료 뒤 `$knu-settle`로 reviewer를 수락합니다. 리뷰 대상 lane은 결과를 반영한 뒤 수락합니다. 결과의 `dispatchId`는 그 회차의 `reviewId`입니다. Parent가 finding을
   재현하거나 기각 근거를 남기며, 구현자 자신의 PASS는 독립 리뷰가 아닙니다.

## Dispatch 전 단계

해당하는 단계만 실행하고, 각 실행은 QA packet `commands`와 runner 기록 JSON(`{"records": [{command, exit, observedResult,
outputPaths}]}`, 출력 디렉터리)에 남깁니다. 도구의 위반 종류와 규칙은
[결정적 검사](../../../docs/development/agent-workflows/review-criteria/README.md#결정적-검사)입니다. 아래 항목 이름과 순서는
Claude knu-review의 같은 절과 같습니다.

- Subject 경로: `--paths`에 바뀐 파일과 함께 그 소비자·실행 경로(호출부, 그 동작을 실행하는 test·CLI 진입)를 넣습니다.
  Acceptance가 근거로 가리키는 절(PR 본문의 절 등)은 `--paths`나 `--lifecycle-draft`로 읽기 범위에 둡니다.
- Runner 환경: runner·재현 로그 script는 `bash`로 실행합니다(명령 shell이 zsh면 파이프 앞 명령의 exit `${PIPESTATUS[0]}`가
  비어 있습니다). Codex는 helper가 logHeader를 주지 않으므로 runner가 로그 첫 줄 header(`<문구> sha256:<64 hex>`)를 정합니다.
  Digest는 그 회차 HEAD와 변경 파일(새 파일 포함) 내용으로 계산하고, 모든 log·`--header`·QA packet snapshot에 같은 값을 씁니다.
  Header 다음 줄에 `node --version` 출력을 남깁니다. 오래 도는 단계에는 시간 상한을 두고, 회차 log는 회차마다 새 경로에 써서
  이미 있는 log를 덮지 않으며, script 안에서 앞 출력을 지우는 대신 새 디렉터리를 씁니다.
- Runner 기록 내용: record에는 명령·exit·출력 경로와 log의 결과 조각만 두고, Parent가 의심한 finding 위치나 결론 문장을 넣지
  않습니다.

1. 자체 정합 점검: 수정이 규칙·수치·범위를 바꾸면 같은 유형의 서술(같은 문서의 다른 절·표, 다른 owner 문서, 개수·합계)을 전 범위에서
   검색합니다. 다음 회차를 요청하기 전에 blocking 전부를 한 번에 고치고, 같은 유형 검색은 문장 단위(줄바꿈·연속 공백을 접는 검색
   또는 `rg -U`)로 저장소 전체 tracked 경로(ignored 원천은 `rg --no-ignore`)에서 하고, 결정적 검사를 통과시킨 뒤 요청합니다.
   계획 리뷰는 바뀐 결정·관계마다 그것을 말하는 문장 목록(같은 계획의 다른 절, 다른 owner 문서, 다른 언어로 적은 code 주석, 그
   값을 소유한다고 적은 문서, 그 글을 읽는 test)을 만들어 문장마다 판정합니다. 정합 검색 출력은 줄마다 판정한 기록(줄, 해당
   여부, 고친 곳)을 log에 남기고 검색 exit 0을 판정으로 쓰지 않습니다.
   로그에는 검색마다 명령과 exit 줄(`rg exit=1`은 0건)을 남기고, record는 검색을 모두 실행한 묶음의 exit 0과
   조각(`` `rg exit=1` `` 등)으로 씁니다. 0건 검색을 실패 record로 남기지 않고 exit를 뒤집는 명령(`|| true`, `!`)도 쓰지 않습니다.
   검색 exit 줄은 명령 이름을 붙여 적습니다(`rg exit=1`). 줄 전체 `exit=` 줄은 묶음의 끝 exit에만 씁니다. 검사는 record의
   log마다 마지막 줄 전체 `exit=` 줄을 record `exit`와 대조하고(`exit-mismatch`), 그 앞의 줄 전체 `exit=` 줄이 0이 아닌데 record가
   0이면 `repeated-step-exit-hidden`으로 실패합니다. 한 묶음을 여러 번 실행했으면 실행마다 record를 나눕니다.
   0건으로 부재를 주장하는 검색은 같은 검색을 수정 전 판처럼 결과가 있어야 하는 대상에 돌린 양성 대조를 같은 record에 두고 그 exit
   줄을 `control rg exit=0`처럼 적습니다(없으면 `runner-log-check`가 `absence-without-control` 경고). Ignored·hidden 경로의 부재
   검색은 `rg --no-ignore --hidden`으로 합니다. macOS `git grep -E`의 `\b`는 조용히 0건이므로 낱말 경계 검색은 `rg`나
   `git grep -P`로 합니다.
2. 새 파일: frozen source는 HEAD와 변경 파일이고 새 파일도 `--paths`에 경로로 넣으므로 stage하지 않습니다. Tracked 파일만 보는
   검사(`pnpm test:repo-policy`)가 새 파일을 보게 하려면 commit한 snapshot에서 실행하고, commit 전이면 저장소 밖 독립 clone에서
   새 파일을 add한 뒤 실행해 record로 남깁니다. 메인 checkout의 stage를 바꾸지 않습니다.
3. RED 사유: RED 기록이 있으면 `node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex>`로 실패 사유를
   대조합니다. 입력은 `node --test` spec reporter나 Vitest 기본 reporter의 자르지 않은 출력입니다. `no-failure-blocks`이거나
   block이 `'test failed'`뿐이면 module 수준 오류가 block 밖에 찍힌 것이므로 `--test-isolation=none`으로 다시 실행합니다.
4. 인용: 리뷰 입력에 계획·증거·readiness Markdown이 있으면 `node scripts/agents/common/citation-check.mjs <md file...>`을
   실행합니다.
5. 계획 리뷰 등급: 계획 리뷰면 등급을 선언하고
   `node scripts/agents/common/plan-shape-check.mjs --revision <before.md> <after.md> --declared <P0|P1|P2|P3>`을 실행합니다(P0는
   리뷰 없음, P1은 reviewer 없음.
   [계획 리뷰 등급](../../../docs/development/agent-workflows/session-continuity.md#계획-초안-staging과-promote)). P2·P3면
   `node scripts/agents/common/plan-reference-check.mjs <plan md...>`도 그 절 3번의 기준 대비 판정(기준과 promote view에 함께
   돌려 기준에 없던 위반이 0)으로 실행합니다.
6. Mutation: 검사·harness 변경의 test 보호를 주장하면 `node scripts/agents/common/mutation-harness.mjs --spec <JSON>`을
   실행합니다(spec은 계획 증거 위치의 리뷰 디렉터리). 판정 분기의 test 보호를 주장하는 변경은 저장소 밖 독립 clone에서 바뀐 판정
   module의 연산자 mutation sweep(비교·논리 연산자, 경계값, 조건 반전)을 돌려 survivor 목록을 runner 기록에 두고, survivor를 동등으로
   처분할 때마다 동등을 보이는 재현 입력과 출력(결과가 달라질 수 있는 입력을 찾아본 범위 포함)을 붙입니다.
7. Runner 기록 검사: 1단계 등록 전에 `node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header "<logHeader>"`를
   runner 기록 JSON과 위 header로 실행하고 exit 0이 아니면 등록하지 않습니다. 위치 인자는 받지 않고 usage와 함께 exit 2입니다.
   이 실행은 같은 기록의 record가 될 수 없습니다. 조각 위반의 `suggestion`은 그 log 결과 줄에서 맞는 조각 모양입니다. 경고
   `absence-without-control`은 exit를 바꾸지 않으니 양성 대조를 더하거나, 대조할 수 없으면 그 이유를 그 record의 log에 적습니다.
   Codex는 이어 쓰지 않습니다. 이 실행에는 carry basis가 없으므로 앞 회차 log를 이어 쓴 record(Claude `review-run` 필드
   `carriedFrom`)는 `carry-basis-missing`으로 실패합니다.
