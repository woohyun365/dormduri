# 트러블슈팅: Claude native 등록·독립 리뷰 결과가 거부됨

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, `pnpm claude:native prepare/register/review/settle/complete`
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

- `pnpm claude:native register --input <JSON file>`가 거부됩니다. 일반 사유 뒤에 model policy 사유(`profile:`)와
  입력 필드(`input:`)가 붙습니다.

  ```text
  workflow not ready: strict-native-dispatch-not-qualified; profile: invalid-input; input: binding-lifetime-exceeds-30m
  workflow not ready: strict-native-dispatch-not-qualified; profile: invalid-input; input: unsafe-reference:nativeRequest.task.facts[0].sourceRef
  workflow not ready: strict-native-dispatch-not-qualified; profile: risk-downgrade
  ```

- `pnpm claude:native prepare --spec <JSON file>`는 같은 입력 필드 사유를 register 전에 `invalid prepare spec:`으로 보여 줍니다.
  Policy 판정 사유(`risk-downgrade` 등)는 register와 같은 형식으로 나옵니다.

  ```text
  invalid prepare spec: selection-basis-required
  invalid prepare spec: binding-lifetime-exceeds-30m
  invalid prepare spec: fact-confidence-not-high:source-bound
  invalid prepare spec: review-snapshot-stale: rebuild the review for the current source
  ```

- 공통 workflow가 요청을 `intent: unknown`으로 분류해 등록이 진행되지 않습니다.
- 독립 reviewer가 PASS를 반환했는데 완료 판정이 거부됩니다.

  ```text
  PASS requires a complete result with no blocking finding or evidence gap.
  read-only reviewer cannot be the packet runner
  review commandsActuallyRun differs from the bound runner records
  ```

- Read-only subject(쓰기 범위 없음)를 review하려는데 다음 중 하나로 거부됩니다.

  ```text
  subject response artifact does not match the settled response
  read-only subject review needs its response artifact
  writer subject response is not review input
  records[<n>]: RED record needs purpose "red" and a non-zero integer expectedExit
  ```

- `settle --task <reviewerTaskId> --judgment <file>`이 `parent-adjudication: this reviewer has no native subject`로 거부됩니다.
- reviewer PASS를 연결해 builder를 완료하려는데 다음 중 하나로 거부됩니다.

  ```text
  subject has an unsettled or released review attempt: <taskId>
  subject has a review dispatch not observed by hooks: <taskId>
  review dispatch check unavailable: <reason>
  subject has a review whose child transcript changed after settlement: <taskId>
  unreadable native task: <taskId>
  ```

## 원인

- `nativeRequest.issuedAt`부터 `expiresAt`까지는 최대 30분입니다. 넘으면 model policy가 `invalid-input`으로 거부하고,
  입력 필드 사유는 `binding-lifetime-exceeds-30m`입니다.
- 선택 근거(`selectionBasisRef`)와 fact `sourceRef`는 영문자·숫자로 시작하고 `#`·`//`·`.`·`..` 경로 조각을 쓸 수 없습니다.
  숨김 디렉터리 경로처럼 `.`으로 시작하는 참조는 `unsafe-reference:<field>`입니다.
- Task의 `impactRisk`가 intake가 판정한 요청 risk보다 낮으면 `risk-downgrade`입니다.
- 공통 intake가 모든 한국어 조사 표현을 읽기 intent로 분류하지는 않습니다. `조사해줘`·문장 끝 `조사`는 `analyze`지만
  `살펴봐줘`·`확인해줘`, `원인` 없이 쓴 `파악해줘`처럼 인식하지 않는 표현은 `unknown`으로 남습니다.
- 공통 PASS 규칙은 `notRun`·`knownGaps`·coverage gap이 하나라도 있으면 PASS를 거부합니다. 읽기 전용 reviewer에게 검증 명령을
  실행하지 말라고 하면서 실행 결과 칸을 비우게 하면, 실행하지 않은 검증이 `notRun`으로 들어가 PASS가 거부됩니다.
- 읽기 전용 reviewer는 packet의 runner(`authority.runnerOwner`)가 될 수 없습니다.
- Helper가 만든 review는 결과 template(runner 기록 포함)을 등록 prompt에 결속합니다. Reviewer 결과의 `commandsActuallyRun`이
  그 기록과 하나라도 다르면(추가·삭제·변경) 정산을 거부합니다.
- `parent-adjudication` reviewer는 native subject가 없어 `settle --judgment`로 정산할 수 없습니다.
- Read-only subject의 응답은 helper가 `subject-response.txt`에 한 번 쓰고 reviewer 등록 때 정산된 응답과 대조합니다. 파일을 고치면
  거부됩니다. Writer subject의 응답은 builder 추론이라 read path에 넣을 수 없습니다.
- RED 기록은 `purpose:"red"`와 0이 아닌 `expectedExit`를 함께 가져야 합니다. 한쪽만 있거나 다른 값이면 거부합니다.
- builder 연결은 같은 subject를 검토한 **모든** reviewer의 결과를 확인합니다. 아직 결과가 기록되지 않은 reviewer(`unsettled`),
  hook이 기록하지 않은 reviewer 호출(hook 장애 중 재호출 등), 읽을 수 없는 세션 transcript, 정산 뒤 재개된 reviewer, 손상된 task 기록은
  FAIL을 숨길 수 있으므로 PASS 연결을 막습니다.

## 해결

