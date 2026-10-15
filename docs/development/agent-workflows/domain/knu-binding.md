# KNU domain binding

이 문서는 KNU Roommate 저장소가 [Domain/SWE/Web pack](./swe-web/README.md)과 [review criteria](../review-criteria/README.md)의
binding 키에 주는 값입니다. pack과 기준 문서는 저장소 값을 쓰지 않고 `{{binding:<kind>.<key>}}`로만 가리키며, 그 값은 이 표가
소유합니다. 문서 graph test가 pack·기준 문서의 binding 키가 이 표에 있는지 검사합니다.

- 이 표는 사실(경로·도구·정책 원본의 위치)만 둡니다. 각 결정에서 이 저장소가 무엇을 골랐는지는 아직 기록하지 않습니다.
- 값이 바뀌면(경로 이동, 도구 교체) 이 표를 같은 변경에서 고칩니다.

| 키                               | 값                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `stack.fe-framework`             | Next.js App Router. version은 workspace catalog의 `next`                                       |
| `repo-structure.fe-routes`       | `apps/web/src/app/**`의 route·layout·error 파일                                                |
| `repo-structure.fe-features`     | `apps/web/src/<기능>/`(예: `main`, `auth`, `landing`, `legal`, `social-safety`)                |
| `repo-structure.fe-shared-ui`    | `apps/web/src/components/ui/`                                                                  |
| `repo-structure.fe-styles`       | `apps/web/src/app/globals.css`, `apps/web/src/styles/`                                         |
| `repo-structure.shared-contract` | `packages/shared/`                                                                             |
| `repo-structure.bff-routes`      | `apps/web/src/app/api/**`                                                                      |
| `repo-structure.bff-helpers`     | `apps/web/src/app/api/_bff/`                                                                   |
| `repo-structure.server-session`  | `apps/web/src/auth/server/`(server render용 read-only session facade), `apps/web/src/proxy.ts` |
| `tool.lint`                      | ESLint `@repo/eslint-config/next`(`packages/eslint-config/next.mjs`)                           |
| `tool.component-workshop`        | Storybook(`apps/web` story)                                                                    |
| `tool.e2e`                       | Playwright `desktop-chromium`·`mobile-chromium` project                                        |
| `policy.index`                   | [정책 문서 색인](../../../policies/README.md)                                                  |
| `policy.account-authentication`  | [계정·인증 정책](../../../policies/account-authentication.md)                                  |
