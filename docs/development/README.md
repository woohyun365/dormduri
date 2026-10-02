# Development documentation

현재 지원하는 개발·테스트 환경에서 다시 발생할 수 있는 문제의 재현 조건, 원인, 해결과 검증을
기록합니다. Production 정책은 `docs/policies/`, 운영·복구 절차는 `docs/runbooks/`, 장기 설계 결정은
`docs/architecture/`가 소유합니다.

- [Troubleshooting index](./troubleshooting/README.md)
- [Monorepo CI baseline](./ci/monorepo-ci-baseline.md)
- [CI surface ownership](./ci/ci-surface-ownership.md): 경로 family별 표면·lane·owner와 새 경로 추가 절차
- [CI change classification evidence](./ci/ci-change-classification-evidence.md): 변경 분류 개선의 문제·측정·대안·전후 측정 기록
- [GitHub collaboration](./github/README.md): PR·commit·local hook과 remote repository setting 책임
- [Owner cost tracking](./cost/README.md): 월별 gross cash, personal baseline, project-attributable delta와 future cost
- [Agent workflow guides](./agent-workflows/README.md): host 공통 실행·검증·session continuity와 조건부 Codex/Claude adapter
- [Agentic Engineering methodology](./agentic-engineering-methodology.md): AI 시대에 선택한 개발 방식, 적용 수준과 한계
- [Agentic orchestration case study](./agentic-orchestration-case-study.md): evidence 기반 parent–subagent 설계의 문제·대안·구현·검증·한계
- [Production deployment implementation inputs](./future-production-deployment-inputs.md)

과거 Sprint·Phase 실행 기록, 개인 장비·절대 경로, 폐기된 구현의 원문은 `.local-docs/`에 둡니다.
