@AGENTS.md

# Claude Code project adapter

공통 저장소 계약은 위 import가 소유합니다. 현재 요청에 필요한 guide만 읽고 Claude 실행 세부는
`docs/development/agent-workflows/adapters/claude-code.md`에서 확인합니다.

- 표준 interactive 시작: `claude --permission-mode auto`
- Git/계획 진단: `pnpm claude:preflight -- --mode fresh`
- 공통 요청·문서 경로: `pnpm claude:workflow -- --mode fresh --request '변경 내용을 설명해줘.'`
- KNU 위임·리뷰·정산: `/knu-delegate`·`/knu-review`·`/knu-settle` skill(내부는 `pnpm claude:native prepare`·`review`·`settle`)
- 사용자 선택 질문: 사용자가 정해야 하는 선택은 `AskUserQuestion`으로 묻고 권장안을 첫 선택지로 둡니다. 세부는 adapter의 [사용자 질문 수단](docs/development/agent-workflows/adapters/claude-code.md#사용자-질문-수단)을 따릅니다.
- 재개: 명시적인 `.plans` 경로와 현재 source를 대조합니다. OMC 없이도 공통 계획을 사용합니다.

`auto`는 bypass가 아니며 기존 Home·project 설정을 로드합니다. 설정에서 설치·활성화된 OMC는 Claude가 자동 로드하므로
별도 `omc` prefix가 필요하지 않지만 모든 설치에 OMC가 있는 것은 아닙니다. Home을 설치·변경하지 않습니다. Manifest는
coordination record이지 인증·권한·model 설정이 아닙니다. 역할별 tool, single writer와 독립 QA를 유지하고 실제 UI,
같은 session/tool receipt, source·의미 검증으로 완료를 판단합니다. Hook 부재·crash, cross-CLI bridge의
경계는 adapter를 따릅니다. Codex 전용 model/effort/runtime state를 Claude 기능으로 해석하지 않습니다.
