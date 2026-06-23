# Landing

`apps/web/src/landing`은 미인증 사용자가 처음 보는 공개 랜딩 페이지의 화면 문구, 섹션 구성, 최소 상호작용을 소유한다. 공개 소개 화면이면서 정책 고지 지점이므로, 화면 문구와 예비 안내 문구는 공식 정책 문서와 연결되어 있어야 한다.

## 제품 책임

- `/` route에서 공개 Landing shell을 렌더링하고, 인증 앱 shell은 `/main`이 소유한다.
- 서비스 가치 제안과 회원가입/로그인 버튼을 제공한다.
- 학교 공식 서비스가 아닌 독립 운영 서비스라는 사실을 공개 진입 지점에서 알린다.
- 학교 시스템 미연동, 호실 선택/기숙사 배정 미보장, 생활패턴 설문 면책을 첫 화면 근처와 서비스 경계 안내에서 노출한다.
- 시즌 4-state(`OFF_SEASON`, `SEASON_OPEN`, `SEASON_MATCHING`, `SEASON_POST_MATCH`)에 따라 기능이 열리고 닫힌다는 점을 설명한다.
- FAQ는 지원/문의 도메인의 공개 FAQ 조회 데이터를 기준으로 사용하고, 로컬 예비 안내는 API 실패 시 최소 안내만 제공한다.
- 랜딩 페이지는 이용 권한을 최종 판단하지 않는다. 실제 기능 허용/거부는 API와 도메인 정책이 최종 판단한다.

## Section narrative

현재 Landing composition은 아래 순서를 따른다.

1. `LandingHeroSection` — 핵심 가치 제안, 가입 버튼, 서비스 경계 요약, 예시 프로필 카드.
2. `LandingTrustBoundarySection` — 독립 운영, 학교 시스템 미연동, 호실 선택 미보장, 생활패턴 면책.
3. `LandingHowItWorksSection` — 학교 이메일 가입, 시즌 프로필 작성, 후보 탐색·대화 이용 흐름.
4. `LandingFeatureSection` — 탐색/비교/필터/매칭 전후 대화/안전 기능 요약.
5. `LandingSeasonPolicySection` — 시즌 4-state와 기능 허용/제한 경계.
6. `LandingSafetySupportSection` — 개인정보 입력 주의, FAQ와 개인 문의 책임 경계.
7. `LandingFaqSection` — 지원 FAQ API의 Landing surface 데이터를 렌더링하고, 실패 시 비상 예비 FAQ로 대체한다.
8. `LandingFinalCtaSection` — 정책 안내를 확인한 뒤 가입/로그인으로 이어지는 마지막 행동 버튼.

## Source of truth

| 주제                                              | Source                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 서비스 책임, 비공식 서비스 고지, 호실 선택 미보장 | `docs/04_policy/official/service-boundary.md`                                                                                                 |
| 공개 FAQ와 개인 문의 경계                         | `docs/04_policy/official/support-communication.md`                                                                                            |
| 시즌 상태와 기능 허용/제한                        | `docs/04_policy/official/season-lifecycle.md`                                                                                                 |
| 접근 자격과 학교 이메일 인증                      | `docs/04_policy/official/access-eligibility.md`                                                                                               |
| 프로필 탐색/매칭/대화 정책                        | `docs/04_policy/official/roommate-searching.md`, `docs/04_policy/official/matching-lifecycle.md`, `docs/04_policy/official/chat-lifecycle.md` |
| 개인정보/탈퇴/보관 안내                           | `docs/04_policy/official/data-retention.md`                                                                                                   |
| FAQ 공유 응답 계약                                | `packages/shared/src/support/contract.ts`                                                                                                     |

## Directory responsibility

