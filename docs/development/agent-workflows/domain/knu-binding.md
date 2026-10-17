# KNU domain binding

이 문서는 KNU Roommate 저장소가 [Domain/SWE/Web pack](./swe-web/README.md)과 [review criteria](../review-criteria/README.md)의
binding 키에 주는 값입니다. pack과 기준 문서는 저장소 값을 쓰지 않고 `{{binding:<kind>.<key>}}`로만 가리키며, 그 값은 이 표가
소유합니다. 문서 graph test가 pack·기준 문서의 binding 키가 이 표에 있는지 검사합니다.

- 이 표는 사실(경로·도구·정책 원본의 위치)만 둡니다. 각 결정에서 이 저장소가 무엇을 골랐는지는 아직 기록하지 않습니다.
- 값이 바뀌면(경로 이동, 도구 교체) 이 표를 같은 변경에서 고칩니다.
- `repo-structure.*` 값은 리뷰 기준 자동 선택이 경로 glob으로 읽습니다. 해석 규칙은
  [review criteria의 자동 선택](../review-criteria/README.md#자동-선택)이 소유합니다. `repo-structure.review-<기준 id>`는 layer가
  없는 기준 문서(`swe`·`documents`·`agent-workflow-tooling`)의 경로 키입니다.

| 키                                             | 값                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack.fe-framework`                           | Next.js App Router. version은 workspace catalog의 `next`                                                                                          |
| `repo-structure.fe-routes`                     | `apps/web/src/app/**`의 route·layout·error 파일                                                                                                   |
| `repo-structure.fe-features`                   | `apps/web/src/<기능>/`(예: `main`, `auth`, `landing`, `legal`, `social-safety`)                                                                   |
| `repo-structure.fe-shared-ui`                  | `apps/web/src/components/ui/`                                                                                                                     |
| `repo-structure.fe-styles`                     | `apps/web/src/app/globals.css`, `apps/web/src/styles/`                                                                                            |
| `repo-structure.shared-contract`               | `packages/shared/`                                                                                                                                |
| `repo-structure.bff-routes`                    | `apps/web/src/app/api/**`                                                                                                                         |
| `repo-structure.bff-helpers`                   | `apps/web/src/app/api/_bff/`                                                                                                                      |
| `repo-structure.server-session`                | `apps/web/src/auth/server/`(server render용 read-only session facade), `apps/web/src/proxy.ts`                                                    |
| `repo-structure.be-auth`                       | `apps/api/src/auth/**`, `apps/api/src/platform/security/**`(인증·권한 판정과 보안 공통 code)                                                      |
| `repo-structure.be-privacy`                    | `apps/api/src/privacy/**`, `apps/api/src/retention/**`, `apps/api/src/platform/observability/**`(개인정보 처리·보존 실행과 관측 정제)             |
| `repo-structure.secret-delivery`               | `infra/deploy/scripts/**`, `infra/deploy/api/**`(배포 때 비밀값·설정 주입)                                                                        |
| `repo-structure.release-runbooks`              | `infra/runbooks/**`, `docs/runbooks/**`                                                                                                           |
| `repo-structure.release-artifacts`             | `infra/artifacts/**`, `scripts/infra/artifacts/**`                                                                                                |
| `repo-structure.be-health`                     | `apps/api/src/health/**`                                                                                                                          |
| `repo-structure.obs-config`                    | `infra/observability/**`, `scripts/observability/**`                                                                                              |
| `repo-structure.review-swe`                    | `apps/**`, `packages/**`, `infra/**`, `scripts/**`, `.github/**`, `*`(root 파일). 제외: `!scripts/agents/**`, `!scripts/ci/agents/**`, `!**/*.md` |
| `repo-structure.review-agent-workflow-tooling` | `scripts/agents/**`, `scripts/ci/agents/**`, `.claude/**`, `.codex/**`, `.agents/**`                                                              |
| `repo-structure.review-documents`              | `**/*.md`, `docs/**`, `.plans/`, `.artifacts/`                                                                                                    |
| `tool.lint`                                    | ESLint `@repo/eslint-config/next`(`packages/eslint-config/next.mjs`)                                                                              |
| `tool.component-workshop`                      | Storybook(`apps/web` story)                                                                                                                       |
| `tool.e2e`                                     | Playwright `desktop-chromium`·`mobile-chromium` project                                                                                           |
| `policy.index`                                 | [정책 문서 색인](../../../policies/README.md)                                                                                                     |
| `policy.account-authentication`                | [계정·인증 정책](../../../policies/account-authentication.md)                                                                                     |
| `policy.data-retention`                        | [데이터 보유기간 정책](../../../policies/data-retention.md)                                                                                       |
| `policy.production-runtime-safety`             | [Production runtime safety 정책](../../../policies/production-runtime-safety.md)                                                                  |
| `policy.operational-observability`             | [운영 관측 정책](../../../policies/operational-observability.md)                                                                                  |
