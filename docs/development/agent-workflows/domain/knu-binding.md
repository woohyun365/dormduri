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

## 영역 검사

CI `Lifecycle gate`의 검사 `W-AREA`는 PR이 바꾼 제품 경로마다 영역 리뷰 기준이 있는지 봅니다. 판정 원본은
`scripts/ci/lifecycle/area-criteria-check.mjs`이고, PR 작성법은 [GitHub collaboration guide](../../github/collaboration.md#lifecycle-절)가
소유합니다.

- 제품 경로: `docs/policies/path-domains.json`의 `productRoots`에 맞는 경로입니다([경로 → 정책 도메인 표](../../../policies/README.md#경로--정책-도메인-표)).
  이 목록을 바꾸는 PR은 그 파일의 Owner 확인 줄을 둡니다.
- 영역: 위 `repo-structure.*` 값과 pack 하위 layer 절의 binding 키로 [영역 판정](../review-criteria/README.md#자동-선택)이 낸
  layer입니다(cross-cutting 포함). layer 없는 기준 문서의 키에만 맞는 경로와 pack 절이 쓰지 않는 키에만 맞는 경로는 영역이 없습니다.
- 제외 표: 영역이 없는 경로가 아래 표의 행에 맞으면 fail 대신 경고입니다. 첫 칸은 backtick glob 목록(해석은
  [자동 선택](../review-criteria/README.md#자동-선택)과 같고 앞에 `!`를 붙인 glob은 그 행에서 뺍니다), 둘째 칸은 "현재 기준 없음"과
  이유입니다. glob이나 이유가 없는 행은 형식 오류이고, 이 표를 고친 PR은 repo-policy test에서, 제품 경로를 바꾸는 PR은
  `Lifecycle gate` job에서 실패합니다.
- 판정 시점: PR base의 표로 판정하므로 PR이 더한 행은 그 PR의 경로에 적용되지 않습니다. 같은 PR에서 넘기려면 PR 본문
  `Lifecycle` 절에 `override: W-AREA — <이유> — <재검토 조건>` 줄을 둡니다.
- 행의 경로에 영역 키가 생기면 그 PR이 행을 지웁니다. 제품 경로를 바꾸는 PR에서 `W-AREA`는 추적 파일에 맞지 않는 glob과 영역 있는
  경로도 덮는 glob을 경고합니다.

| 제외 경로                                                                                                                                                                                         | 이유                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/**`, `apps/web/type-tests/**`, `apps/web/src/test-setup.ts`, `apps/web/src/proxy.test.ts`                                                                                           | 검증 코드. 현재 기준 없음(영역 기준은 같은 변경의 제품 code 경로가 고른다)                          |
| `apps/web/tsconfig*.json`, `apps/web/eslint.config.mjs`, `apps/web/vitest.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/playwright*.ts`, `apps/web/.storybook/**`, `apps/web/.env.example` | build·lint·test 설정. 현재 기준 없음                                                                |
| `apps/web/README.md`                                                                                                                                                                              | 안내 문서. 현재 기준 없음                                                                           |
| `apps/web/public/**`                                                                                                                                                                              | 정적 asset. 현재 기준 없음                                                                          |
| `apps/web/package.json`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`                                                                                                                  | 의존성·workspace manifest. 현재 기준 없음(의존성 규칙은 `swe` S7과 dependency-security 정책이 본다) |
| `apps/web/next.config.ts`, `apps/web/src/instrumentation.ts`, `apps/web/src/instrumentation-client.ts`                                                                                            | framework 진입·build 설정. 현재 기준 없음                                                           |
