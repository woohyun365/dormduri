# 트러블슈팅: Claude native task 정산이 `unattributable-change`로 거부됨

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, 일반 `claude --permission-mode auto`, `pnpm claude:native`
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Child가 끝난 뒤 `completion.json`이 invalid이고, `pnpm claude:native complete --task <taskId> --input <JSON file>`도 같은
사유로 거부됩니다. 오류에는 바뀐 경로가 함께 표시됩니다.

```text
unattributable-change:docs/example.md
native-observation-required
```

주로 child가 실행되는 동안 Parent(Lead)가 다른 파일을 편집하거나 format·생성 명령을 실행했을 때 나타납니다.

## 원인

Collector는 등록 시점과 정산 시점의 파일 목록을 비교합니다. 대상은 저장소의 tracked·비ignored 파일과 task의 read 범위
파일입니다. 이 차이는 누가 바꿨는지 알려 주지 않습니다. 같은 checkout에서 Parent와 child가 쓰면 두 변경을 구분할 수 없습니다.

- Child의 write 범위 안 변경만 child 변경(`changedPaths`)으로 기록합니다.
- Write 범위 밖 변경은 child 것으로 기록하지 않고 `unattributable-change:<path>`로 거부합니다. 수정·새 파일·삭제가 모두
  해당하며 read 범위 안팎을 가리지 않습니다. 읽기 전용 child라면 모든 변경이 여기에 해당합니다.
- Child가 멈춘 뒤의 변경은 `post-completion-file-drift`·`post-completion-source-drift`로도 나타납니다.
- Write 범위 **안**의 Parent 수정은 child 변경과 구분할 수 없어 탐지하지 못합니다. 이 경우는 운영 규칙으로만 막습니다.

## 해결

1. 등록부터 정산까지 Parent는 tracked·비ignored 경로를 수정하지 않습니다. Child의 write 범위 안이든 밖이든 같습니다.
   Parent 메모와 증거는 ignored 경로(`.artifacts/`·`.plans/`)에 둡니다.
2. 완료 알림이 오면 **파일을 편집하기 전에** 먼저 정산합니다.
3. 이미 거부됐다면 기록을 고치거나 지우지 않습니다. 표시된 경로가 Parent 변경인지 확인하고, 필요하면 새 task를 등록해 다시
   실행합니다. 거부 사유를 PASS로 바꾸지 않습니다.

## 검증

```bash
node --test scripts/ci/claude-native-session.test.mjs
```

`unattributable change: *` 여섯 테스트가 수정·새 파일·삭제(read 범위 안팎)의 거부와 `changedPaths` 제외를 고정합니다.
`a writer changing only its write scope` 테스트가 정상 child 쓰기의 오탐 부재를, `an edit after the child stopped` 테스트가
정지 뒤 변경의 drift 판정을 고정합니다.

## 참고

- [Claude Code adapter의 등록·정산 절차](../../agent-workflows/adapters/claude-code.md)
- [완료 관측 누락](./claude-native-completion-observation-missing.md)