| Directory               | Responsibility                                                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| `LandingPage.tsx`       | public landing page composition owner                                        |
| `content/`              | 정책과 연결된 문구, 섹션 내용, 예시 화면 데이터, 비상 예비 FAQ               |
| `api/`                  | 공개 support FAQ 조회 결과를 Landing view model로 검증·변환하는 read adapter |
| `sections/`             | 페이지 섹션 조합과 표현 그룹                                                 |
| `components/`           | 재사용 화면 컴포넌트, 최소 상호작용 컴포넌트                                 |
| `components/skeletons/` | Landing scoped loading skeleton                                              |
| `__tests__/`            | 섹션 순서, 화면 정책 문구, 콘텐츠 정책, 접근성 중심 보호 테스트              |

## 콘텐츠 규칙

- `content/landing-policy-copy.ts`는 Landing이 반드시 추적해야 하는 정책 문구 기준점을 소유한다.
- `content/landing-copy.ts`는 첫 화면, 서비스 경계, 이용 순서, 기능, 시즌, 안전/문의, 마지막 행동 버튼의 화면 문구 모델을 소유한다. 여러 문장 안내는 문장 단위 줄바꿈을 적용해 한 문단 안에서 읽히도록 유지한다.
- `content/landing-profile-preview.examples.ts`는 화면 예시용 비식별 예시 데이터만 소유한다. 실제 사용자, 실제 점수, 매칭 또는 호실 선택 성공을 암시하지 않는다.
- `api/landing-faq.api.ts`는 `surface=LANDING` 공개 FAQ 조회를 수행하고 shared response schema로 검증한 뒤, 실패·empty 상태를 비상 예비 FAQ로 degrade한다.
- `content/landing-fallback-faq.ts`는 지원 FAQ API가 실패했을 때 사용하는 비상 예비 안내만 소유한다. 같은 제품 경계 FAQ는 API 기본 seed에도 `LANDING` surface로 제공된다.
- 예비 FAQ는 운영 FAQ의 기준 데이터가 아니며, 개인 문의/신고/이의신청 결과를 포함하지 않는다.
- 예비 FAQ의 `question`과 `answer`는 일반 텍스트로 유지한다. raw HTML, markdown rendering, 내부 운영 key, retained payload 식별자는 포함하지 않는다.
- 화면 문구가 공식 정책과 충돌하면 공식 정책 문서를 우선하고 Landing 문구를 갱신한다. 시즌 오픈에서도 등록 완료 후 같은 기숙사 후보와 비매칭 직접 대화가 가능할 수 있지만, 매칭 요청·수락은 시즌 매칭 기간에만 열린다고 설명한다. 등록 완료 후 프로필·기숙사 선택 정보 잠금은 시즌 오픈과 시즌 매칭 모두에 적용되는 것으로 설명한다.

## Interaction and accessibility rule

- `LandingHeader`는 공개 Landing의 hash section navigation, 로그인/회원가입 link, mobile menu keyboard behavior를 소유한다.
- 섹션 이동은 `#how-it-works`, `#features`, `#season`, `#faq` hash link semantics를 유지한다. JavaScript enhancer는 mobile menu close와 optional scroll만 담당한다.
- Smooth scroll enhancer는 `prefers-reduced-motion: reduce`를 존중해야 한다.
- Mobile menu button은 `aria-expanded`와 `aria-controls`로 controlled menu를 가리켜야 하며, Escape close 후 focus를 menu button으로 되돌린다.
- `FAQItem`은 heading 안의 disclosure button과 answer region 관계를 소유한다. Button은 `aria-expanded`/`aria-controls`, answer region은 `aria-labelledby`를 유지한다.
- Header link/button과 FAQ disclosure는 role/name 기반 테스트로 찾을 수 있어야 하고, 최소 44px 전후의 touch target 또는 동등한 padding을 유지한다.

## Skeleton and loading rule

