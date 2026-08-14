# TypeScript 6 `baseUrl` 제거와 API module resolution

**상태**: Current
**마지막 검증 환경**: TypeScript 6.0.3, NestJS 11, NodeNext ESM
**현재 owner**: `apps/api/tsconfig.json`, `packages/tsconfig/`

## 증상

TypeScript 6에서 `baseUrl`이 deprecated 되었고 TypeScript 7 제거 대상이 되었습니다. 과거 API
tsconfig에는 alias가 없는데도 `baseUrl: "./"`가 남아 있었습니다.

## 원인

`baseUrl`은 단순 `paths` prefix뿐 아니라 bare specifier lookup root도 바꿉니다. Runtime이 해석하지
못하는 import를 TypeScript만 통과시킬 수 있고, 이 repository는 해당 lookup 동작을 사용하지 않습니다.

## 해결

- `apps/api/tsconfig.json`에서 `baseUrl`을 제거합니다.
- 사용하지 않는 catch-all `paths`를 대체 설정으로 추가하지 않습니다.
- 새 alias가 꼭 필요하면 `baseUrl` 대신 명시적인 상대 경로 `paths`와 runtime resolution을 함께 설계합니다.
- Workspace package는 `@repo/shared`처럼 package export를 사용합니다.

## 검증

```bash
pnpm api:typecheck
pnpm api:build
pnpm api:test
```

## 참고

- [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [TSConfig `baseUrl`](https://www.typescriptlang.org/tsconfig/baseUrl.html)
