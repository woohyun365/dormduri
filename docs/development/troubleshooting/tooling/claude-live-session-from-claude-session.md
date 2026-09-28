# 트러블슈팅: Claude 세션 안에서 live 시험용 Claude 세션을 띄울 수 없음

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, 일반 `claude --permission-mode auto`, tmux 3.x
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Hook·권한 동작을 새 세션에서 재현하려고 실행 중인 Claude가 `claude`를 실행하거나 tmux 세션을 만들면 다음 중 하나가 일어납니다.

- auto mode classifier가 실행을 거부합니다.
- 실행되더라도 새 세션이 부모의 `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT` 같은 변수를 물려받습니다.

## 원인

Claude 안의 shell에는 현재 세션을 가리키는 환경 변수가 있습니다. 여기서 띄운 프로세스나 새로 시작한 tmux server는 이 변수를
그대로 상속하므로, owner가 직접 여는 일반 세션과 같은 환경이 아닙니다. 변수를 지우면 비교할 목표 환경 자체를 바꾸게 됩니다.

## 해결

1. Owner가 **Claude가 아닌 자기 터미널**에서 tmux server를 엽니다.

   ```bash
   tmux new-session -d -s <name>
   ```

2. Claude는 `tmux send-keys`로 그 pane에 명령을 보내고 `tmux capture-pane`으로 화면을 읽습니다. 먼저
   `env | grep -c '^CLAUDE'`가 0인지 확인합니다.
3. 시나리오마다 새 `claude --permission-mode auto` 프로세스를 띄웁니다. 실행 중인 세션의 결과를 새 세션 결과로 쓰지 않습니다.
4. 시험은 소유가 분명한 disposable checkout에서만 합니다. 폴더 trust 확인은 그 폴더에 한해 수락합니다.
5. Classifier가 이 경로도 거부하면 우회하지 않고 owner가 직접 실행하는 runbook으로 돌아갑니다.
6. 화면 기록은 증거로 저장합니다. Owner가 `tmux attach`로 지켜볼 수 있지만 조작 중에는 키를 입력하지 않습니다.

`claude -p`(headless)는 승인 prompt를 띄울 수 없어 동작이 다르므로 interactive auto의 증거로 쓰지 않습니다.

## 검증

- Pane에서 `env | grep -c '^CLAUDE'` 결과가 0입니다.
- 새 세션의 transcript `permissionMode`가 `auto`이고, 화면 상태줄에 owner의 plugin 로드가 보입니다.
- 결과 수집은 [완료 관측 누락](./claude-native-completion-observation-missing.md)과
  [hook 장애](./claude-native-hook-failure-and-completion-refusal.md)의 task 기록 기준을 따릅니다.

## 참고

- [Permission modes: auto mode](https://code.claude.com/docs/en/permission-modes)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
