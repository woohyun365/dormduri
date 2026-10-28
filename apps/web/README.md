# Web App

Next.js 기반 사용자 화면입니다. Web 변경은 API 데이터베이스나 Prisma 생성물 없이도 자체 CI 게이트를 통과해야 합니다. 상세 기준은 `docs/architecture/frontend/web-infra-ci-test-config.md`를 source of truth로 봅니다.

## Local gate

루트에서 실행합니다.

```bash
pnpm web:lint
pnpm web:typecheck
pnpm web:test
pnpm web:test:coverage
pnpm web:build
pnpm web:e2e
pnpm web:e2e:fullstack # optional/final-readiness: API/DB-backed /main smoke
pnpm web:storybook # optional: HomeTab visual workshop
pnpm web:storybook:build # optional: HomeTab Storybook static build
pnpm web:check
```

- `web:lint`: Web ESLint 규칙과 Next.js lint 구성을 확인합니다.
- `web:typecheck`: shared package를 빌드한 뒤 Web product/test/e2e TypeScript 타입을 각각 확인합니다.
- `web:test`: Vitest 기반 컴포넌트/훅/BFF route 테스트를 실행합니다.
- `web:test:coverage`: Vitest coverage report(`apps/web/coverage/`)를 생성합니다.
- `web:build`: shared package 빌드 후 Next.js production build를 실행합니다.
- `web:e2e`: Playwright Chromium desktop/mobile project로 production-like standalone browser smoke를 실행합니다.
- `web:e2e:fullstack`: local Postgres + API + Web dev server를 띄워 로그인 사용자 `/main` smoke를 실행합니다. 기본 PR gate는 아니지만 `/main`/Home/Auth handoff를 마감할 때는 final-readiness evidence로 실행합니다.
- `web:storybook`: 로그인/DB 없이 HomeTab의 주요 시즌·매칭 UI 상태를 비교하는 visual workshop을 실행합니다.
- `web:storybook:build`: HomeTab Storybook surface가 정적으로 빌드되는지 확인합니다. API/BFF/auth/DB 통합 정합성 근거는 아닙니다.
- `web:check`: Web PR 기본 gate와 같은 순서로 lint, typecheck, test, build를 실행합니다.

각 public 명령은 fresh checkout에서 단독 실행할 수 있도록 Shared build를 포함합니다. GitHub Actions는 `pnpm web:prepare`를 한 번 실행한 뒤 prepared command를 단계별로 실행해 준비 작업을 반복하지 않고 구간별 시간을 남깁니다.

| 목적                 | 로컬 public command                                       | CI prepared command                 |
| -------------------- | --------------------------------------------------------- | ----------------------------------- |
| 준비                 | public command가 자동 수행                                | `pnpm web:prepare`                  |
| lint                 | `pnpm web:lint`                                           | `pnpm web:lint:prepared`            |
| typecheck            | `pnpm web:typecheck`                                      | `pnpm web:typecheck:prepared`       |
| unit                 | `pnpm web:test`                                           | `pnpm web:test:prepared`            |
| build                | `pnpm web:build`                                          | `pnpm web:build:prepared`           |
| browser smoke        | `pnpm web:e2e`                                            | `pnpm web:e2e:prepared`             |
| Storybook static     | `pnpm web:storybook:build`                                | 관련 변경에서 `ci:storybook:build`  |
| Storybook story 검사 | static build 뒤 `pnpm --dir apps/web ci:storybook:visual` | 관련 변경에서 `ci:storybook:visual` |

Prepared command는 CI 내부 capability다. Web CI는 Next production build를 한 번만 만들고 같은 standalone artifact로 desktop/mobile Chromium smoke를 실행합니다. Storybook static build는 Storybook-owned 변경에서만 추가합니다.

Playwright browser가 로컬에 없으면 먼저 아래 명령을 실행합니다.

```bash
pnpm --dir apps/web exec playwright install chromium
```

## Public metadata and performance smoke

Landing SEO/share metadata는 `apps/web/src/app/metadata.ts`가 소유합니다. 탭 제목은 서비스 이름이 앞인 `돔두리 | 화면 이름`이고
root title template이 붙입니다(root segment인 Landing은 같은 형식을 직접 씁니다).
`NEXT_PUBLIC_APP_URL`은 canonical/robots/sitemap URL과 auth mutation origin 검증의 기준입니다.
로컬/CI에서는 `http://localhost:3000`으로 안전하게 degrade하지만, production에는 실제 HTTPS origin을 반드시 주입합니다.
production auth cookie는 `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain` 규칙을 따릅니다.
FAQ는 검색 rich result 목적의 `FAQPage` JSON-LD를 추가하지 않습니다. 공개 도움말 품질과 canonical/Open Graph/Twitter metadata를 우선합니다.

