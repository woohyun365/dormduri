# Codex same-host independent review

[Codex adapter](./codex.md)의 Codex/OMX host 전용 reference입니다. 진입 절차와 routine 운영은 그 문서를, 회차·처분의 공통
규칙은 [QA 리뷰 회차](../qa.md#리뷰-회차)와 [처분 기록](../review-criteria/README.md#처분-기록)을 먼저 읽습니다. 절 순서는
[Claude same-host review](./claude-same-host-review.md)와 같고, 실행 단계는 `$knu-review`·`$knu-settle` skill이 가집니다.

## Same-host independent review

Codex Parent가 위임한 lane이나 Parent 자신이 쓴 변경은 같은 host의 `knu_reviewer` child가 검토합니다. 한 회차는
`pnpm -s codex:delegate -- review-run --lanes <laneId[,laneId…]> --token <dispatch token> --round <N> --paths <리뷰 대상 경로[,경로…]> --out <출력 디렉터리>`
한 번입니다. 이 명령이 기준 문서 선택, 리뷰어 입력 수집, reviewer dispatch 등록을 하고 stdout에 `review-run ok …` 또는
`review-run failed …` 한 줄을 냅니다. 하나라도 거부되면 등록하지 않습니다. 저장소 안 `--out`은 Git이 ignore하는 경로여야 합니다.

- 등록: `.artifacts/tools/codex-native/<sessionId>/<task_name>.json`(`knu-codex-task-registration/v1`, `kind: review`,
  `reviewId`, `round`, `dispatchToken`, `reviewOf`)을 한 번 씁니다. `reviewId`와 task 이름은 dispatch token과 회차로 정해집니다.
- 기준 기록: 같은 디렉터리의 `<reviewId>.criteria.json`이 고른 기준 문서·항목·선택 이유와 `documentCount`·`itemCount`·
  `unmatchedPaths`를 남깁니다. 선택 규칙은 Claude와 같은 [자동 선택](../review-criteria/README.md#자동-선택)입니다.
- 리뷰어 입력: `<reviewId>.context.json`의 `inputs`와, 걸린 binding 행이 있으면 `<reviewId>.binding.md`, PR `## Lifecycle` 초안을
  주면 `<reviewId>.lifecycle.md`입니다. 규칙은 [리뷰어 입력](../review-criteria/README.md#리뷰어-입력)입니다.
- Packet: Parent가 `spawn-arguments.json` 내용을 그대로 spawn 도구에 넘기고, 메시지에 QA packet(frozen source 기준, acceptance,
  기준 문서, 읽기 범위, 2회차부터 delta)을 싣습니다. 보내기 전에 사전 판단 문구를 셉니다(`$knu-review` 3단계).
- 완료: reviewer가 멈추면 hook 기록과 결과를 대조한 뒤 `pnpm -s codex:accept`로 수락하고 `<task_name>.accepted.json`이 남습니다
  ([완료 관측](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)). Codex는 reviewer 결과 JSON을 registry나 hook
  기록에 두지 않으므로 Parent가 그 작업 계획 증거 위치에 저장합니다.

### 회차와 후속 질문

- 1회차는 `--round 1`, 수정 뒤 새 snapshot을 리뷰하면 같은 dispatch token에 다음 `--round`입니다. 2회차부터 delta만 읽는 범위와
  전 범위로 돌아가는 조건은 [리뷰 회차](../qa.md#리뷰-회차)가 정합니다.
- 실행 중이거나 멈춘 reviewer에 대한 `followup_task`·`send_message`는 hook이 `review-child`로 deny합니다. Reviewer에 더할 질문은
  새 회차로 보냅니다([hook guardrail](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)).
- 구현자 자신의 PASS와 host 자체 리뷰(built-in `/review`, fork 자식)는 독립 리뷰 근거가 아닙니다.

### 처분 기록과 ledger

- 회차마다 결과를 `r<N>-result.json`으로 저장하고 처분 기록 `r<N>-adjudication.json`(`review-adjudication/v1`)을 Claude와 같은
  형식으로 씁니다. `reviews[].taskId`는 Codex task 이름, `reviews[].resultPath`는 그 결과 파일입니다. 작성 때
  `node scripts/agents/common/review-adjudication.mjs <파일>`이 exit 0인지 확인합니다(`fixRef`·`parent-checked` 경로 검사 포함).
- Ledger reader: `node scripts/agents/codex/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]... [--until <ISO 시각>] [--json]`.
  `.artifacts/tools/codex-native/*/`의 `kind: review` 등록을 행(`host: 'codex'`)으로 바꾸고, `--adjudications` 아래 처분 기록과
  task 이름으로 연결해 [공통 ledger](../review-criteria/README.md#리뷰-측정)에 넘깁니다.
- 행 상태: 수락 기록이 없으면 `completion-missing`, 수락됐고 처분 기록이 가리키는 결과가 `verdict` 문자열과 `findings` 배열을
  가지면 `parsed`, 수락됐지만 그 결과가 없거나 읽지 못하면 `parse-failed`, 등록 기록을 읽지 못하면 `task-unreadable`입니다.
- 행 field: `round`는 등록의 `round`, subject 키는 처분 기록 `subject`, 없으면 `dispatch:<dispatch token>`입니다. `subjectSize`는
  `<reviewId>.criteria.json`의 경로 수·`documentCount`, `snapshot`은 결과 `reviewedSnapshot`의 digest입니다. 등록에 발행 시각이
  없어 `issuedAt`은 null이고, `--until`을 주면 모든 Codex 행이 빠지고 `excludedWithoutIssuedAt`으로 셉니다.
- 옛 기록 위반만 있는 처분 기록의 `legacyAdjudications` 셈과 exit 규칙은 Claude reader와 같습니다
  ([리뷰 측정](../review-criteria/README.md#리뷰-측정)).