- 등록 입력은 `pnpm claude:native prepare --spec <JSON file>`로 조립합니다. Spec은 Lead가 고른 role·profile·선택 근거·
  scope·acceptance·QA disposition·facts만 담고, helper는 수명(기본 15분, 최대 30분)·도구 목록·ID를 채워 register합니다.
  출력의 `dispatchAuthorized:false`는 host 권한이 아니라는 뜻입니다. 만료되면 새로 prepare합니다.
- 참조는 `plan:<Plan ID>/<절>`·`owner-request:<ID>`처럼 영문자로 시작하는 형식을 씁니다.
- `risk-downgrade`는 요청 risk를 낮추지 말고 task `impactRisk`를 요청 risk 이상으로 올리거나 요청을 나눕니다.
- 요청 문장은 분석·검토처럼 intake가 인식하는 동사로 씁니다. 분류를 우회하려고 intent를 직접 조작하지 않습니다.
- 검증 명령은 Parent(runner)가 실행하고 `pnpm claude:native review`로 packet을 만듭니다. `review --subject <taskId>`만 실행하면
  이번 회차의 `snapshotDigest`와 `logHeader`가 나옵니다. Runner는 `logHeader`를 검증 로그 첫 줄에 두고, 각 기록을
  `{command, exit, environment, observedResult, outputPaths, sourceDigest}`로 남깁니다(`sourceDigest`는 그 digest,
  `outputPaths`는 `.artifacts/` 아래). 이어서 `--runner-evidence <file> --basis <ref> --reviewer-model <model ID>`를 더하면
  packet·reviewer prompt·결과 template·reviewer spec이 나옵니다. 결과 template의 `commandsActuallyRun`은 runner 기록에서만
  채워지고 builder의 응답·추론은 packet에 들어가지 않습니다. Reviewer는 자신이 실행했다고 주장하지 않으며, 실행하지 않은 검증을
  PASS로 바꾸지 않습니다. 다른 회차의 digest나 추가 필드가 있는 기록은 거부됩니다.
- 수정 전 실패(RED)는 exit를 뒤집지 말고 `purpose:"red"`·`expectedExit`로 기록합니다. 기대와 같은 exit만 known failure에서
  빠지고, 다른 exit(0 포함)는 known failure로 남아 PASS를 막습니다.
- Read-only subject는 `review --subject <taskId>`로 그대로 review합니다. 응답을 Parent가 파일로 옮겨 `--parent-subject`로
  우회하지 않습니다. `subject response artifact does not match`는 artifact가 바뀐 것입니다. 손으로 고치지 말고 파일을 지운 뒤
  `review`를 다시 실행하면 정산된 응답으로 다시 씁니다.
- Parent가 직접 작성한 변경은 native subject task가 없습니다. `review --parent-subject <file> --session <session_id>`는 `settlement:"parent-adjudication"`을
  표시하고 QA가 필요한 일반 review task spec을 만듭니다. 이 reviewer는 `complete`로 PASS 정산되지 않습니다. Parent가
  reviewer의 `completion.json` 관측(valid·모델·변경 경로)과 finding 재현으로 판정하고, `finalSnapshot`의 digest가 review
  `logHeader`의 digest와 같은지 확인합니다. Review를 만든 뒤 source가 바뀌면 `prepare`가 `review-snapshot-stale`로 거부합니다.
- `commandsActuallyRun` 불일치는 reviewer가 runner 기록을 바꾼 것입니다. 결과를 고치지 말고 새 reviewer로 다시 review합니다.
- `parent-adjudication` 거부는 정상입니다. `settle --task <reviewerTaskId>`로 관측만 정산하고 아래 Parent 판정 절차를 따릅니다.
- `unsettled`는 해당 reviewer의 완료 알림을 기다려 정산한 뒤 다시 연결합니다. 결과 없이 release했다면 되돌릴 수 없습니다.
- 나머지 builder 연결 거부는 기존 결과를 신뢰할 수 없다는 뜻입니다. 기록을 고치거나 지우지 말고, hook을 확인한 뒤 새 builder task와
  새 review로 해소합니다.
- FAIL은 review 완료입니다. Finding을 판정하고 수정한 뒤 새 builder task와 새 review로 해소합니다. 다른 reviewer의 PASS를
  연결해 FAIL을 덮을 수 없습니다.

## 검증

```bash
node --test scripts/ci/claude-native-session.test.mjs scripts/ci/claude-native-task-helper.test.mjs scripts/ci/cross-model-handoff-contract.test.mjs
```

`registration names the concrete policy reason`과 `claude-native-task-helper.test.mjs`의 prepare·review·Parent-authored 테스트가
등록 사유 표시, runner 기록 형식, `parent-adjudication` 경로를 고정하고, `a helper-built review cannot add, drop or change
runner records`가 runner 기록 결속을 고정합니다.
`read-only reviewer cites runner-owned checks`, `reviewer registration rejects the reviewer as runner`,
`a reviewer FAIL receipt cannot be bypassed` 테스트가 위 규칙을 고정합니다. Read-only subject와 RED 기록은
`a read-only subject is reviewed from its bound response`, `a changed response artifact is refused`,
`other native task evidence never enters a review read path`, `a RED record passes only at its declared expected exit`
테스트가 고정합니다. Builder 연결 거부는 `hook-less retry`,
`each reviewer session transcript`, `settled sibling review resumed`, `foreground-completed reviewer cannot be resumed` 테스트가
고정합니다.

## 참고

- [독립 review disposition](../../agent-workflows/qa.md)
- [Claude Code adapter의 same-host 독립 review](../../agent-workflows/adapters/claude-code.md)
