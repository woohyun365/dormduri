# Web main shell

`apps/web/src/main`은 로그인 후 `/main` shell과 tab orchestration을 소유한다.
각 tab의 세부 product behavior는 `tabs/*` owner가 담당하고, `Main.tsx`는 session user, tab state, shared modal/sheet, owner callback wiring만 얇게 연결한다.

## Home first render boundary

- `/login`, `/signup`, `/password-reset` 이후 `/main` 첫 화면은 auth session gate 통과 후 Home dashboard read model에서 시작한다.
- `apps/web/src/main/api/home-dashboard.api.ts`는 `homeDashboardApi.getDashboard()`만 노출하는 dashboard-only BFF client다. legacy widget/mock method를 다시 추가하지 않는다.
- Home first render는 legacy `profileApi.getMyProfile()` 결과나 global fixture/mock DB를 기다리지 않는다.
- non-Home tab이 과도기적으로 legacy profile/mock API를 필요로 하더라도 `MainLegacyTabAdapter` 같은 명시 boundary 안에서 lazy load되어야 한다.

## Runtime fixture boundary

- Home first render와 `apps/web/src/main/api/home-dashboard.api.ts`는 삭제된 `@/main/dev-only/fixtures` mock surface를 direct/dynamic import하지 않는다.
- `apps/web/src/main/dev-only/fixtures`와 root `src/__fixtures__`는 production correctness 근거가 아니므로 재도입하지 않는다.
- `apps/web/src/components/*Dev*Loader` 기반 floating dev surface는 제거되었다. local scenario override는 Storybook/test-support 또는 explicit test fixture lane에서만 다룬다.
- legacy dev override storage나 `mock-db` / `mock-matching-service` 사용은 Home/Main product correctness evidence로 사용하지 않는다.
- `api/profile.ts`와 `api/matching.ts`의 development fallback은 non-Home legacy tab migration debt이며 Home dashboard API 완료 근거가 아니다.
- Home/Main unit tests는 `test-support/*builder*`의 typed builders를 사용한다.
- 로그인 사용자 mobile/desktop browser smoke는 `apps/web/playwright.fullstack.config.ts`의 API + DB seed 기반 full-stack Playwright lane에서 검증한다.

## Main-owned shared surfaces

- Season context는 non-Home legacy tab bridge가 소유한다. HomeTab production path는 `SeasonContext`를 소비하지 않고 `HomeDashboardResponse`의 `season` read model만 사용한다.
- Season fallback/legacy schedule helper는 Home first render 근거가 아니다. 남은 `apps/web/src/main/season/seasonFallback.ts`와 `apps/web/src/main/legacy/seasonLegacyClient.ts`는 non-Home legacy tab 전환 debt에만 한정한다.
- `SeasonState`는 `@repo/shared/season/runtime`에서 직접 import한다. `apps/web/src/types/season.ts` re-export를 다시 만들지 않는다.
- 공용 계약 타입은 `@repo/shared/*`에서 직접 가져오고, Web 전용 navigation/profile/presentation 타입은 실제 owner의 `model/`에 둔다. root `apps/web/src/types` compatibility barrel은 다시 만들지 않는다.
- Main local guide/tooltip localStorage state는 `apps/web/src/main/hooks/useMainLocalOnboardingState.ts`가 소유한다. Home `service-intro` dismissed state와 중복되는 checklist dismissed state를 두지 않는다.
- Home은 더 이상 `service-intro` dismissed mutation client를 소유하지 않는다. `/api/users/me/onboarding` route는 account/user dismissed notice compatibility로 남기되, Home first render나 HomeTab runtime에서 호출하지 않는다. root `apps/web/src/api/current-user.ts` 같은 넓은 compatibility path를 다시 만들지 않는다.

## Test-support rule

`test-support/`는 runtime source of truth가 아니다.
공유 contract shape를 만드는 builder만 둔다.
실제 product state matrix는 API/BFF contract test와 DB seed-backed E2E에서 검증한다.
