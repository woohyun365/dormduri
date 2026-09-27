@AGENTS.md

# Claude Code project adapter

공통 저장소 계약은 위 import가 소유합니다. 현재 요청에 필요한 guide만 읽고 Claude 실행 세부는
`docs/development/agent-workflows/adapters/claude-code.md`에서 확인합니다.

- Git/계획 진단: `pnpm claude:preflight -- --mode fresh`
- 공통 요청·문서 경로: `pnpm claude:workflow -- --mode fresh --request '변경 내용을 설명해줘.'`
- 재개: 명시적인 `.plans` 경로와 현재 source를 대조합니다. OMC 없이도 공통 계획을 사용합니다.

두 명령은 모델 dispatcher가 아닙니다. Native 모델·권한·역할의 실제 지원을 지침이나 정적 결과로 가장하지 않습니다.
Codex 전용 명령·model/effort·runtime state를 Claude 기능으로 해석하지 않습니다. 세부 경계와 차단 사유는 adapter를 따릅니다.
