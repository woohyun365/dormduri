# 트러블슈팅: Claude auto mode classifier가 판정하지 못해 명령이 실행되지 않음

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.283(판정 누락)·2.1.284(ask·deny 규칙), git 2.55.0(약어), 일반 `claude --permission-mode auto`, Anthropic API 직접 연결(server-side classifier review)
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

Bash·WebFetch 같은 도구 호출이 실행되지 않고 다음 메시지가 돌아옵니다. 같은 명령이 몇 분 뒤에는 그대로 통과하기도 합니다.

```text
The server-side auto mode classifier gave no verdict (error), so auto mode cannot determine the safety of Bash.
This is a transient failure of the check, not a judgment about the action
```

판정 없는 응답이 연속 10개가 되면 turn이 멈춥니다. 공식 문서가 응답 단위로 세므로 한 응답의 병렬 호출은 한 번으로 봅니다. 이 거부는 `/permissions`의 **Recently denied** 목록에 남지 않습니다.

Claude가 자기 권한 설정 파일(`.claude/settings*.json`)을 바꾸려 할 때는 다른 메시지가 나옵니다. 이것은 일시 오류가 아니라 판정입니다.

```text
Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Self-Modification]
```

## 원인

- 직접 연결된 대화형 세션에서 auto mode는 판정을 **모델 요청과 함께 서버에** 맡깁니다. 판정 결과가 도착하기 전에 응답이 끊기거나,
  결과를 읽을 수 없거나, 서버 쪽 검사가 실패(예: timeout)하면 판정이 없습니다. Claude Code는 검토되지 않은 명령을 실행하지 않고 거부합니다.
- 응답을 자르거나 바꾸는 VPN·프록시·LLM gateway, turn 도중의 네트워크 전환도 같은 결과를 냅니다.
- 공식 판정 순서는 allow·ask·deny 규칙 → 작업 디렉터리 안의 읽기와 편집 자동 승인(protected path 제외) → 나머지 classifier입니다.
  서버 판정 세션에서는 read-only shell 명령(`cat`, `git status` 등)도 규칙에 맞지 않으면 서버 판정을 기다립니다.
- 복합 명령(`&&`, `;`, `|` 등)은 부분 명령마다 규칙을 확인합니다. 작업 디렉터리 안으로의 `cd`는 read-only로 인정되지만, 규칙 밖 부분이
  하나라도 있으면 명령 전체가 판정으로 갑니다. Auto mode는 package-manager run 명령과 인터프리터 wildcard 같은 넓은 allow 규칙을 적용하지 않으므로
  `pnpm` script, `python3`·`node -e` 인라인 실행은 대개 판정 대상입니다.
- 관측(2026-09-28, CLI 2.1.283): 한 Lead 세션에서 판정 누락 거부 9건이 두 번에 몰렸습니다. 첫 묶음은 transcript 0.4MB의 세션
  첫 turn에서 `pnpm` 부분을 포함한 복합 명령이었습니다. 두 번째 묶음에는 `python3` heredoc과, 한 응답에서 병렬로 호출한 **Edit 5건**이
  있었고 5건이 함께 거부되었습니다. 이 Edit은 작업 디렉터리 안이고 protected path가 아닌 gitignore 대상 경로였습니다. 공식 문서의
  "작업 디렉터리 편집은 classifier를 건너뛴다"와 다른 결과이며, 원인(gitignore 대상 경로, 서버 판정 방식 등)은 확인하지 못했습니다.
  따라서 전용 도구는 판정 대상을 줄이지만 판정 누락을 없애지는 못합니다.
- 추론: 서버 판정은 모델 요청의 일부로 오고 응답이 판정보다 먼저 끝나면 거부되므로(공식), 같은 응답의 병렬 호출이 함께 거부된 것으로 보입니다.
  공식 문서가 이 동작을 직접 설명하지는 않습니다.
- 관측: 16MB 이상의 긴 Lead 세션에서도 판정 누락이 몰려 발생했습니다. 요청이 무거워져 timeout 가능성이 커진다는 것은 추정이며 공식 문서의
  명시가 아닙니다.
- `[Self-Modification]`은 Claude가 자신의 권한을 넓히는 변경을 막는 판정입니다. 우회 대상이 아닙니다.

## 해결

1. 같은 명령을 연달아 재시도하지 않습니다. 재시도할수록 지연이 늘고 판정 없는 응답이 연속 10개면 turn이 멈춥니다. 잠시 뒤 한 번 다시 시도하거나 다른 작업을 먼저 합니다.
   병렬 호출이 함께 거부되었다면 묶음을 풀어 한 번에 하나씩 다시 시도합니다. Edit도 거부될 수 있으므로 같은 방식으로 한 번 재시도합니다.