- 공개 Landing 전체를 full-page skeleton 뒤에 숨기지 않는다.
- 첫 화면 제목, 서비스 책임 고지, 주요 가입 버튼은 최초 렌더에서 바로 노출되어야 한다.
- 동적 FAQ처럼 비동기 의존성이 있는 영역에만 해당 영역 전용 skeleton을 둔다.
- FAQ API failure/empty 상태에서는 전체 페이지를 막지 않고 FAQ 영역만 비상 예비 안내로 degrade한다.
- `LandingFaqSkeleton`은 FAQ 영역 전용 loading block이다. 앱 인증 shell loading이나 전체 페이지 loading에 재사용하지 않는다.
- skeleton row는 장식 요소로 숨기고, loading wrapper만 짧은 상태 문구와 `aria-busy`를 제공한다.
- skeleton은 실제 content와 유사한 크기를 유지해 CLS를 줄인다.
- skeleton animation은 `motion-reduce`를 존중해야 한다.

## SEO and performance rule

- `/` route의 title, description, canonical, Open Graph, Twitter metadata는 `apps/web/src/app/metadata.ts`에서 관리한다.
- Metadata 문구는 독립 운영 서비스 경계를 유지하고, 학교 공식 서비스로 오해될 표현을 피한다.
- `robots.ts`와 `sitemap.ts`는 공개 정적 route와 private/API route boundary를 구분한다. `/main`과 `/api/`는 sitemap에 넣지 않는다.
- Landing FAQ는 사용자 안내 목적이다. Google FAQ rich result가 유지되지 않는 현재 기준에서는 `FAQPage` JSON-LD를 추가하지 않는다.
- Core Web Vitals debug는 `NEXT_PUBLIC_WEB_VITALS_DEBUG=1`일 때만 사용하고, payload는 metric id/name/value/rating/navigationType/attribution key 목록으로 제한한다.
- Landing 성능 목표는 LCP 2.5s 이하, INP 200ms 이하, CLS 0.1 이하이다. Playwright desktop/mobile smoke는 공개 Landing, CTA, FAQ fallback, mobile menu, robots/sitemap runtime boundary를 확인한다. Lighthouse hard gate와 strict visual diff는 별도 후속 범위다.

## E2E coverage rule

- `apps/web/e2e/landing.spec.ts`는 Web-only standalone runtime의 Landing smoke를 소유한다.
- E2E는 role/name/visible text locator를 우선하고, class나 DOM 구조 세부 구현에 의존하지 않는다.
- Web-only E2E에서는 support API가 없어도 전체 page가 실패하지 않고 FAQ 영역만 fallback으로 degrade되는지를 확인한다.
- Mobile smoke는 header menu open, mobile navigation visibility, hash link close behavior를 확인한다.
- `/robots.txt`와 `/sitemap.xml` runtime output은 Landing SEO boundary smoke에서 확인한다.

## Handoff and follow-up boundary

- Landing의 현재 소유 파일과 검증 기준은 이 README와 `apps/web/e2e/landing.spec.ts`를 우선한다.
- `pnpm web:e2e`는 Web standalone artifact의 desktop/mobile Chromium smoke이며, API/DB를 함께 띄우는 full-stack 검증이 아니다.
- API-backed 로그인 사용자 journey, Safari/Firefox matrix, Lighthouse hard gate, strict visual diff, BackOffice FAQ editor는 Landing refactor의 미완료 violation이 아니라 별도 제품/인프라 후속 범위다.
- Phase 문서나 계획 문구보다 현재 파일 구조와 테스트가 우선한다. 후속 작업은 이 경계를 변경할 때 README와 관련 E2E를 함께 갱신한다.

## Security and observability rule

- FAQ answer, profile copy, user-entered content를 analytics/debug log로 남기지 않는다.
- Web Vitals debug output은 metric/id/value/rating/attribution 같은 sanitized field로 제한한다.
- Landing 예비 안내 문구는 공개 가능한 도움말만 포함한다.
- 개인 문의 본문, 운영자 메모, 신고/제재 결과, retained payload, 토큰/세션 식별자는 Landing content에 포함하지 않는다.
