# Claude cross-host reviewer와 qualification

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## Cross-host direct CLI reviewer (static boundary)

[Claude-target bridge](../../../../scripts/agents/claude/review-bridge.mjs)는 [native child](./claude-native-registry.md)와 다른 transport입니다.
현재 command descriptor는 `enabled:false`이며 고정 fake CLI만 검증합니다. Lead가 별도 승인한 local subscription
CLI를 실행하는 구조와 native Agent 호출을 혼동하지 않습니다. `--restricted`, `--agent`, role 파일 존재만으로
project loading·실제 도구/권한·구독 인증·effective model을 입증하지 않습니다. OMC advisor도 프로젝트 reviewer의
대체 증거가 아닙니다. [교차 인계 계약](./cross-model-handoff.md#direct-cli-review-bridge-static-preparation-only)을
따르며 native 차단을 다른 CLI나 API-key SDK로 우회하지 않습니다.

## Bounded fresh-host qualification

`repository-prepared`와 `runtime-qualified`는 별개입니다. Source entry/정적 테스트가 실제 model/role/permission을
입증하지 않습니다. Native pilot은 별도 승인된(separately authorized) 범위·비용·호출 수·timeout·정리 조건을 먼저 고정하고
필요한 최소 payload만 전송합니다. 로그인 완료나 Phase 요청을 secret·무제한 호출·권한 확대 승인으로 해석하지 않습니다.
Live pilot 세션은 [owner tmux](../../troubleshooting/tooling/claude-live-session-from-claude-session.md)에서
`claude --permission-mode auto --model opus --effort high`로 시작합니다. 세션 안에서는 `/effort`를 쓰지 않습니다.
`/effort <level>`은 현재 세션뿐 아니라 Home 설정의 다음 세션 기본값도 바꿉니다(CLI 2.1.286 관측). Pilot 시작 전과 끝난 뒤
Home 설정의 `effortLevel`을 기록합니다. 값이 바뀌었으면 시작 전 값으로 되돌리고, 바뀐 값과 복원 사실을 pilot 기록에 보고합니다.
역할 effort가 세션 effort(`high`)와 같은 역할은 관측한 effort로 상속과 구별할 수 없습니다. `knu_explorer`·`knu_researcher`가
여기에 속합니다. 이 세션에서 역할 effort 적용을 상속과 구별해 보이는 관측은 `xhigh` 역할뿐입니다.

Disposable fixture에서 readonly 도구 부재·자발적 거부·host denial을 구별하고, child의 실패 보고·독립 QA·취소/결과 회수도
따로 관측합니다. 실제 지원 없는 mode는 scoped NO-GO로 두며 prompt/advisory로 몰래 낮추거나
다른 모델로 fallback하지 않습니다. Source/config/host drift가 있으면 관련 qualification을 다시 수행합니다.
Home/managed 정책을 바꾸거나 bypass로 성공시키지 않습니다. 실행 중인 Claude 세션에서 새 auto 세션을 띄워 재현할 때는
환경 상속을 피하는 [owner tmux 절차](../../troubleshooting/tooling/claude-live-session-from-claude-session.md)를 사용합니다.
