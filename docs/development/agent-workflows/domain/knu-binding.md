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
| `repo-structure.be-src`                        | `apps/api/src/**`(API server code 전체)                                                                                                           |
| `repo-structure.be-tests`                      | `apps/api/test/**`(API server의 integration·e2e·stress test)                                                                                      |
| `repo-structure.be-config`                     | `apps/api/*`(최상위 파일만: package·tsconfig·test 설정 등)                                                                                        |
| `repo-structure.db-schema`                     | `apps/api/prisma/schema.prisma`                                                                                                                   |
| `repo-structure.db-migrations`                 | `apps/api/prisma/migrations/**`                                                                                                                   |
| `repo-structure.db-seed`                       | `apps/api/prisma/seed.js`, `apps/api/prisma/seed-data/**`, `apps/api/prisma/seeds/**`                                                             |
| `repo-structure.db-sql`                        | `apps/api/prisma/sql/**`(raw SQL 파일)                                                                                                            |
| `repo-structure.db-role-grants`                | `apps/api/prisma/role-grants/**`(DB 역할·grant 정의)                                                                                              |
| `repo-structure.infra-runtime`                 | `infra/deploy/**`, `infra/rehearsal/**`, `infra/aws/**`, `infra/*.json`, `docker-compose.dev.yml`, `infra/README.md`(배포·rehearsal·local 구성)   |
| `repo-structure.infra-scripts`                 | `scripts/infra/**`(infra 검증·compose 조합·artifact·rehearsal script)                                                                             |
| `repo-structure.ci-workflows`                  | `.github/workflows/**`, `scripts/ci/lanes/**`, `scripts/ci/product/**`, `scripts/ci/contracts/**`, `scripts/ci/performance/**`(CI 실행과 검사)    |
| `repo-structure.db-ops`                        | `infra/db/**`(DB 운영 script: migration 적용·grant 적용·restore 시험)                                                                             |
| `repo-structure.supply-chain`                  | `.github/dependabot.yml`, `renovate.json`, `.github/SECURITY.md`, `scripts/dependencies/**`, `scripts/security/**`, `infra/image-inventory.json`  |
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
| `policy.dependency-security`                   | [Dependency security 정책](../../../policies/dependency-security.md)                                                                              |
