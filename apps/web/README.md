# Web App

Next.js 기반 사용자 화면입니다. Web 변경은 API 데이터베이스나 Prisma 생성물 없이도 자체 CI 게이트를 통과해야 합니다.

## Local gate

루트에서 실행합니다.

```bash
pnpm web:lint
pnpm web:typecheck
pnpm web:test
pnpm web:test:coverage
pnpm web:build
pnpm web:e2e
pnpm check:web
```

- `web:lint`: Web ESLint 규칙과 Next.js lint 구성을 확인합니다.
- `web:typecheck`: shared package를 빌드한 뒤 Web product/test/e2e TypeScript 타입을 각각 확인합니다.
- `web:test`: Vitest 기반 컴포넌트/훅/BFF route 테스트를 실행합니다.
- `web:test:coverage`: Vitest coverage report(`apps/web/coverage/`)를 생성해 테스트 범위를 확인합니다.
- `web:build`: shared package 빌드 후 Next.js production build를 실행합니다.
- `web:e2e`: Playwright Chromium으로 production-like `next build` + standalone server browser smoke를 실행합니다.
- `check:web`: Web PR gate와 같은 순서로 lint, typecheck, test, build를 실행합니다.

Playwright browser가 로컬에 없으면 먼저 아래 명령을 실행합니다.

```bash
pnpm --dir apps/web exec playwright install chromium
```

## Boundary notes

- Figma에서 받은 TS/TSX 참조 소스는 app root가 아닌 `references/figma/web/`에 둡니다.
- `references/figma/web/src/`는 generated reference source로 취급해 git 추적과 Web lint/type 대상에서 제외합니다.
- Web CI는 DB service 없이 실행되므로 API 통합 검증은 API CI에서 담당합니다.
- Web Playwright smoke도 Web-only 경계입니다. 실제 로그인 사용자/API-backed journey는 API 서버와 DB를 함께 띄우는 별도 full-stack E2E에서 다룹니다.

## Next.js production-readiness baseline

- `next.config.ts`는 `typedRoutes: true`로 내부 route drift를 TypeScript gate에서 먼저 드러냅니다. 외부 URL, `tel:`, `mailto:` 링크는 Next route 타입 대상이 아니므로 기존 anchor semantics를 유지합니다.
- Web build는 `output: 'standalone'`으로 self-hosting/Docker runtime 후보에 필요한 `.next/standalone/` artifact를 생성합니다. 로컬에서는 `pnpm web:build` 후 아래 명령으로 artifact 존재를 확인할 수 있습니다.

```bash
test -d apps/web/.next/standalone && echo "standalone artifact ready"
```

- standalone runtime은 `node .next/standalone/apps/web/server.js`로 실행합니다. 이때 `.next/static`과 `public` asset도 standalone tree에 함께 둬야 browser smoke가 실제 runtime과 같은 조건에서 통과합니다.
- `experimental.webVitalsAttribution`은 CLS/INP/LCP 원인 분석에 필요한 browser-side attribution collection을 켭니다. 실제 외부 analytics 전송은 이 앱에 포함하지 않습니다.
- Web Vitals reporter는 `src/observability/`에 두며, metric 이름/값과 attribution key 목록만 남깁니다. DOM selector, URL, element text 같은 attribution value는 전송하지 않습니다.
- 로컬 디버그 로그가 필요할 때만 `NEXT_PUBLIC_WEB_VITALS_DEBUG=1`을 설정합니다. 기본값은 no-op입니다.
- React Compiler는 기본 활성화하지 않습니다. 현재 단계는 typed route/build/E2E/Web Vitals gate로 나중에 측정 기반으로 켤 수 있는 준비 상태를 만드는 범위입니다.

## Test authoring

- 컴포넌트 테스트는 가능한 한 `getByRole`, `getByLabelText`, accessible name 기반 query를 우선 사용합니다.
- `data-testid`는 role/name으로 표현하기 어려운 상태나 구조 검증에 한정합니다.
- Web typecheck는 product code와 Vitest test code를 분리해 실행하므로, 테스트 전용 global/type은 `tsconfig.test.json`에만 둡니다.
- Playwright E2E 타입은 `tsconfig.e2e.json`에만 둡니다. Browser smoke spec은 `apps/web/e2e/` 아래에 작성합니다.
- 컴포넌트 테스트는 `src/test/render.tsx`의 `renderWithProviders`를 우선 사용합니다. 지금은 provider가 없는 pass-through wrapper지만, 라우터/전역 provider가 생기면 한 곳에서 확장합니다.
- BFF route 테스트는 `src/test/bff-route.ts`의 `createBffRequest`, `stubJsonFetch`, `firstFetchInput`, `firstFetchInit` helper를 우선 사용해 cookie/auth forwarding 검증 모양을 맞춥니다.
- `src/test-setup.ts`는 Testing Library matcher와 jsdom 공통 gap(`matchMedia`, `scrollTo`, `scrollIntoView`)을 제공합니다. 개별 테스트에서 같은 mock을 반복하지 않습니다.
- `src/__fixtures__/`는 dev/test 전용 fixture와 mock service 위치입니다. Coverage report에서는 제외하고, shared contract나 fixture shape 변경은 `src/__fixtures__/__tests__/`의 focused regression test로 드러나게 합니다.
- Playwright는 role/name locator를 우선 사용하고, failure artifact는 `apps/web/playwright-report/`, `apps/web/test-results/`에 생성합니다.
- 인증 상태 파일은 secret에 준하는 runtime artifact로 취급해 `apps/web/playwright/.auth/`에 저장하고 git에는 올리지 않습니다.
