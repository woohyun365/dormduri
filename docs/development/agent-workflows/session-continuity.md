# Session continuity

새 session은 이전 transcript를 복제하는 대신 현재 repository evidence로 작업을 재구성합니다.

Repository 상태의 읽기 전용 요약은 `pnpm agent:preflight`를 사용합니다. Resume 작업에서는
`node scripts/agents/session-preflight.mjs --resume --plan <repository-relative-plan> --json`으로 plan pointer의 존재만
확인하고, plan 내용과 완료 주장은 직접 code/test/git evidence에 대조합니다.

## Fresh task

1. current user request를 읽습니다.
2. branch, `HEAD`, `git status --short`를 확인합니다.
3. 요청과 직접 관련된 production code, contract, test, tracked docs만 읽습니다.
4. 사용자가 plan을 명시했거나 작업 복잡도가 요구할 때만 active plan을 읽습니다.
5. notepad, context snapshot, wiki, project memory, finished plan을 기본 입력으로 읽지 않습니다.

## Resume task

다음 중 하나가 참일 때만 resume 경로를 사용합니다.

- 사용자가 `이어서`, 특정 plan 또는 phase 재개를 명시함
- active OMX mode, team 또는 goal이 존재함
- notepad priority가 current branch의 active context를 가리킴
- interruption 또는 compaction checkpoint가 존재함

Resume 순서:

```text
current request
→ branch / HEAD / working tree
→ notepad priority pointer
→ .omx/context/<task-slug>-<timestamp>.md
→ active plan checkpoint
→ code/test/git log freshness verification
→ relevant tracked policy/architecture/runbook
```

checkpoint가 working tree나 최신 요청과 충돌하면 checkpoint를 폐기하거나 갱신합니다.

## Bounded checkpoint

Checkpoint는 다음 경우에만 만듭니다.

- context가 compaction에 가까움
- session interruption이나 handoff 직전
- multi-phase 작업의 commit/stage 경계를 완료함
- 다른 session이 즉시 이어받아야 함

내용은 [Agent execution contract](./agent-execution-contract.md)의 handoff schema를 따릅니다. 일반 turn마다 만들지
않으며 완료 시 priority pointer를 비웁니다. tracked 문서나 commit으로 승격된 context snapshot은 제거할 수 있습니다.

## Active plan lifecycle

- `.omx/plans/` root에는 authoring handoff와 active plan만 둡니다.
- 완료 상태는 changed files, verification, commit/stage state와 blocker를 가리켜야 합니다.
- 현재 결정할 수 없는 provider/account/domain/instance 값은 tracked readiness/evidence handoff로 옮깁니다.
- 완료 plan은 `finished/YYYY/MM/<domain>/`으로 이동하고 current priority에서 제거합니다.

## Closeout

작업 종료 시 plan과 notepad를 진행 결과처럼 보고하지 않습니다. 실제 파일 변경, 검증 결과와 blocker를 보고하고 active
runtime을 닫습니다. local state가 tracked source of truth를 대신하지 않게 정리합니다.

`omx_wiki/`는 명시적으로 승격한 재사용 지식만 소유합니다. 세션 종료 메타데이터는 repository
`.omx-config.json`의 `wiki.autoCapture: false`로 자동 생성하지 않으며, `session-log-*.md`는 Git 방어선에서도
제외합니다.
