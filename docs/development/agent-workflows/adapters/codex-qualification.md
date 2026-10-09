# Codex cross-host qualification

[Codex adapter](./codex.md)의 reference입니다. Claude Lead를 위한 top-level `codex exec` 교차 reviewer의 정적 경계를 담습니다.
Bridge를 다룰 때 읽습니다.

## Cross-host direct CLI reviewer (static boundary)

[Codex-target bridge policy](../../../../scripts/agents/codex/review-bridge.mjs)는 승인된 Claude Lead의 추가 읽기 전용 검토를 위한 **top-level** `codex exec` 계약입니다. `gpt-6-astra`, `--sandbox read-only`, 비대화식 승인 거부와 source/config/role digest를 사용합니다. 이 프로세스가 `.codex/agents/knu_reviewer.toml`을 로드하거나 별도 필수 Astra QA를 충족했다고 주장하지 않습니다. 명령은 `enabled:false`이며 현재 bridge는 실행하지 않습니다. auth·실제 모델·sandbox·role 입증은 별도입니다. [교차 인계](./cross-model-handoff.md#direct-cli-review-bridge-static-preparation-only)를 따르며 `omx ask`로 자동 우회하지 않습니다.
