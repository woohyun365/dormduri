# 트러블슈팅: Claude native task 완료 시 `no-completion-observation`

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283(정산 거부)·2.1.286(hand-back 뒤 알림), 일반 `claude --permission-mode auto`, 비동기 Agent 완료
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Child가 끝났는데 `pnpm claude:native complete --task <taskId> --input <JSON file>`가 다음 오류로 거부됩니다.

```text
no-completion-observation
```

`pnpm claude:native settle --task <taskId>`는 같은 상태를 다음 문구로 거부합니다.

```text
cannot settle yet (no-completion-observation): wait for the completed task-notification, then settle
```

`no-completion-observation`과 함께 `stopped-task-settlement-failed: <사유>`가 나오면 Stop은 기록됐지만 정산이 그 사유로
거부된 것입니다. Observation이 invalid이고 `unattributable-change:<path>`나 `post-completion-*-drift`가 나올 수도 있습니다.

## 원인

먼저 `.artifacts/tools/claude-native/<taskId>/`의 기록으로 원인을 구분합니다.

| 기록                                      | 원인                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task.json`만 있음                        | 아직 dispatch하지 않은 정상 등록 상태이거나, dispatch했는데 hook이 실행되지 않았습니다. 후자는 [hook 장애](./claude-native-hook-failure-and-completion-refusal.md)를 확인합니다.                                                                                                                 |
| `attempt.json`은 있고 `launch.json` 없음  | 비동기 시작이 거부됐습니다. Hook 문구가 `async launch model mismatch: expected <A>, observed <B>`이면 등록한 `expectedResolvedModel`이 현재 CLI의 alias 해석과 다릅니다. 실제 child 종료를 확인해 `release --task <taskId> --ended`로 해제하고, 관측된 모델 ID로 새로 등록합니다.                |
| `launch.json`은 있고 `stop.json` 없음     | Child가 아직 실행 중이거나 SubagentStop이 오지 않았습니다.                                                                                                                                                                                                                                       |
| `stop.json`은 있고 `completion.json` 없음 | 부모 transcript에 같은 child·tool의 `task-notification completed`가 아직 없거나 부모 transcript를 읽을 수 없습니다. Child transcript가 4MiB를 넘거나, 기대와 다른 모델·prompt이거나, 아직 flush되지 않은 경우도 같습니다. `complete`는 이 사유를 `stopped-task-settlement-failed`로 보여 줍니다. |
| `completion.json`이 있지만 invalid        | 등록부터 정산 사이에 child write 범위 밖 파일이 바뀌면 `unattributable-change:<path>`입니다. Parent 수정인지 구분할 수 없어 거부합니다([Parent 동시 쓰기](./claude-native-parent-concurrent-write.md)).                                                                                          |

비동기 Agent는 PostToolUse의 `async_launched`만으로 완료되지 않습니다. 완료 알림 전에 complete를 호출하면 관측이 없습니다.
부모 transcript는 child ID와 task marker가 있는 행만 파싱하며 128MiB를 넘으면 정산하지 않습니다(gap).
`--resume`한 세션의 알림 행은 `sessionId`가 등록 세션이고 `session_id`가 새 process ID입니다. 등록 세션의 transcript 파일 안에서
행 `sessionId`가 일치하면 이 차이는 정산을 막지 않습니다.

## 해결

1. 완료 알림(`<status>completed</status>`)이 온 뒤에 settle 또는 complete를 다시 실행합니다. Child의 최종 보고가 알림보다 먼저 도착해도
   `stop.json`이 생길 때까지 기다립니다. 같은 Stop에 한해 지연 flush를 재검사합니다.
2. Child가 끝나면 **파일을 편집하기 전에** 먼저 정산합니다. 이미 편집했다면 그 관측은 되돌리지 말고 invalid로 기록한 뒤,
   필요하면 새 task로 다시 실행합니다.
3. 부모 transcript가 한도를 넘으면 새 세션에서 새로 등록합니다. 한도를 높인 사본이나 수동 JSON으로 정산하지 않습니다.
4. 거부 사유를 PASS로 바꾸지 않고 evidence에 그대로 남깁니다.

## hand-back 뒤 완료 알림이 오지 않음

증상: 비동기 child(예: `knu_reviewer`)의 hand-back 메시지가 Lead에게 먼저 오고, Lead가 "알림을 기다린다"는 text만 남기고 turn을
끝냅니다. 그 뒤 완료 알림이 새 turn을 시작하지 않아 정산이 멈춘 것처럼 보이고, 알림은 사용자의 다음 입력과 함께 옵니다.

원인(관측, CLI 2.1.286, 2026-10-01 한 세션 6회): hand-back과 완료 알림은 약 0.5초 간격으로 대기열에 들어옵니다. Hand-back turn을
text로만 끝낸 3회는 알림이 다음 사용자 입력에 붙어 왔고, 그 turn에서 tool을 호출한 3회는 알림이 tool 결과에 붙어 같은 turn에
왔습니다. 저장소 hook은 완료를 기록할 뿐 Lead turn을 시작하지 않습니다. 하네스 전달 방식의 공식 설명은 찾지 못했습니다(추론).

해결:

1. hand-back을 받은 turn은 text로 끝내지 않고 finding 재현·source 확인 같은 tool 작업으로 이어 갑니다. 이때 정산은 시도하지
   않습니다.
2. 알림이 그 turn에 오면 바로 `settle --task <taskId>`로 정산하고 판정까지 진행합니다.
3. 이미 turn이 끝났다면 사용자의 다음 입력과 함께 온 알림을 확인한 뒤 정산합니다.

알림 없이 정산하지 않습니다. 완료 알림은 hand-back과 달리 registry가 완료 관측으로 쓰는 증거이므로 이 요구를 완화하지 않습니다.

## 검증

```bash
node --test scripts/ci/claude-native-session.test.mjs
```

`async stop/notification association`과 `unseen-dispatch check` 테스트가 알림 전 거부, 알림 후 정산, 8MiB를 넘는 부모
transcript에서의 정산을 고정합니다. `a resumed session notification settles`와 `complete names the stopped-task settlement failure`
테스트가 resume 알림 수락과 정산 실패 사유 표시를 고정합니다. 범위 밖 변경은 `unattributable change: *` 테스트가 고정합니다.

## 참고

- [Claude Code adapter의 비동기 완료 수집](../../agent-workflows/adapters/claude-native-registry.md)
- [Subagents: run in background](https://code.claude.com/docs/en/sub-agents)
