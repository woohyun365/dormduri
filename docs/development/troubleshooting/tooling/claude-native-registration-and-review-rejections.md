# 트러블슈팅: Claude native 등록·독립 리뷰 결과가 거부됨

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, `pnpm claude:native register/complete`
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

- `pnpm claude:native register --input <JSON file>`가 다음 오류로 거부됩니다.

  ```text
  invalid-input
  ```

- 공통 workflow가 요청을 `intent: unknown`으로 분류해 등록이 진행되지 않습니다.
- 독립 reviewer가 PASS를 반환했는데 완료 판정이 거부됩니다.

  ```text
  PASS requires a complete result with no blocking finding or evidence gap.
  read-only reviewer cannot be the packet runner
  ```

- reviewer PASS를 연결해 builder를 완료하려는데 다음 중 하나로 거부됩니다.

  ```text
  subject has an unsettled or released review attempt: <taskId>
  subject has a review dispatch not observed by hooks: <taskId>
  review dispatch check unavailable: <reason>
  subject has a review whose child transcript changed after settlement: <taskId>
  unreadable native task: <taskId>
  ```

## 원인

- `nativeRequest.issuedAt`부터 `expiresAt`까지는 최대 30분입니다. 넘으면 model policy가 `invalid-input`으로 거부합니다.
- 공통 intake가 모든 한국어 조사 표현을 읽기 intent로 분류하지는 않습니다. 이 경우 요청은 `unknown`으로 남습니다.
- 공통 PASS 규칙은 `notRun`·`knownGaps`·coverage gap이 하나라도 있으면 PASS를 거부합니다. 읽기 전용 reviewer에게 검증 명령을
  실행하지 말라고 하면서 실행 결과 칸을 비우게 하면, 실행하지 않은 검증이 `notRun`으로 들어가 PASS가 거부됩니다.
- 읽기 전용 reviewer는 packet의 runner(`authority.runnerOwner`)가 될 수 없습니다.
- builder 연결은 같은 subject를 검토한 **모든** reviewer의 결과를 확인합니다. 아직 결과가 기록되지 않은 reviewer(`unsettled`),
  hook이 기록하지 않은 reviewer 호출(hook 장애 중 재호출 등), 읽을 수 없는 세션 transcript, 정산 뒤 재개된 reviewer, 손상된 task 기록은
  FAIL을 숨길 수 있으므로 PASS 연결을 막습니다.

## 해결

- 등록 수명은 15분 안팎으로 두고 30분을 넘기지 않습니다. 만료되면 새로 등록합니다.
- 요청 문장은 분석·검토처럼 intake가 인식하는 동사로 씁니다. 분류를 우회하려고 intent를 직접 조작하지 않습니다.
- 검증 명령은 Parent(runner)가 실행하고, 그 출력과 source digest를 packet에 넣습니다. Reviewer는 그 증거를 평가하며
  자신이 실행했다고 주장하지 않습니다. 실행하지 않은 검증을 PASS로 바꾸지 않습니다.
- `unsettled`는 해당 reviewer의 완료 알림을 기다려 정산한 뒤 다시 연결합니다. 결과 없이 release했다면 되돌릴 수 없습니다.
- 나머지 builder 연결 거부는 기존 결과를 신뢰할 수 없다는 뜻입니다. 기록을 고치거나 지우지 말고, hook을 확인한 뒤 새 builder task와
  새 review로 해소합니다.
- FAIL은 review 완료입니다. Finding을 판정하고 수정한 뒤 새 builder task와 새 review로 해소합니다. 다른 reviewer의 PASS를
  연결해 FAIL을 덮을 수 없습니다.

## 검증

```bash
node --test scripts/ci/claude-native-session.test.mjs scripts/ci/cross-model-handoff-contract.test.mjs
```

`read-only reviewer cites runner-owned checks`, `reviewer registration rejects the reviewer as runner`,
`a reviewer FAIL receipt cannot be bypassed` 테스트가 위 규칙을 고정합니다. Builder 연결 거부는 `hook-less retry`,
`each reviewer session transcript`, `settled sibling review resumed`, `foreground-completed reviewer cannot be resumed` 테스트가
고정합니다.

## 참고

- [독립 review disposition](../../agent-workflows/qa.md)
- [Claude Code adapter의 same-host 독립 review](../../agent-workflows/adapters/claude-code.md)
