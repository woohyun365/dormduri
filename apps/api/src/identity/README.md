# Identity shared-kernel architecture

이 문서는 `apps/api/src/identity`의 shared-kernel 책임 경계와 수정 위치를 빠르게 찾기 위한 server-side boundary map이다. 이 디렉토리는 account/display/academic identity에 대한 공통 vocabulary와 pure invariant helper만 소유한다.

## Public boundary

제품 domain production code는 identity invariant helper를 직접 import할 수 있다. 단, 이 surface는 pure TypeScript helper로만 유지한다.

- `account-identity-invariant.ts`: account identity projection에서 display/academic identity 필수 조건을 검증하는 shared invariant helper다.
- `AccountIdentityInvariantSurface`: invariant failure가 발생한 제품 surface 이름을 제한된 literal로 표현한다.
- `AccountIdentityInvariantCode`: display identity 또는 academic identity 누락 종류를 제한된 literal로 표현한다.

## Directory responsibilities

- `account-identity-invariant.ts`: identity invariant type과 assertion helper. Nest exception, HTTP body, Prisma query를 만들지 않는다.
- `account-identity-invariant.spec.ts`: pure invariant behavior regression.
- `README.md`: shared-kernel boundary와 금지 경계 설명.

## Hard rules

- Nest provider, controller, module, guard, exception class를 두지 않는다.
- Prisma client, repository, DB query, transaction helper를 import하지 않는다.
- HTTP response body와 status code는 `platform/http` adapter가 소유한다.
- Persistence-backed display/academic identity write behavior는 `users/identity/**`가 소유한다.
- Signup/account authentication orchestration은 `auth/registration`, `auth/credentials`, `auth/sessions`가 소유한다.
- Season registration readiness는 이 invariant vocabulary를 소비할 수 있지만, season-participants route policy와 command transaction은 `season-participants/registration`이 소유한다.

## Architecture guard

- Users boundary guard는 `season-participants`가 users route error namespace를 import하지 않는지 확인한다.
- Identity shared-kernel은 platform/database/http/auth/users concrete implementation을 import하지 않아야 한다.
- HTTP adapter placement는 `platform/http/account-identity-invariant.error.ts`가 소유한다.

## Where to change identity behavior

- Account identity invariant input/type: `account-identity-invariant.ts`.
- Invariant failure code vocabulary: `AccountIdentityInvariantCode`.
- Invariant failure surface vocabulary: `AccountIdentityInvariantSurface`.
- HTTP exception/status/body mapping: `platform/http/account-identity-invariant.error.ts`.
- User-facing display/academic identity mutation: `users/identity/display`, `users/identity/academic`.
- Registration readiness consumption: `season-participants/registration/season-registration-readiness.evaluator.ts`.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/identity/account-identity-invariant.spec.ts \
  src/platform/http/account-identity-invariant.error.spec.ts \
  src/season-participants/registration
pnpm --dir apps/api exec eslint src/identity src/platform/http/account-identity-invariant.error.ts
pnpm exec prettier --check apps/api/src/identity/README.md
pnpm api:typecheck
git diff --check
```