2. 파일 읽기·검색·편집은 전용 도구를 씁니다. Shell로 `cat`·`grep`·`sed -i`를 부르거나 `python3`·`node -e` heredoc으로 파일을 고치지 않습니다.
   복합 명령은 allow 규칙에 맞는 read-only 부분과 규칙 밖 부분(`pnpm` script 등)을 나눠 실행해 판정 대상을 줄입니다.
3. 자주 쓰는 **좁고 되돌릴 수 있는** 명령은 Owner가 개인 설정 `.claude/settings.local.json`(gitignore 대상)의 `permissions.allow`에
   직접 등록합니다. Allow 규칙은 판정보다 먼저 적용됩니다. 예: `Bash(git status)`, `Bash(gh pr view *)`, `Bash(gh pr checks *)`.
   - Push·reset·merge·삭제처럼 외부에 반영되거나 파괴적인 명령은 등록하지 않고 판정을 거치게 둡니다.
   - prefix allow는 뒤에 붙는 flag를 가리지 않습니다. `Bash(rg *)`는 `rg --pre=<명령>`을, `Bash(git diff *)`는 `git diff --output=<파일>`을,
     `Bash(git fetch *)`는 `git fetch --upload-pack=<명령>`을 판정 없이 통과시킵니다. 실행·쓰기 flag가 있는 도구를 allow에 두려면 그
     flag를 `permissions.ask` 규칙으로 짝짓고, 쓰지 않는 규칙은 allow에서 뺍니다. Ask는 더 구체적인 allow보다 먼저 적용됩니다.
     예: `Bash(rg --pre *)`, `Bash(rg --pre=*)`, `Bash(rg * --pre *)`, `Bash(rg * --pre=*)`처럼 값을 공백과 `=`로 주는 형태, flag가 처음과
     중간에 오는 형태를 모두 적습니다. `--pre` 바로 뒤에 공백이나 `=`를 두면 `--pretty`·`--pre-glob`에는 걸리지 않습니다. 명령을 실행하는
     `--hostname-bin`도 같은 방식으로 짝짓습니다.
   - 관측(2026-09-29, CLI 2.1.284): auto 세션에서 Bash `ask` 규칙에 맞는 명령은 확인 창을 띄웠고, `deny` 규칙에 맞는 명령은 확인 창 없이
     차단되었습니다. Bash 규칙은 대소문자를 구분했습니다(`-C` 규칙이 `-c`에 걸리지 않음).
   - 관측(2026-09-29, git 2.55.0): `git fetch`·`git commit`·`git switch`·`git add`·`git merge`는 긴 옵션의 고유 약어(`--upload-pack` 대신
     `--upl`)도 받았고, `git diff`·`git log`·`git show`는 받지 않았습니다. 약어를 받는 명령의 ask 규칙은 받는 가장 짧은 약어로 씁니다
     (예: `Bash(git fetch *--upl*)`). 받는 약어는 git 버전에 따라 달라질 수 있으므로 git을 올리면 다시 확인합니다.
   - 이 규칙은 Claude가 흔히 쓰는 형태만 막으며 보안 경계가 아닙니다. 다른 경로의 실행 파일(`/usr/bin/git`), `sh -c`, 따옴표로 감싼
     단어(공식 예: `git 'push' origin main`)는 규칙에 일치하지 않습니다. 공식 문서는 명령 텍스트와 무관한 파일 시스템·네트워크 강제에는
     sandbox를, 명령 전체 텍스트 검사에는 PreToolUse hook을 권합니다. 이 저장소의 `.claude/settings.json`에 등록된 hook은 이 용도가 아니며 `allow`를 반환하지 않습니다.
   - allow를 지우거나 인자로 좁히면 그만큼 많은 명령이 판정으로 가서 판정 누락 노출이 늘어납니다. 사용 중인 형태는 allow에 두고 위험한
     형태만 `ask`로 돌립니다.
   - Auto mode는 `Bash(*)`, 인터프리터 wildcard, 패키지 매니저 run 명령, `Agent` allow 같은 넓은 규칙을 무시합니다. `pnpm`·`node` 명령은
     규칙으로 풀리지 않을 수 있습니다.
   - Tracked `.claude/settings.json`에는 permission 규칙을 두지 않습니다. 이 저장소의 hook 계약이 그렇게 고정합니다.
   - Claude에게 설정 파일을 쓰게 하면 `[Self-Modification]`으로 거부됩니다. 제안 내용을 받은 뒤 Owner가 직접 적용합니다.
