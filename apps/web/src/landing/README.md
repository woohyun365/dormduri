# Landing

`apps/web/src/landing`은 미인증 사용자가 처음 보는 공개 LandingPage의 제품 copy, section composition, interaction island를 소유한다. 이 영역은 공개 acquisition page이면서 정책 고지 surface이므로, copy와 fallback content는 official policy 문서와 추적 가능해야 한다.

## 제품 책임

- 서비스 가치 제안과 회원가입/로그인/앱 홈 CTA를 제공한다.
- 학교 공식 서비스가 아닌 독립 운영 서비스라는 사실을 공개 진입 지점에서 알린다.
- 학교 시스템 미연동, 호실 선택/기숙사 배정 미보장, 생활패턴 설문 면책을 숨기지 않는다.
- FAQ는 support domain의 public FAQ read model을 우선 source-of-truth로 사용하고, local fallback은 API 실패 시 최소 안내만 제공한다.
- Landing은 권한 판단 source-of-truth가 아니다. 실제 기능 허용/거부는 API/domain policy가 최종 판단한다.

## Source of truth

| 주제                                              | Source                                             |
| ------------------------------------------------- | -------------------------------------------------- |
| 서비스 책임, 비공식 서비스 고지, 호실 선택 미보장 | `docs/04_policy/official/service-boundary.md`      |
| 공개 FAQ와 support ticket 경계                    | `docs/04_policy/official/support-communication.md` |
| 시즌 상태와 기능 on/off                           | `docs/04_policy/official/season-lifecycle.md`      |
| 접근 자격과 학교 이메일 인증                      | `docs/04_policy/official/access-eligibility.md`    |
| 프로필 탐색/매칭 정책                             | `docs/04_policy/official/roommate-searching.md`    |
| 개인정보/탈퇴/보관 안내                           | `docs/04_policy/official/data-retention.md`        |
| FAQ shared contract                               | `packages/shared/src/support/contract.ts`          |

## Directory responsibility

| Directory     | Responsibility                                                    |
| ------------- | ----------------------------------------------------------------- |
| `content/`    | policy-linked copy, emergency fallback FAQ, static card content   |
| `sections/`   | page section composition and presentational grouping              |
| `components/` | reusable visual components and minimal client interaction islands |
| `__tests__/`  | section order, content policy, a11y-oriented behavior guards      |

## Content contract

- `content/landing-policy-copy.ts`는 Landing이 반드시 추적해야 하는 policy copy anchor를 소유한다.
- `content/landing-fallback-faq.ts`는 support FAQ API가 실패했을 때 사용하는 emergency fallback만 소유한다.
- fallback FAQ는 운영 FAQ의 primary source-of-truth가 아니며, 개인 문의/신고/이의신청 결과를 포함하지 않는다.
- fallback FAQ의 `question`과 `answer`는 plain text로 유지한다. raw HTML, markdown rendering, 내부 운영 key, retained payload 식별자는 포함하지 않는다.
- copy가 official policy와 충돌하면 official policy 문서를 우선하고 Landing copy를 갱신한다.

## Skeleton and loading rule

- 공개 Landing 전체를 full-page skeleton 뒤에 숨기지 않는다.
- hero heading, 서비스 책임 고지, primary CTA는 initial render에서 바로 노출되어야 한다.
- 동적 FAQ처럼 async dependency가 있는 영역에만 scoped skeleton을 둔다.
- skeleton은 실제 content와 유사한 크기를 유지해 CLS를 줄인다.
- skeleton animation은 `motion-reduce`를 존중해야 한다.

## Security and observability rule

- FAQ answer, profile copy, user-entered content를 analytics/debug log로 남기지 않는다.
- Web Vitals debug output은 metric/id/value/rating/attribution 같은 sanitized field로 제한한다.
- Landing fallback content는 공개 가능한 도움말만 포함한다.
- support ticket 본문, 운영자 메모, 신고/제재 결과, retained payload, 토큰/세션 식별자는 Landing content에 포함하지 않는다.
