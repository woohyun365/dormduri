# Development documentation

현재 지원하는 개발·테스트 환경에서 다시 발생할 수 있는 문제의 재현 조건, 원인, 해결과 검증을
기록합니다. Production 정책은 `docs/policies/`, 운영·복구 절차는 `docs/runbooks/`, 장기 설계 결정은
`docs/architecture/`가 소유합니다.

- [Troubleshooting index](./troubleshooting/README.md)
- [Monorepo CI baseline](./ci/monorepo-ci-baseline.md)
- [GitHub collaboration](./github/README.md): PR·commit·local hook과 remote repository setting 책임
- [Agent workflow guides](./agent-workflows/README.md): 새 개발자와 coding agent의 실행·검증·session continuity 기준
- [Agentic Engineering methodology](./agentic-engineering-methodology.md): AI 시대에 선택한 개발 방식, 적용 수준과 한계
- [Production deployment implementation inputs](./future-production-deployment-inputs.md)

과거 Sprint·Phase 실행 기록, 개인 장비·절대 경로, 폐기된 구현의 원문은 `local-docs/`에 둡니다.