4. 세션을 작게 유지합니다. plan이나 phase 하나를 한 세션에서 다루고, 개인 설정에 `autoCompactWindow`(예: `500000`, 1M context 모델 기준)를
   두어 기본값(약 967K)보다 일찍 compact합니다. 큰 단계를 마칠 때 `/compact`를 실행합니다.
5. 네트워크 전환은 turn이 끝난 뒤에 합니다.
6. merge·push처럼 멈추면 안 되는 단계는 명령을 미리 준비해 두고, 판정 누락이 이어지면 Owner가 `! <명령>`으로 직접 실행합니다.
7. `autoMode`는 classifier가 실제로 **차단**하는 범위를 조정하는 설정입니다. 공식 문서가 드는 판정 누락 원인(응답 중단, 결과 해석 실패,
   서버 검사 실패)은 이 설정과 관련이 없으므로, `autoMode`로 판정 누락이 줄어든다고 기대하지 않습니다(추론). Classifier는 `autoMode`를
   `~/.claude/settings.json`·managed settings·`--settings`에서만 읽고 project `.claude/settings*.json`에서는 읽지 않습니다.
   `/auto-mode-setup`은 초안을 보여 주고, Owner가 수락해야 Home 설정에 저장합니다. 직접 쓴 `allow`·`soft_deny`·`hard_deny`·`environment`
   배열에 `"$defaults"`가 빠지면 그 절의 기본 규칙이 모두 사라집니다. `/auto-mode-setup`이 쓴 `environment`는 기본 항목을 풀어 쓰므로 예외입니다.
   `autoMode.classifyAllShell: true`는 Bash·PowerShell allow 규칙을 모두 중지하므로 3번의 allow 규칙이 적용되지 않고, deny·ask 규칙에 걸리지 않는
   shell 명령은 판정을 기다립니다. 예외로 critical path(파일 시스템 root, Home, 작업 디렉터리와 그 상위 등)를 지우는 `rm`·`rmdir`은 판정으로
   가지 않고 기존 처리(auto에서는 시간 제한이 있는 확인 창)를 따릅니다.
8. 판정 누락이 계속 잦으면 Owner는 `CLAUDE_CODE_AUTO_MODE_SERVER=0`(v2.1.281 이상)으로 서버 대신 Claude Code 자체 classifier 요청을 쓰게 할 수
   있습니다. 별도 classifier 호출이 계정에 따라 사용량·과금에 포함될 수 있으며, 이 저장소의 기본 권장은 아닙니다.

관련: hook 자체가 실행되지 않는 경우는 [hook 장애와 완료 거부](./claude-native-hook-failure-and-completion-refusal.md)를,
Claude 안에서 새 세션을 띄워 재현하는 방법은 [Claude 안에서 live 세션 실행](./claude-live-session-from-claude-session.md)을 확인합니다.

## 검증

- 새 세션에서 `/permissions`에 등록한 allow 규칙이 보이고, 해당 명령이 판정 없이 실행됩니다.
- `/autocompact`가 설정한 window를 보고합니다.
- `/permissions`의 **Auto mode** 탭이 각 절의 기본 규칙 적용 여부를 보여 주고, 직접 규칙을 추가한 `allow`·`soft_deny`·`hard_deny` 절에서도
  기본 규칙이 적용 중입니다. 직접 쓴 `environment` 배열에는 `"$defaults"`가 들어 있습니다. `/auto-mode-setup`이 쓴 `environment`는 기본
  항목을 풀어 쓰므로 이 확인에서 제외합니다.
  `claude auto-mode config`는 실제 적용 규칙을 문장 목록으로 출력하므로 추가한 항목과 기본 규칙이 함께 보입니다.
- 위험 flag를 `ask`로 짝지었다면 부작용 없는 형태(예: `rg --pre=cat <패턴> <파일>`, `rg --pre cat <패턴> <파일>`)로 확인 창이 뜨는지, 평소 쓰는 형태는 확인 창 없이 실행되는지
  새 auto 세션에서 봅니다.
- 정적 검사: `node --test scripts/ci/agent-native-adapter-contract.test.mjs scripts/ci/agent-document-graph.test.mjs`.
  정적 테스트는 서버 판정의 가용성을 증명하지 않습니다.

## 참고

- [Permission modes: server-side classifier review](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review)
- [Errors: the server returned no safety verdict](https://code.claude.com/docs/en/errors#the-server-returned-no-safety-verdict)
- [Permission modes: how the classifier evaluates actions](https://code.claude.com/docs/en/permission-modes#how-the-classifier-evaluates-actions)
- [Permissions: compound commands](https://code.claude.com/docs/en/permissions#compound-commands)
- [Configure auto mode](https://code.claude.com/docs/en/auto-mode-config)
- [Settings reference: autoCompactWindow](https://code.claude.com/docs/en/settings-reference#autocompactwindow)
