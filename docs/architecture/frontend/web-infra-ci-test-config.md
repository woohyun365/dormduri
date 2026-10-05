# Web infra CI/test/config 기준

**상태**: Accepted / current

이 문서는 `apps/web` 변경을 안전하게 진행하기 위한 Next.js, TypeScript, ESLint, Vitest, Playwright, BFF/env 기준의 source of truth다. 제품 기능의 UX/정책 판단이 아니라, Web 변경이 어떤 로컬/CI 게이트와 런타임 경계를 통과해야 하는지를 고정한다.

## 현재 기준 스냅샷

| 항목              | 기준                |
| ----------------- | ------------------- |
| Node              | `>=24 <25`          |
| package manager   | `pnpm@11.24.0`      |
| Next.js           | `16.2.9`            |
| React / React DOM | `19.2.7` / `19.2.7` |
| TypeScript        | `6.0.3`             |
| ESLint            | `9.39.4`            |
| Prettier          | `3.8.4`             |
| Vite / Vitest     | `8.0.16` / `4.1.9`  |
| Playwright        | `1.61.0`            |
| Tailwind CSS      | `4.3.1`             |

버전 기준은 `pnpm-workspace.yaml`의 `catalog`와 root `package.json`의 `packageManager`가 우선이다. 새 FE 작업은 문서의 숫자를 그대로 믿지 말고 실제 catalog와 lockfile을 먼저 확인한다.

## Source of truth 파일

| 책임                                     | 파일                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| root Web gate script                     | `package.json`                                                                        |
| Web app script/dependency                | `apps/web/package.json`                                                               |
| package version catalog                  | `pnpm-workspace.yaml`                                                                 |
| Next production config                   | `apps/web/next.config.ts`                                                             |
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

Landing E2E는 support API 부재가 전체 page failure가 아니라 FAQ fallback으로 수렴하는지 보기 위해 local invalid `API_URL`로 standalone server를 실행한다. 따라서 `pnpm web:e2e`는 공개 Landing의 degrade 경계와 browser runtime을 검증하지만, support API success path나 로그인 사용자 journey를 검증하지 않는다.

API 서버, DB, 실사용 auth fixture가 필요한 end-to-end journey는 별도 full-stack E2E로 다룬다. Web feature 계획에서 API-backed 흐름이 핵심 acceptance라면 `pnpm web:e2e` 통과만으로 완료 처리하지 말고 API test/e2e 또는 별도 full-stack gate를 명시한다.

## Web CI/test/config와 production deploy 경계

이 문서는 Web 개발/검증 기준을 고정하지만 production deploy 구현을 제공하지 않는다. `.github/workflows/ci.yml`이 PR/push 변경을 분류하고 `.github/workflows/web-ci.yml` reusable workflow를 호출한다. Web lane은 lint, typecheck, Vitest, build, prebuilt Playwright smoke를 실행하지만 environment 승인, deployment identity, artifact publish, rollout, rollback을 수행하지 않는다.

현재 repo의 `infra/deploy`는 **BE API + nginx** production-like 배포 단위다. 해당 compose/nginx 설정은 `/api`, `/auth`, `/socket.io`, health, metrics 같은 API-owned path만 upstream으로 넘기며 Web/Next.js server나 CDN/static asset route를 포함하지 않는다.

`apps/web/next.config.ts`의 `output: 'standalone'`은 future Web runtime image 후보를 검증하기 위한 artifact shape다. `.next/standalone`이 생성되고 Playwright smoke가 통과해도, Web Dockerfile/compose/nginx/CDN/TLS/domain/workflow/runbook이 구현되었다는 의미는 아니다.

Future Web production deploy는 별도 계획에서 아래 책임을 결정한다.

- `infra/deploy/web/Dockerfile`: `.next/standalone` 기반 runtime image와 static/public asset 복사 규칙.
- Web compose 또는 API compose 확장 여부: API와 Web을 같은 host/nginx 뒤에 둘지, Web을 별도 host/CDN behind origin으로 둘지 결정.
- nginx/CDN route: API path는 API upstream, Web route는 SSR/static upstream, immutable static asset은 cache header/CDN 정책으로 분리.
- TLS/domain/redirect/HSTS/CSP/보안 header 소유 위치.
- Web release smoke와 CD 경계: environment approval, short-lived deployment identity, image/artifact publish, smoke evidence 보존.
- Web observability: PII-safe Web Vitals/RUM ingestion endpoint 또는 외부 analytics 경로와 API observability stack 연결 여부.

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

- `apps/web/next-env.d.ts`는 tracked generated typing artifact다. Next.js build가 route type import quote style을 재작성하므로 Prettier 대상에서는 제외하고, 파일 내용은 Next generated output과 일치시킨다.
- `apps/web/next.config.ts`는 `typedRoutes: true`로 내부 route drift를 TypeScript gate에서 드러낸다. 외부 URL, `tel:`, `mailto:` 링크는 Next route 타입 대상이 아니므로 anchor semantics를 유지한다.
- Web build는 `output: 'standalone'`으로 self-hosting/Docker runtime 후보에 필요한 `.next/standalone/` artifact를 생성한다.
- standalone runtime은 `node .next/standalone/apps/web/server.js`로 실행한다. `.next/static`과 `public` asset도 standalone tree에 함께 둬야 browser smoke가 실제 runtime과 같은 조건에서 통과한다.
- `experimental.webVitalsAttribution`은 CLS/INP/LCP 원인 분석에 필요한 browser-side attribution collection을 켠다.
- Web Vitals reporter는 metric 이름/값과 attribution key 목록만 남긴다. DOM selector, URL, element text 같은 attribution value는 전송하지 않는다.
- 로컬 디버그 로그가 필요할 때만 `NEXT_PUBLIC_WEB_VITALS_DEBUG=1`을 설정한다. 기본값은 no-op이다.
- React Compiler는 기본 활성화하지 않는다. 현재 기준은 typed route/build/E2E/Web Vitals gate로 나중에 측정 기반으로 켤 수 있는 준비 상태다.

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
