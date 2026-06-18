# Web App

Next.js 기반 사용자 화면입니다. Web 변경은 API 데이터베이스나 Prisma 생성물 없이도 자체 CI 게이트를 통과해야 합니다.

## Local gate

루트에서 실행합니다.

```bash
pnpm web:lint
pnpm web:typecheck
pnpm web:test
pnpm web:build
pnpm check:web
```

- `web:lint`: Web ESLint 규칙과 Next.js lint 구성을 확인합니다.
- `web:typecheck`: shared package를 빌드한 뒤 Web product/test TypeScript 타입을 각각 확인합니다.
- `web:test`: Vitest 기반 컴포넌트/훅 테스트를 실행합니다.
- `web:build`: shared package 빌드 후 Next.js production build를 실행합니다.
- `check:web`: Web PR gate와 같은 순서로 lint, typecheck, test, build를 실행합니다.

## Boundary notes

- Figma에서 받은 TS/TSX 참조 소스는 app root가 아닌 `references/figma/web/`에 둡니다.
- `references/figma/web/src/`는 generated reference source로 취급해 git 추적과 Web lint/type 대상에서 제외합니다.
- Web CI는 DB service 없이 실행되므로 API 통합 검증은 API CI에서 담당합니다.

## Test authoring

- 컴포넌트 테스트는 가능한 한 `getByRole`, `getByLabelText`, accessible name 기반 query를 우선 사용합니다.
- `data-testid`는 role/name으로 표현하기 어려운 상태나 구조 검증에 한정합니다.
- Web typecheck는 product code와 Vitest test code를 분리해 실행하므로, 테스트 전용 global/type은 `tsconfig.test.json`에만 둡니다.
