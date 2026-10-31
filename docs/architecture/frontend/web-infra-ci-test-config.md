# Web infra CI/test/config 기준

**상태**: Accepted / current

이 문서는 `apps/web` 변경을 안전하게 진행하기 위한 Next.js, TypeScript, ESLint, Vitest, Playwright, BFF/env 기준의 source of truth다. 제품 기능의 UX/정책 판단이 아니라, Web 변경이 어떤 로컬/CI 게이트와 런타임 경계를 통과해야 하는지를 고정한다.

## Version owner 파일

Version 값은 이 문서에 복사하지 않는다. Renovate가 갱신하는 값은 owner 파일 하나가 갖는다([Bot이 갱신하는 값](../../development/ci/README.md#bot이-갱신하는-값)). 새 FE 작업은 아래 owner 파일과 `pnpm-lock.yaml`의 실제 설치 version을 먼저 확인한다.

| 항목                                                                                              | Owner 파일                                                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Node                                                                                              | `.node-version`(local version), root `package.json` `engines`(지원 범위) |
| package manager                                                                                   | root `package.json` `packageManager`                                     |
| Next.js, React / React DOM, TypeScript, ESLint, Prettier, Vite / Vitest, Playwright, Tailwind CSS | `pnpm-workspace.yaml` `catalog`                                          |

## Source of truth 파일

| 책임                                     | 파일                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| root Web gate script                     | `package.json`                                                                        |
| Web app script/dependency                | `apps/web/package.json`                                                               |
| package version catalog                  | `pnpm-workspace.yaml`                                                                 |
| Next production config                   | `apps/web/next.config.ts`                                                             |
| React Compiler option·적용 범위          | `apps/web/react-compiler.config.ts`                                                   |
| Web TypeScript product/test/e2e boundary | `apps/web/tsconfig.json`, `apps/web/tsconfig.test.json`, `apps/web/tsconfig.e2e.json` |
| Web ESLint config                        | `apps/web/eslint.config.mjs`, `packages/eslint-config/*`                              |
| Vitest config/setup                      | `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`                             |
| Playwright smoke config                  | `apps/web/playwright.config.ts`, `apps/web/e2e/*`                                     |
| Runtime env parser                       | `apps/web/src/config/env.schema.ts`, `apps/web/src/config/env.ts`                     |
| BFF proxy/security helper                | `apps/web/src/app/api/_bff/security.ts`, `apps/web/src/app/api/_bff/forward.ts`       |
| Web test helpers                         | `apps/web/src/test/*`                                                                 |
| Web Vitals seam                          | `apps/web/src/observability/*`                                                        |
| generated Figma reference                | `.artifacts/references/<source>/`                                                     |

## Local gate matrix

루트에서 실행한다.

| 명령                     | 책임                                      | 비고                                                                                          |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm web:lint`          | Web ESLint + Next lint config 확인        | shared package build를 선행한다.                                                              |
| `pnpm web:typecheck`     | product/test/e2e TypeScript boundary 확인 | `tsconfig.json`, `tsconfig.test.json`, `tsconfig.e2e.json`을 순차 실행한다.                   |
| `pnpm web:test`          | Vitest unit/component/BFF route test      | `src/**/*.{test,spec}.{ts,tsx}`를 대상으로 한다.                                              |
| `pnpm web:test:coverage` | Vitest coverage 산출                      | `apps/web/coverage/`는 산출물이다.                                                            |
| `pnpm web:build`         | shared build + Next production build      | `output: 'standalone'` artifact를 생성한다.                                                   |
| `pnpm web:e2e`           | Playwright Chromium desktop/mobile smoke  | production-like standalone server smoke다.                                                    |
| `pnpm web:check`         | Web PR 기본 gate                          | lint, typecheck, test, build를 순차 실행한다. Browser smoke는 비용 때문에 별도 명령으로 둔다. |

Public `web:*` 명령은 fresh checkout에서 단독 실행할 수 있도록 Shared build를 포함한다. CI aggregate는 `pnpm web:prepare`를 한 번 실행한 뒤 `pnpm web:check:prepared`를 사용한다. `*:prepared`는 workflow 전용 capability이며 준비 작업을 다시 수행하지 않는다.

Playwright browser가 로컬에 없으면 아래를 먼저 실행한다.

```bash
pnpm --dir apps/web exec playwright install chromium
```

## 테스트 경계

- Unit/component/hook 테스트는 `apps/web/src/**/*.test.{ts,tsx}` 또는 `__tests__` 아래에 둔다.
- 컴포넌트 테스트는 `getByRole`, `getByLabelText`, accessible name 기반 query를 우선한다. `data-testid`는 role/name으로 표현하기 어려운 상태나 구조 검증에만 사용한다.
- 공통 render는 `apps/web/src/test/render.tsx`의 `renderWithProviders`를 우선 사용한다.
- BFF route 테스트는 `apps/web/src/test/bff-route.ts`의 `createBffRequest`, `stubJsonFetch`, `firstFetchInput`, `firstFetchInit`를 사용해 request/fetch stub 모양을 맞춘다.
- `apps/web/src/test-setup.ts`는 Testing Library matcher와 jsdom 공통 gap(`matchMedia`, `scrollTo`, `scrollIntoView`)을 제공한다. 개별 테스트에서 같은 mock을 반복하지 않는다.
- Story/test fixture는 owning domain의 `stories/fixtures/`, `__stories__/`, test-support 경계에 둔다. shared contract나 fixture shape 변경은 focused regression test로 드러나게 한다.
- Playwright spec은 `apps/web/e2e/`에 둔다. Locator는 role/name 기반을 우선하고, 실패 산출물은 `apps/web/playwright-report/`, `apps/web/test-results/`에 생성된다.
- 기본 browser smoke는 Chromium desktop/mobile project를 사용한다. Cross-browser matrix나 strict visual diff는 별도 CI/infra 후속 범위다.
- 인증 상태 파일은 secret성 runtime artifact로 취급해 `apps/web/playwright/.auth/`에 저장하고 git에는 올리지 않는다.

## Web-only smoke와 full-stack E2E 경계

Web CI는 DB service 없이 실행된다. `pnpm web:e2e`도 Web standalone artifact가 browser에서 정상 동작하는지 확인하는 smoke이며, 실제 로그인 사용자/API-backed journey를 보장하지 않는다.

Web-only smoke는 닿지 않는 local `API_URL`로 standalone server를 실행한다(`apps/web/playwright.config.ts`). Landing은 API를 부르지 않고 FAQ도 정적 문구라 API 없이 그대로 렌더링된다. 따라서 `pnpm web:e2e`는 공개 Landing·법적 고지·auth route shell과 browser runtime을 검증하지만, API success path나 로그인 사용자 journey를 검증하지 않는다.

API 서버, DB, 실사용 auth fixture가 필요한 end-to-end journey는 별도 full-stack E2E로 다룬다. Web feature 계획에서 API-backed 흐름이 핵심 acceptance라면 `pnpm web:e2e` 통과만으로 완료 처리하지 말고 API test/e2e 또는 별도 full-stack gate를 명시한다.

## Web CI/test/config와 production deploy 경계

이 문서는 Web 개발/검증 기준을 고정하지만 production deploy 구현을 제공하지 않는다. `.github/workflows/ci.yml`이 PR/push 변경을 분류하고 `.github/workflows/web-ci.yml` reusable workflow를 호출한다. Web lane은 lint, typecheck, Vitest, build, prebuilt Playwright smoke를 실행하지만 environment 승인, deployment identity, artifact publish, rollout, rollback을 수행하지 않는다.

`apps/web/next.config.ts`의 `output: 'standalone'` artifact는 `infra/deploy/web/Dockerfile`이 Web runtime image로 묶는다. Image의 runtime 계약과 후보 검증은 [Runtime container candidates](../../../infra/deploy/README.md)가 소유한다. `.next/standalone`이 생성되고 Playwright smoke가 통과해도 Web이 production에 배포되었다는 뜻은 아니다.

지금 적용한 Web 단계 운영 환경(host, ingress, TLS, domain)은 [Production environment](../../deploy/production-environment.md)가 설명한다. Web 단계 배포 구성과 CD workflow(environment 승인, 단기 deployment identity, image publish, rollout·rollback, release smoke evidence)는 Web CD 작업이 소유하고, 이 문서에는 그 구현을 적지 않는다. Web observability(PII-safe Web Vitals/RUM 수집 경로, API 관측 stack 연결)는 API 단계의 관측 결정을 따른다.

## Runtime env와 BFF 보안 경계

| Key                   | Runtime               | Required                       | Default                           | Notes                                                                                               |
| --------------------- | --------------------- | ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `API_URL`             | server only           | production: yes / dev,test: no | dev,test: `http://localhost:4000` | BFF upstream base URL. production runtime에서는 누락되거나 local hostname으로 향하면 fail-fast한다. |
| `NEXT_PUBLIC_APP_URL` | server/browser public | production: yes / dev,test: no | dev,test: `http://localhost:3000` | absolute URL만 허용하며 production은 canonical origin·auth mutation 검증을 위해 HTTPS가 필수다.     |
| `NEXT_PUBLIC_API_URL` | browser public        | no                             | `/api`                            | browser-facing API base. 기본값은 same-origin BFF path다.                                           |

- Env parsing은 `apps/web/src/config/env.schema.ts`의 pure helper가 담당하고, runtime singleton은 `apps/web/src/config/env.ts`에서만 노출한다.
- Generic BFF helper는 `/api/*`, auth BFF helper는 `/auth/*` upstream path만 조합한다. Prefix 밖 path나 absolute/open-proxy 형태 path는 upstream fetch 없이 safe error response로 닫는다.
- Forwarded request headers는 allowlist 기반이다. Caller-supplied `cookie`, `authorization`, `x-api-key`, `host`, `content-length` 계열 header는 upstream을 덮어쓰지 못한다.
- Upstream JSON parse 실패 또는 non-JSON body는 token/secret 값을 노출하지 않는 safe BFF error shape로 변환한다.
- Auth success token rotation은 response body가 아니라 httpOnly cookie transport로 유지한다.
- Route별 full response allowlist, CSRF/rate-limit/WAF/browser security header 전면 설계는 해당 feature/security 계획에서 별도 acceptance로 다룬다.

## Next.js production baseline

- `apps/web/next-env.d.ts`는 Next.js가 `next dev`·`next build`·`next typegen` 때 다시 만드는 generated typing file이라 Git에서 추적하지 않는다(`.gitignore`, [Next.js TypeScript 문서](https://nextjs.org/docs/app/api-reference/config/typescript#next-envdts)). Web typecheck(`ci:typecheck`의 `ci:typegen`)와 build가 먼저 만들고, 직접 편집하지 않으며 Prettier 대상에서도 제외한다.
- `apps/web/next.config.ts`는 `typedRoutes: true`로 내부 route drift를 TypeScript gate에서 드러낸다. 외부 URL, `tel:`, `mailto:` 링크는 Next route 타입 대상이 아니므로 anchor semantics를 유지한다.
- Web build는 `output: 'standalone'`으로 self-hosting/Docker runtime 후보에 필요한 `.next/standalone/` artifact를 생성한다.
- standalone runtime은 `node .next/standalone/apps/web/server.js`로 실행한다. `.next/static`과 `public` asset도 standalone tree에 함께 둬야 browser smoke가 실제 runtime과 같은 조건에서 통과한다.
- `experimental.webVitalsAttribution`은 CLS/INP/LCP 원인 분석에 필요한 browser-side attribution collection을 켠다.
- Web Vitals reporter는 metric 이름/값과 attribution key 목록만 남긴다. DOM selector, URL, element text 같은 attribution value는 전송하지 않는다.
- 로컬 디버그 로그가 필요할 때만 `NEXT_PUBLIC_WEB_VITALS_DEBUG=1`을 설정한다. 기본값은 no-op이다.
- React Compiler를 `infer` mode로 켠다. option 원본은 `apps/web/react-compiler.config.ts`이고 Next·Vitest·Storybook이 같은 값을 쓴다. 기존 memoization은 그대로 둔다. 결정과 측정은 [FE 결정 기록](../decisions/fe.md#ferenderreact-compiler)과 [React Compiler evidence](../../evidence/frontend/react-compiler-evidence.md)다.
  - Next는 browser bundle에만 compiler를 적용한다. Vitest(`vitest.config.ts`)와 Storybook(`.storybook/main.ts`)은 `@vitejs/plugin-react`의 `reactCompilerPreset`을 `@rolldown/plugin-babel`로 등록하고, 같은 파일의 `sources` 범위로 Next가 compile하지 않는 파일(`'use client'`가 없는 App Router module, test·story·fixture 코드)을 뺀다. Storybook은 framework SWC transform보다 앞에 plugin을 둔다.
  - `panicThreshold: 'none'`이라 compiler가 처리하지 못하는 component·Hook은 build를 깨지 않고 compile 없이 남는다. compiler lint(`eslint-config-next`)는 이런 미지원 구문(`try … finally`, `try` 안의 optional chaining·`??` 등)을 보고하지 않는다. 상태가 자주 바뀌는 화면을 고칠 때는 그 파일이 compile되는지 evidence의 재현 명령으로 확인한다.
  - compile된 뒤 동작이 깨지면 먼저 코드를 Rules of React에 맞게 고친다. 그럴 수 없을 때만 그 component에 `"use no memo"`와 같은 줄 이유 주석, 그 동작을 지키는 test를 둔다.

## Gate 결과 해석

- 과거 warning 수나 특정 파일의 diagnostic을 허용 baseline으로 문서에 고정하지 않는다.
- Lint/typecheck/test가 새 warning 또는 error를 출력하면 현재 실행 결과를 기준으로 원인을 확인한다.
- Runtime 또는 jsdom 자체의 알려진 메시지를 예외로 인정해야 한다면 관련 test/config와 같은 변경에서 회귀 근거를 남긴다.
- 삭제되거나 이동된 파일 경로를 장기 architecture 기준으로 보존하지 않는다.

## FE feature/refactor preflight

FE 기능 계획이나 Web/BFF 리팩토링을 시작하기 전 최소 확인 항목은 다음과 같다.

1. `pnpm-workspace.yaml`, root `package.json`, `apps/web/package.json`의 version/script baseline 확인.
2. 대상 route/component/BFF/helper와 관련 test/fixture 위치 확인.
3. BFF 변경이면 focused route tests를 먼저 고정한다.
4. 일반 Web 변경은 `pnpm web:check`을 완료 조건으로 둔다.
5. Browser runtime 또는 route shell을 건드리면 `pnpm web:e2e`도 완료 조건에 포함한다.
6. API-backed 실제 사용자 journey가 acceptance라면 Web-only smoke와 별도로 full-stack/API gate를 계획한다.
7. 문서/README는 현재 기준과 명시적인 후속 범위를 구분해 설명하고, 계획 단계에만 유효한 표현을 제품 문서에 남기지 않는다.
