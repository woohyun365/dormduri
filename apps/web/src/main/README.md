# Web main destinations

`apps/web/src/app/main`은 로그인 후 다섯 App Router 목적지를 소유한다.
`/main`, `/main/roommates`, `/main/matching`, `/main/chat`, `/main/profile`의 server page가 각각
`main/routes/*Route`를 선택하고 metadata를 제공한다. 공통 layout의 `MainRouteShell`은 인증 상태를 확인한 뒤
viewer ID로 keyed `MainRuntime`에 children을 전달한다. route segment는 공통 error boundary를 유지하지만,
coherent protected bootstrap 전체를 가리는 `main/loading.tsx`나 blanket Suspense boundary는 두지 않는다.
서버 bootstrap이 완료되면 의미 있는 목적지 HTML을 바로 전달하고, dashboard payload가 없는 feature-local 상태만
`MainRuntime`의 skeleton/retry surface가 소유한다.

## Navigation and state lifetime

- `model/mainRoutes.ts`의 typed destination과 실제 Link/pathname이 top-level navigation을 소유한다.
  `activeTab` sessionStorage 복원이나 manual document title/scroll effect는 사용하지 않는다.
- `BottomTabBar`는 실제 링크, 현재 목적지의 `aria-current`, badge를 표시한다. 사용 불가능한 목적지는 이유를 표시하는
  비탐색 button으로 남긴다. 직접 URL도 route에서 capability를 확인한다.
- Matching의 `section`/`requestTab`만 allowlist parser/serializer로 URL에 표현한다. 생략은 overview-dependent 자동 선택이며
  명시적인 사용자 선택과 다르다. 사용자 전환은 push, 잘못된 owned query 정규화는 replace하고 무관한 query는 보존한다.
- 목적지 pathname 변경에서는 이름 있는 본문 landmark로 focus를 이동하되 feature가 이미 본문 안에 둔 focus는 유지한다.
  초기 진입·query-only 변경·일반 refresh에서는 focus를 옮기지 않고 스크롤은 router에 맡긴다. native route announcer 문자열이나
  실제 스크린리더 발화를 이 DOM focus 계약의 검증으로 가장하지 않는다.
- Roommates filter/cursor와 Chat thread/draft는 feature-local이다. route 이탈에서 unmount하며 browser back으로 draft를 복원하지 않는다.
- viewer 변경/logout은 private runtime 전체를 폐기한다. season 변경은 Profile/Roommates/Matching scope를 갱신하되
  같은 viewer의 Chat draft는 season 변경만으로 지우지 않는다. Chat thread 전환은 해당 feature가 소유한다.
- session identity가 unknown/recovery 상태가 되거나 dashboard identity가 다르면 private runtime을 즉시 폐기한다.
- Matching overview만 badge를 publish한다. non-Home 목적지 간 last-known count를 유지하고 Home 진입·viewer/season 변경에서
  폐기한다. 별도 overview 조회나 realtime freshness를 보장하는 cache가 아니다.

## Data and authorization ownership

- async `app/main/layout`은 server-only session gate 뒤 configured API upstream의 dashboard를
  `no-store`로 직접 읽고, identity가 일치하는 최소 bootstrap union만 `MainRouteShell`에 전달한다.
  own Route Handler loopback이나 RSC cookie renewal은 하지 않는다.
- `MainRuntime`은 server-seeded dashboard로 첫 render를 만들고 Home은
  `MainHomeResourceContext`의 dashboard/refresh를 소비한다. refresh는 browser dashboard fetch가 아니라
  `router.refresh()`이며, 같은 viewer의 검증된 stale success만 일시 유지한다.
- `MainShellContext`는 viewer display, season scope, capability projection과 navigation/refresh 배선만 제공한다.
  domain DTO cache나 mutable universal UserProfile store로 확장하지 않는다.
- Roommates/Matching/Chat의 REST read/mutation은 각 feature owner가 담당한다. Home의 실제 성공 mutation은 dashboard를 refresh한다.
- `SeasonContext`는 필요한 route-local UI projection이지 API authorization이 아니다. action은 API/BFF의 authoritative capability와
  unavailable reason을 사용하며, UI enum으로 mutation 권한을 합성하지 않는다.

## Explicit compatibility debt

- Profile의 `ProfileCompatibility`와 `useMainProfileState`/`useMainSocialState`는 기존 local-only 편집·사회 기능을 위한 명시적인
  adapter다. 적용 값은 non-Home navigation 동안만 유지하며 Home/identity/season 전환에서 폐기한다.
  `ProfileRoute`가 쓰는 이 값은 서버 저장 성공의 근거가 아니다.
- 기숙사 local overlay의 좁은 projection만 필요한 Roommates/Matching consumer에 연결한다. Profile write draft를 shell display에서
  authoritative entity로 만들어서는 안 된다.
- Home 건물 선택의 기존 성공 안내도 아직 local-only이다. Home/Profile의 실제 저장 및 block/unblock 연결은 해당 mutation owner에서
  별도로 해결해야 한다. route migration 완료를 persistence 완료로 표현하지 않는다.
- 호출부 없는 예전 Main orchestrator, legacy profile/season bootstrap client와 local season fallback은 제거했다.
  Home·Matching의 동작 근거는 실제 dashboard/overview read model이지 제거된 development override가 아니다.

## Fixture and verification boundary

- production code는 `test-support`, Storybook fixture, 제거된 global mock DB/dev-only surface를 import하지 않는다.
  `test-support/` builder는 contract shape를 만들 뿐 product correctness source가 아니다.
- unit tests는 실제 runtime/route adapter의 dashboard 요청 수, capability, navigation intent, Profile editor 수명과 identity reset을 보호한다.
  Next route delivery mock은 browser history/scroll/announcement 검증을 대신하지 않는다.
- `e2e/main-routes.fullstack.spec.ts` 및 Home/Roommates/auth fullstack은 disposable DB seed 기반 실제 BFF/API로 검증한다.
  fullstack 실행 전 DB identity·소유권·폐기 가능성과 서버 대상을 확인한다.
- route chunk 경계와 client JS/navigation 성능은 production build/browser에서 측정한다. import guard나 `use client` 개수만으로
  code splitting·성능 개선을 주장하지 않는다.
