# Web main shell

`apps/web/src/main`은 로그인 후 `/main` shell과 tab orchestration을 소유한다.
각 tab의 세부 product behavior는 `tabs/*` owner가 담당하고, `Main.tsx`는 session user, tab state, shared modal/sheet, owner callback wiring만 얇게 연결한다.

## Runtime fixture boundary

- production `/main` runtime path는 `@/__fixtures__`를 직접 import하지 않는다.
- `DevPanel`과 `HomeDevTool`은 `process.env.NODE_ENV === 'development'`일 때만 loader가 렌더링하는 local-only surface다.
- dev panel 내부의 `mock-db` / `mock-matching-service` 사용은 local scenario override 전용이며, Home/Main product correctness evidence로 사용하지 않는다.
- Home/Main unit tests는 `test-support/*builder*`의 typed builders를 사용한다.
- 로그인 사용자 mobile/desktop browser smoke는 API + DB seed 기반 full-stack Playwright 후속 phase에서 검증한다.

## Test-support rule

`test-support/`는 runtime source of truth가 아니다.
공유 contract shape를 만드는 builder만 둔다.
실제 product state matrix는 API/BFF contract test와 DB seed-backed E2E에서 검증한다.