Landing 성능 smoke는 production build 기준으로 확인합니다.

```bash
NEXT_PUBLIC_WEB_VITALS_DEBUG=1 pnpm web:build
pnpm --dir apps/web start
```

브라우저에서 `/`를 열고 console의 `[web-vital]` payload가 metric `id/name/value/rating/navigationType/attributionKeys` 수준으로만 남는지 확인합니다.
목표 budget은 LCP 2.5s 이하, INP 200ms 이하, CLS 0.1 이하입니다.
Playwright는 desktop/mobile Chromium smoke를 제공하고, trace/screenshot/video는 실패 시 artifact로 남깁니다. Lighthouse hard gate와 strict visual diff는 별도 후속 범위입니다.

## Boundary notes

- Figma에서 받은 TS/TSX 참조 소스는 app root가 아닌 `.artifacts/references/<source>/`에 둡니다.
- 이 참조 소스는 generated reference로 취급해 Git 추적과 Web lint/type 대상에서 제외합니다([Artifact 보존 규칙](../../.artifacts/README.md)).
- Monorepo CI의 Web validation은 DB service 없이 실행되므로 API 통합 검증은 별도 API validation이 담당합니다.
- Web Playwright smoke도 기본은 Web-only 경계입니다. Landing E2E webServer는 support API 부재를 fallback으로 검증하기 위해 local invalid `API_URL`로 실행합니다.
- 로그인 사용자 `/main` journey는 `playwright.fullstack.config.ts`가 API 서버와 DB seed를 함께 띄워 별도 full-stack lane에서 검증합니다. 이 lane은 Docker/API 의존성이 있어 상시 PR gate보다는 manual/scheduled 또는 final-readiness 후보입니다.
- HomeTab Storybook은 visual state workshop입니다. Story data는 `src/main/test-support` typed builder를 재사용할 수 있지만, production Home runtime source가 `__stories__`, `test-support`, 삭제된 `src/main/dev-only/fixtures` mock surface를 import하면 안 됩니다.
- `web:storybook:build`가 생성하는 `apps/web/storybook-static/`은 검증 산출물이므로 버전 관리하지 않습니다.
- Web-only smoke의 후속 후보는 Safari/Firefox matrix, Lighthouse hard gate, strict visual diff입니다. 이 항목들은 현재 Web gate 실패가 아니라 별도 제품/인프라 backlog로 봅니다.

## Runtime and test references

- Next production config: `apps/web/next.config.ts`
- Runtime env parser: `apps/web/src/config/env.schema.ts`, `apps/web/src/config/env.ts`
- BFF proxy/security helper: `apps/web/src/app/api/_bff/security.ts`, `apps/web/src/app/api/_bff/forward.ts`
- Vitest config/setup: `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`
- Playwright config/spec: `apps/web/playwright.config.ts`, `apps/web/playwright.fullstack.config.ts`, `apps/web/playwright.storybook.config.ts`, `apps/web/e2e/*`, `apps/web/e2e/storybook/*`
- Storybook config/spec: `apps/web/.storybook/*`, `apps/web/tsconfig.storybook.json`, `apps/web/src/main/tabs/home/__stories__/*`, `apps/web/src/styles/tokens/__stories__/*`, `apps/web/src/screens/**/*.stories.tsx`
- Web Vitals seam: `apps/web/src/observability/*`

## Authoring rules

- 컴포넌트 테스트는 가능한 한 `getByRole`, `getByLabelText`, accessible name 기반 query를 우선 사용합니다.
- `data-testid`는 role/name으로 표현하기 어려운 상태나 구조 검증에 한정합니다.
- 컴포넌트 테스트는 `src/test/render.tsx`의 `renderWithProviders`를 우선 사용합니다.
- BFF route 테스트는 `src/test/bff-route.ts`의 `createBffRequest`, `stubJsonFetch`, `firstFetchInput`, `firstFetchInit` helper를 우선 사용합니다.
- 인증 상태 파일은 secret에 준하는 runtime artifact로 취급해 `apps/web/playwright/.auth/`에 저장하고 git에는 올리지 않습니다.
