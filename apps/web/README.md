# Web App

Next.js 기반 사용자 화면입니다. Web 변경은 API 데이터베이스나 Prisma 생성물 없이도 자체 CI 게이트를 통과해야 합니다. 상세 기준은 `docs/07_tech/frontend/web-infra-ci-test-config.md`를 source of truth로 봅니다.

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
- `web:test:coverage`: Vitest coverage report(`apps/web/coverage/`)를 생성합니다.
- `web:build`: shared package 빌드 후 Next.js production build를 실행합니다.
- `web:e2e`: Playwright Chromium으로 production-like standalone browser smoke를 실행합니다.
- `check:web`: Web PR 기본 gate와 같은 순서로 lint, typecheck, test, build를 실행합니다.

Playwright browser가 로컬에 없으면 먼저 아래 명령을 실행합니다.

```bash
pnpm --dir apps/web exec playwright install chromium
```

## Public metadata and performance smoke

Landing SEO/share metadata는 `apps/web/src/app/metadata.ts`가 소유합니다.
`NEXT_PUBLIC_APP_URL`이 있으면 canonical/robots/sitemap URL의 기준 origin으로 사용하고, 로컬/CI에서는 `http://localhost:3000`으로 안전하게 degrade합니다.
FAQ는 검색 rich result 목적의 `FAQPage` JSON-LD를 추가하지 않습니다. 공개 도움말 품질과 canonical/Open Graph/Twitter metadata를 우선합니다.

Landing 성능 smoke는 production build 기준으로 확인합니다.

```bash
NEXT_PUBLIC_WEB_VITALS_DEBUG=1 pnpm web:build
pnpm --dir apps/web start
```

브라우저에서 `/`를 열고 console의 `[web-vital]` payload가 metric `id/name/value/rating/navigationType/attributionKeys` 수준으로만 남는지 확인합니다.
목표 budget은 LCP 2.5s 이하, INP 200ms 이하, CLS 0.1 이하입니다.
Playwright trace나 Lighthouse를 이용한 모바일/시각 smoke는 Landing Phase 7 범위에서 다룹니다.

## Boundary notes

- Figma에서 받은 TS/TSX 참조 소스는 app root가 아닌 `references/figma/web/`에 둡니다.
- `references/figma/web/src/`는 generated reference source로 취급해 git 추적과 Web lint/type 대상에서 제외합니다.
- Web CI는 DB service 없이 실행되므로 API 통합 검증은 API CI에서 담당합니다.
- Web Playwright smoke도 Web-only 경계입니다. 실제 로그인 사용자/API-backed journey는 API 서버와 DB를 함께 띄우는 별도 full-stack E2E에서 다룹니다.

## Runtime and test references

- Next production config: `apps/web/next.config.ts`
- Runtime env parser: `apps/web/src/config/env.schema.ts`, `apps/web/src/config/env.ts`
- BFF proxy/security helper: `apps/web/src/app/api/_bff/security.ts`, `apps/web/src/app/api/_bff/forward.ts`
- Vitest config/setup: `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`
- Playwright config/spec: `apps/web/playwright.config.ts`, `apps/web/e2e/*`
- Web Vitals seam: `apps/web/src/observability/*`

## Authoring rules

- 컴포넌트 테스트는 가능한 한 `getByRole`, `getByLabelText`, accessible name 기반 query를 우선 사용합니다.
- `data-testid`는 role/name으로 표현하기 어려운 상태나 구조 검증에 한정합니다.
- 컴포넌트 테스트는 `src/test/render.tsx`의 `renderWithProviders`를 우선 사용합니다.
- BFF route 테스트는 `src/test/bff-route.ts`의 `createBffRequest`, `stubJsonFetch`, `firstFetchInput`, `firstFetchInit` helper를 우선 사용합니다.
- 인증 상태 파일은 secret에 준하는 runtime artifact로 취급해 `apps/web/playwright/.auth/`에 저장하고 git에는 올리지 않습니다.
