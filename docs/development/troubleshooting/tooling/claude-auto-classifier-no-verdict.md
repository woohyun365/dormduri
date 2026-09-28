# 트러블슈팅: Claude auto mode classifier가 판정하지 못해 명령이 실행되지 않음

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283, 일반 `claude --permission-mode auto`, Anthropic API 직접 연결(server-side classifier review)
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Bash·WebFetch 같은 도구 호출이 실행되지 않고 다음 메시지가 돌아옵니다. 같은 명령이 몇 분 뒤에는 그대로 통과하기도 합니다.

```text
The server-side auto mode classifier gave no verdict (error), so auto mode cannot determine the safety of Bash.
This is a transient failure of the check, not a judgment about the action
```

연속으로 10번 판정을 받지 못하면 turn이 멈춥니다. 이 거부는 `/permissions`의 **Recently denied** 목록에 남지 않습니다.

Claude가 자기 권한 설정 파일(`.claude/settings*.json`)을 바꾸려 할 때는 다른 메시지가 나옵니다. 이것은 일시 오류가 아니라 판정입니다.

```text
Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Self-Modification]
```

## 원인

- 직접 연결된 대화형 세션에서 auto mode는 판정을 **모델 요청과 함께 서버에** 맡깁니다. 판정 결과가 도착하기 전에 응답이 끊기거나,
  결과를 읽을 수 없거나, 서버 쪽 검사가 실패(예: timeout)하면 판정이 없습니다. Claude Code는 검토되지 않은 명령을 실행하지 않고 거부합니다.
- 응답을 자르거나 바꾸는 VPN·프록시·LLM gateway, turn 도중의 네트워크 전환도 같은 결과를 냅니다.
- 이 모드에서는 read-only shell 명령(`cat`, `git status` 등)도 서버 판정을 기다립니다. Read·Grep·Edit 같은 전용 도구의 읽기와 작업 디렉터리 편집은
  판정을 거치지 않습니다.
- 관측: 16MB 이상의 긴 Lead 세션에서 판정 누락이 몰려 발생했습니다. 요청이 무거워져 timeout 가능성이 커진다는 것은 추정이며 공식 문서의 명시가 아닙니다.
- `[Self-Modification]`은 Claude가 자신의 권한을 넓히는 변경을 막는 판정입니다. 우회 대상이 아닙니다.

## 해결

1. 같은 명령을 연달아 재시도하지 않습니다. 재시도할수록 지연이 늘고 10회 연속이면 turn이 멈춥니다. 잠시 뒤 한 번 다시 시도하거나 다른 작업을 먼저 합니다.
2. 파일 읽기·검색·작업 디렉터리 편집은 전용 도구를 씁니다. Shell로 `cat`·`grep`·`sed -i`를 부르지 않습니다.
3. 자주 쓰는 **좁고 되돌릴 수 있는** 명령은 Owner가 개인 설정 `.claude/settings.local.json`(gitignore 대상)의 `permissions.allow`에
   직접 등록합니다. Allow 규칙은 판정보다 먼저 적용됩니다. 예: `Bash(git status)`, `Bash(git diff *)`, `Bash(git fetch *)`,
   `Bash(gh pr view *)`, `Bash(gh pr checks *)`, `Bash(rg *)`.
   - Push·reset·merge·삭제처럼 외부에 반영되거나 파괴적인 명령은 등록하지 않고 판정을 거치게 둡니다.
   - Auto mode는 `Bash(*)`, 인터프리터 wildcard, 패키지 매니저 run 명령, `Agent` allow 같은 넓은 규칙을 무시합니다. `pnpm`·`node` 명령은
     규칙으로 풀리지 않을 수 있습니다.
   - Tracked `.claude/settings.json`에는 permission 규칙을 두지 않습니다. 이 저장소의 hook 계약이 그렇게 고정합니다.
   - Claude에게 설정 파일을 쓰게 하면 `[Self-Modification]`으로 거부됩니다. 제안 내용을 받은 뒤 Owner가 직접 적용합니다.
4. 세션을 작게 유지합니다. plan이나 phase 하나를 한 세션에서 다루고, 개인 설정에 `autoCompactWindow`(예: `500000`, 1M context 모델 기준)를
   두어 기본값(약 967K)보다 일찍 compact합니다. 큰 단계를 마칠 때 `/compact`를 실행합니다.
5. 네트워크 전환은 turn이 끝난 뒤에 합니다.
6. merge·push처럼 멈추면 안 되는 단계는 명령을 미리 준비해 두고, 판정 누락이 이어지면 Owner가 `! <명령>`으로 직접 실행합니다.

관련: hook 자체가 실행되지 않는 경우는 [hook 장애와 완료 거부](./claude-native-hook-failure-and-completion-refusal.md)를,
Claude 안에서 새 세션을 띄워 재현하는 방법은 [Claude 안에서 live 세션 실행](./claude-live-session-from-claude-session.md)을 확인합니다.

## 검증

- 새 세션에서 `/permissions`에 등록한 allow 규칙이 보이고, 해당 명령이 판정 없이 실행됩니다.
- `/autocompact`가 설정한 window를 보고합니다.
- 정적 검사: `node --test scripts/ci/agent-native-adapter-contract.test.mjs scripts/ci/agent-document-graph.test.mjs`.
  정적 테스트는 서버 판정의 가용성을 증명하지 않습니다.

## 참고

- [Permission modes: server-side classifier review](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review)
- [Errors: the server returned no safety verdict](https://code.claude.com/docs/en/errors#the-server-returned-no-safety-verdict)
- [Permissions: redirections and rule matching](https://code.claude.com/docs/en/permissions)
- [Settings reference: autoCompactWindow](https://code.claude.com/docs/en/settings-reference#autocompactwindow)
