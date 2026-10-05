# Development documentation

현재 지원하는 개발·테스트 환경에서 다시 발생할 수 있는 문제의 재현 조건, 원인, 해결과 검증을
기록합니다. Production 정책은 `docs/policies/`, 운영·복구 절차는 `docs/runbooks/`, 장기 설계 결정은
`docs/architecture/`, 개선의 측정값과 근거 기록은 `docs/evidence/`가 소유합니다.

- [Troubleshooting index](./troubleshooting/README.md)
- [CI development](./ci/README.md): CI 표면·lane·formatting 검사 범위와 새 경로 추가 절차. CI 개선의 측정 기록은
  [CI evidence](../evidence/ci/README.md)
- [GitHub collaboration](./github/README.md): PR·commit·local hook과 remote repository setting 책임
- [Owner cost tracking](./cost/README.md): 월별 gross cash, personal baseline, project-attributable delta와 future cost
- [Agent workflow guides](./agent-workflows/README.md): host 공통 실행·검증·session continuity와 조건부 Codex/Claude adapter
- Agent workflow의 사람 대상 portfolio 문서는 [Agent workflow evidence](../evidence/agent-workflows/README.md)가 소유합니다:
  [Agentic Engineering methodology](../evidence/agent-workflows/agentic-engineering-methodology.md),
  [Agentic orchestration case study](../evidence/agent-workflows/agentic-orchestration-case-study.md)
- [Production deployment implementation inputs](./future-production-deployment-inputs.md)

과거 Sprint·Phase 실행 기록, 개인 장비·절대 경로, 폐기된 구현의 원문은 `.local-docs/`에 둡니다.
