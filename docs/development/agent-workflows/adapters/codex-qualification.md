# Codex cross-host qualification

[Codex adapter](./codex.md)의 reference입니다. Claude Lead를 위한 top-level `codex exec` 교차 reviewer의 정적 경계와 native
`codex` 세션의 live pilot 절차를 담습니다. Bridge나 live pilot을 다룰 때 읽습니다.

## Cross-host direct CLI reviewer (static boundary)

[Codex-target bridge policy](../../../../scripts/agents/codex/review-bridge.mjs)는 승인된 Claude Lead의 추가 읽기 전용 검토를 위한 **top-level** `codex exec` 계약입니다. `gpt-6-astra`, `--sandbox read-only`, 비대화식 승인 거부와 source/config/role digest를 사용합니다. 이 프로세스가 `.codex/agents/knu_reviewer.toml`을 로드하거나 별도 필수 Astra QA를 충족했다고 주장하지 않습니다. 명령은 `enabled:false`이며 현재 bridge는 실행하지 않습니다. auth·실제 모델·sandbox·role 입증은 별도입니다. [교차 인계](./cross-model-handoff.md#direct-cli-review-bridge-static-preparation-only)를 따르며 `omx ask`로 자동 우회하지 않습니다.

## Native live pilot

Codex child의 역할·model·effort와 hook 동작을 native `codex` 세션에서 관측하는 절차입니다. 범위·호출 수·정리 조건은 Owner가
먼저 승인하고, 다른 host의 Parent가 tmux로 세션을 열 때도 Owner 확인을 먼저 받습니다. Pilot PASS는 채택이 아닙니다
([Routine task-model operation](./codex.md#routine-task-model-operation)).

- **별도 home**: 소유자만 읽는(권한 700) scratch `CODEX_HOME`에서 시작합니다. Codex는 local state를 `CODEX_HOME`(기본 `~/.codex`)에
  둡니다([config advanced](https://learn.chatgpt.com/docs/config-file/config-advanced)). Home 그대로 시작하면 Home의 plugin·user
  hook·user instruction이 함께 로드되고 세션 시작만으로 Home `config.toml`에 기록이 생겨, native 관측과 Home 불변을 함께 지키지
  못합니다. Scratch home 로그인은 Owner가 그 home에서 하며 Parent는 `auth.json`을 열거나 복사하지 않습니다.
- **시작 flag 고정**: `CODEX_HOME=<scratch home> codex -m gpt-6-astra -c model_reasoning_effort="high" -s <read-only | workspace-write>`처럼
  Parent model·effort·sandbox를 시작 flag로 정합니다([CLI reference](https://learn.chatgpt.com/docs/cli/reference)). 세션 안에서는
  model·effort를 바꾸지 않습니다. Approval·sandbox·hook trust를 건너뛰는 `--dangerously-bypass-*` flag는 쓰지 않습니다.
- **시작 위치와 trust**: 메인 checkout이나 scratch 일반 repo에서 시작합니다. Project hook은 linked worktree에서 로드되지 않습니다
  ([hook 전체 부재](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)). Hook trust는 hook 정의의 hash에 기록되므로
  `hooks.json`이 바뀌면 각 scratch home에서 trust를 다시 승인합니다([hooks](https://learn.chatgpt.com/docs/hooks)).
- **Home 불변 확인**: 시작 전과 끝난 뒤 `~/.codex/config.toml`·`~/.codex/AGENTS.md`의 sha256 digest를 기록합니다. 다르면 바뀐
  파일을 pilot 기록에 남기고 Owner에게 알립니다. Home 파일은 Parent가 고치지 않습니다.
- **판별 가능한 조건**: 역할 effort 적용은 역할 pin이 Parent effort와 다른 역할(`_medium`·`_xhigh`·`knu_reviewer`)이나 역할 pin과 다른
  spawn effort로 관측합니다. 역할 pin이 Parent effort와 같으면 상속과 구별되지 않습니다.
- **입력**: 긴 지시는 파일로 써서 그 경로를 보냅니다. 긴 tmux 입력은 잘릴 수 있습니다. `tmux send-keys -l`로 문자열을 보내고
  1초쯤 뒤 `Enter`를 따로 보낸 다음 `tmux capture-pane`으로 제출됐는지 확인합니다. 제출되지 않았으면 `Enter`만 다시 보냅니다.
  Probe 입력에 삭제 같은 파괴적 지시를 넣지 않고, tmux 조작·capture가 거부되면 우회하지 않고 Owner에게 묻습니다.
- **Receipt**: 시작 명령, codex-cli 버전, Home digest 전후, 입력, 화면 capture, rollout 경로·발췌, 판정을 남깁니다. 명령마다 exit 값은
  출력에서 직접 기록하고 요약에서 추정하지 않습니다. Probe마다 그때의 hook 기록기(hook script·정책 사본·probe용 user hook)의 사본을
  남기고, 세션 중 기록기를 바꾸면 바꾸기 전 사본도 보존합니다.
- **보존과 정리**: Rollout이 receipt를 다시 추출할 원본이므로 scratch home은 evidence 추출을 확인할 때까지 두고 Owner 확인 뒤
  정리합니다.
