# 트러블슈팅: Claude hook 장애 시 KNU Agent가 계속 실행됨

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, 일반 `claude --permission-mode auto`, owner Home 설정과 OMC 5.5.0 plugin 로드
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Project hook 명령이 실행되지 않는 상태(checkout 이동, `node` PATH 누락, 실행 파일 부재 등)에서 `knu_*` Agent를 호출하면
승인 prompt나 거부 없이 child가 시작되고 결과까지 돌아옵니다. Transcript에는 hook 오류만 남습니다.

```text
/nonexistent/knu-qualified-hook: No such file or directory
```

`.artifacts/tools/claude-native/<taskId>/`에는 `task.json`만 있고 `attempt.json`·`launch.json`·`completion.json`이 없습니다.

## 원인

[공식 hook 문서](https://code.claude.com/docs/en/hooks#exit-code-output) 기준으로 시작할 수 없는 command hook, timeout,
exit 2가 아닌 오류는 non-blocking입니다. 그래서 PreToolUse 검사가 실행되지 않으면 Agent 호출은 일반 permission 판정으로 진행됩니다.
`Agent`는 기본적으로 승인이 필요 없는 도구입니다. 역할 이름을 지정한 `Agent(<role>)` ask 규칙과 PermissionRequest hook을 더해도
위 검증 환경의 새 auto 세션에서는 prompt와 PermissionRequest 이벤트가 생기지 않았습니다. 공식 문서의 ask 설명과 다른 관측이므로
이 조합을 실행 전 gate로 쓰지 않습니다.

Hook이 실행된 뒤 오류로 끝나는 경우는 이벤트마다 다릅니다. PreToolUse 오류는 exit 2로 그 호출을 막습니다. PostToolUse 계열은
exit 2로 stderr를 Claude에게 보여 주지만 막지 않습니다. SubagentStop·SessionStart 오류는 stderr `KNU hook failed: …`와 exit 1로
끝납니다. 공식 문서 기준 exit 1은 transcript에 `<hook name> hook error` 알림을 남기는 non-blocking 오류라 child 정지를 막지
않습니다. 이 알림 행은 live로 관측하지 않았고, 단위 test는 exit code와 stderr만 확인합니다. 다른 checkout에서 복사됐거나 손상된
task 기록은 SendMessage·SubagentStop 처리에서 건너뛰고, 그 task 자체는 완료 판정에서 거부됩니다. Payload를 해석할 수 없거나
관리 대상 확인 전에 난 오류는 exit 2로 남습니다.

## 해결

- 실행 자체를 막는다고 주장하지 않습니다. 이 adapter가 보장하는 것은 **완료 판정 거부**입니다. hook 기록이 없는 task는
  `pnpm claude:native complete`에서 `no-completion-observation` 또는 `missing-pretool`로 거부됩니다.
- Hook 상태는 Lead의 서술이 아니라 task 기록과 transcript의 hook 오류 행으로 판단합니다. Live 재현에서 화면에는 hook 오류가
  표시됐는데도 Lead가 "hook 오류 없음"이라고 보고한 사례가 있었습니다.
- 거부된 task의 child 출력은 참고 자료일 뿐입니다. Hook을 복구한 새 세션에서 새로 등록하고 다시 dispatch합니다.
- `/hooks`로 project hook이 현재 checkout 경로를 가리키는지, `node`가 PATH에 있는지 확인합니다. Home·managed 설정은
  자동으로 수정하지 않습니다.
- `auto`를 manual·bypass로 바꾸거나 permission 규칙으로 우회하지 않습니다. 완료 판정이 없는 결과를 PASS로 올리지 않습니다.

관련: 완료 기록이 없는 다른 원인은 [완료 관측 누락](./claude-native-completion-observation-missing.md), live 재현 방법은
[Claude 안에서 Claude 세션 실행](./claude-live-session-from-claude-session.md)을 확인합니다.

## 검증

```bash
node --test scripts/ci/claude-native-session.test.mjs
pnpm test:repo-policy
```

`posttool without healthy pretool cannot complete` 테스트가 hook 없는 실행의 완료 거부를 고정합니다. `a foreign task …`,
`a SubagentStop hook error is a non-blocking exit 1 …`, `PostToolUse hook errors keep exit 2 …` 테스트가 이벤트별 hook 오류
결과와 손상 task 건너뛰기를 고정합니다. 정적 테스트는 실제 host가
hook 장애를 어떻게 처리하는지 증명하지 않습니다. Live 재현은 모든 KNU hook
명령을 없는 실행 파일로 바꾼 disposable checkout에서 새 auto 세션을 1회 실행해 task 기록과 완료 거부를 확인합니다.

## 참고

- [Hooks: exit code output](https://code.claude.com/docs/en/hooks#exit-code-output)
- [Permissions: Agent (subagents)](https://code.claude.com/docs/en/permissions)
- [Permission modes: actions no mode auto-approves](https://code.claude.com/docs/en/permission-modes)
