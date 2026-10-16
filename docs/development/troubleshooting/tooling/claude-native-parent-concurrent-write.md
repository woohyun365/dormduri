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

Writer task가 실행되는 동안에는 Parent의 Edit·Write·NotebookEdit가 먼저 거부될 수 있습니다.

```text
KNU native task: Parent write during active writer task <taskId>: settle it first, or after the child ended run pnpm claude:native release --task <taskId> --ended
```

## 원인

Collector는 등록 시점과 정산 시점의 파일 목록을 비교합니다. 대상은 저장소의 tracked·비ignored 파일과 task의 read 범위
파일입니다. 이 차이는 누가 바꿨는지 알려 주지 않습니다. 같은 checkout에서 Parent와 child가 쓰면 두 변경을 구분할 수 없습니다.

- Child의 write 범위 안 변경만 child 변경(`changedPaths`)으로 기록합니다.
- Write 범위 밖 변경은 child 것으로 기록하지 않고 `unattributable-change:<path>`로 거부합니다. 수정·새 파일·삭제가 모두
  해당하며 writer는 read 범위 안팎을 가리지 않습니다. 읽기 전용 child는 정산 때 의존 집합(read 범위, packet read path, 결속
  입력, transcript가 보인 읽기) 안 변경만 거부하고 밖 변경은 `dependencyJudgment`에 기록만 남깁니다
  ([registry 8단계](../../agent-workflows/adapters/claude-native-registry.md)).
- Child가 멈춘 뒤의 변경은 `post-completion-file-drift`·`post-completion-source-drift`로도 나타납니다. 읽기 전용 child는 의존 집합
  안 변경이 있을 때만 나타납니다.
- Write 범위 **안**의 Parent 수정은 child 변경과 구분할 수 없어 탐지하지 못합니다. Hook이 실행되면 file guard가
  Edit·Write·NotebookEdit를 막고, 그 밖은 운영 규칙으로 막습니다.

### File guard가 막는 경우와 막지 못하는 경우

PreToolUse `Edit|Write|NotebookEdit` hook(`native-session.mjs --hook --file-guard`)은 두 경우만 deny합니다.

- 이 세션의 writer lease(`.artifacts/tools/claude-native/writer.json`)가 있는 동안 main thread가 tracked·비ignored 경로를 쓰는 경우.
  `git check-ignore`가 ignored로 판정한 경로(`.artifacts/`·`.plans/` 등)와 저장소 밖 경로는 허용합니다.
- Subagent(`agent_id` 있음)가 native evidence(`.artifacts/tools/claude-native/**`)를 쓰는 경우. 대소문자 변형과 link도 같은
  경로로 봅니다.

Hook은 `allow`를 반환하지 않고, 오류가 나면 exit 1로 끝나 편집을 막지 않습니다. 다음 경우는 막지 못합니다.

- Bash·기타 도구의 쓰기, hook 부재·오류, 1 MB를 넘는 payload
- 다른 세션의 lease, `--resume`으로 `session_id`가 바뀐 세션
- Lease가 있는 동안 비KNU subagent(`agent_id` 있음)가 일반 경로를 쓰는 경우
- 대상이 아직 없는 파일을 가리키는 끊어진 link인 경우(link 위치로 판정)

Parent 쓰기 쪽의 이런 누락이 child write 범위 밖이면 정산 때 collector가 `unattributable-change`로 거부합니다. 범위 안이면
child 변경으로 기록되어 탐지하지 못합니다.

Child의 evidence 쓰기 쪽은 다릅니다. `.artifacts`는 ignored라 collector 목록에 없어 `unattributable-change`로 잡히지 않습니다.
이 경우의 보장은 `complete`의 `responseDigest` 결속·형식 검사와 Lead의 판정입니다.

## 해결

1. 등록부터 정산까지 Parent는 tracked·비ignored 경로를 수정하지 않습니다. Child의 write 범위 안이든 밖이든 같습니다.
   Parent 메모와 증거는 ignored 경로(`.artifacts/`·`.plans/`)에 둡니다. 단 reviewer task는 ignored 리뷰 입력도 결속하므로
   `review` 생성부터 그 reviewer 정산과 연결 builder 완료까지 리뷰 read path(디렉터리 포함) 아래 ignored 파일도 바꾸지 않고, 그 기간의
   메모·result·처분 기록·재현 로그는 리뷰 read path 밖에 둡니다.
2. 완료 알림이 오면 **파일을 편집하기 전에** 먼저 정산합니다.
3. File guard deny를 받으면 child 완료를 기다려 정산합니다. Child가 끝났는데 정산할 수 없으면
   `pnpm claude:native release --task <taskId> --ended`로 lease를 해제합니다. Task 기록이 손상돼 `release`도 실패하면
   lease가 남아 deny가 계속됩니다. 이때는 child 종료를 확인한 뒤 Parent가 ignored 경로의
   `.artifacts/tools/claude-native/writer.json`을 지웁니다.
4. 이미 거부됐다면 기록을 고치거나 지우지 않습니다. 표시된 경로가 Parent 변경인지 확인하고, 필요하면 새 task를 등록해 다시
   실행합니다. 거부 사유를 PASS로 바꾸지 않습니다.

## 검증

```bash
node --test scripts/ci/agents/claude/claude-native-session.test.mjs
```

`unattributable change: *` 여섯 테스트가 수정·새 파일·삭제(read 범위 안팎)의 거부와 `changedPaths` 제외를 고정합니다.
`a writer changing only its write scope` 테스트가 정상 child 쓰기의 오탐 부재를, `an edit after the child stopped` 테스트가
정지 뒤 변경의 drift 판정을 고정합니다. `file guard *` 테스트가 deny 두 경우, 일반 작업의 비차단, 오류의 exit 1을 고정합니다.

## 참고

- [Claude Code adapter의 등록·정산 절차](../../agent-workflows/adapters/claude-native-registry.md)
- [완료 관측 누락](./claude-native-completion-observation-missing.md)
