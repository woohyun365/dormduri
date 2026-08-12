# 계정/인증 정책

## 문서 범위

이 문서는 계정 식별, 본인 인증, 로그인, 세션, 비밀번호, 회원가입 기본 단계를 다룬다.

- 프로필 필드 상세 구조: [profile-model.md](./profile-model.md)
- 이용 자격과 시즌별 기능 허용 범위: [access-eligibility.md](./access-eligibility.md), [season-lifecycle.md](./season-lifecycle.md)

## 계정 식별 체계

| 항목             | 정책                                                  |
| ---------------- | ----------------------------------------------------- |
| 유저 id          | UUID. 서버 생성                                       |
| 로그인 ID        | 강원대 이메일 직접 사용                               |
| 이메일과 id 관계 | 이메일은 인증/로그인용, UUID는 시스템 식별용으로 분리 |
| 별도 login ID    | 두지 않음                                             |

## 본인 인증

| 항목          | 정책                              |
| ------------- | --------------------------------- |
| 인증 수단     | `@kangwon.ac.kr` 이메일 인증 코드 |
| 인증 코드 TTL | 600초                             |
| SSO / OAuth   | 도입하지 않음                     |
| 2FA           | 도입하지 않음                     |

재학생 확인은 학교 이메일 인증으로 처리한다.
기숙사 입주 여부는 인증 단계에서 판별하지 않고, 건물 배정 입력을 통한 자기 신고 모델을 사용한다.

## 로그인과 세션

| 항목                 | 정책                                                  |
| -------------------- | ----------------------------------------------------- |
| 로그인 방식          | 이메일 + 비밀번호                                     |
| 세션 방식            | DB-backed opaque access/session token + renewal token |
| 로그인 유지 체크     | renewal token의 browser 종료 후 유지 여부 선택        |
| 동시 로그인          | 우선 허용                                             |
| 로그인 실패 잠금     | 5회 실패 시 5분 잠금                                  |
| 로그인 IP 제한       | 30회/1분 burst, 120회/10분 sustained                  |
| 비밀번호 재설정      | 이메일 인증 코드 후 새 비밀번호 설정                  |
| 이전 비밀번호 재사용 | 현재 비밀번호와 동일한 값으로 변경 불가               |

### Auth 세션/보안 결정 baseline

현재 구현은 access token만으로 세션 authority를 삼지 않는다. API는 `AuthSession` DB row를 생성하고 DB session row의 `revokedAt`/`expiresAt`/token hash 상태를 다시 확인한다. 현재 제품 baseline은 **DB-backed session/token family를 canonical source-of-truth**로 유지하고 client transport는 opaque access/session token을 사용한다. 과거 short access JWT bridge는 이행 중 선택지였으며 현재 제품 transport가 아니다.

| 결정                    | 정책                                                                                                                                  | 선택하지 않은 대안 / 후속                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Transport               | `AuthSession`/token family + opaque access/session token을 제품 baseline으로 둔다                                                     | JWT-only/bridge 장기 유지는 forced logout/reuse detection/Remember Me 요구와 맞지 않아 기각                              |
| Remember Me TTL         | 체크 시 7일 persistent renewal, 미체크 시 24시간 absolute TTL의 browser-session renewal을 사용한다. access token은 모두 15분이다      | 미체크 access TTL을 24시간으로 늘리거나 15분 뒤 재로그인을 강제하는 방식은 기각                                          |
| Redis                   | 이번 milestone에서는 Postgres authoritative를 유지한다. Redis는 distributed throttling/cache 후보일 뿐 source-of-truth가 아니다       | multi-instance throttle 우회, RDS auth write IOPS 병목, auth p95 latency 악화가 관측되면 후속 이슈에서 검토              |
| Email/alert             | `EmailSender` adapter, mail success/failure metric, security event schema를 먼저 고정한다                                             | provider/alert destination은 배포/운영 채널 확정 후 후속 결정                                                            |
| Secret store            | dev/test는 env, AWS production origin은 Secrets Manager, Lightsail application read source는 read-only mounted files다                | JWT signing keyset은 현재 transport에서 사용하지 않는다. 실제 account/region/role/prefix는 release evidence에서 확정한다 |
| DB role                 | runtime/worker/migration/read-only credential matrix + smoke test를 먼저 둔다                                                         | Prisma client/pool 분리는 RDS connection budget 확인 후 후속 검토                                                        |
| Reset verification ACID | reset code/proof 발급·검증·consume은 advisory lock + conditional update + serializable retry를 기본 전략으로 한다                     | serializable-only, row-lock-only, application mutex는 race 방어가 불충분하거나 multi-instance에 부적합                   |
| Capability seed         | `user:read:self`, `user:update:self`, `auth:session:revoke:self`, `auth:password:change:self`로 시작한다                              | Admin/BackOffice capability 구현은 별도 BackOffice scope에서만 다룬다                                                    |
| Cookie/CSRF             | production은 `__Host-` cookie, `httpOnly`, `secure`, `sameSite=Lax`, `Path=/`, no Domain과 origin/Fetch Metadata 관찰을 기준으로 한다 | `SameSite=None`/cross-site cookie는 실제 cross-site 배포 요구가 있을 때 후속 재검토                                      |
| Web scope               | Web 작업은 BFF route/helper/cookie/session transport와 BFF test로 제한한다                                                            | Rendering, React hook, page/component state, onboarding modal/CTA는 #260에서 후속 처리                                   |

### Login/session 결과 의미

- `unauthenticated`는 token 부재, 만료, revoke, 삭제 계정처럼 인증 authority가 정상적으로 비로그인 상태를 확정한 결과다. 이 경우에만 BFF가 auth cookie를 정리할 수 있다.
- `unavailable`은 network timeout, upstream 5xx, schema mismatch, 일시적인 DB 장애처럼 로그인 여부를 확정하지 못한 결과다. BFF는 이 상태에서 기존 auth cookie를 지우지 않는다.
- API session 결과는 `authenticated=true`일 때 user가 필수이고, `authenticated=false`일 때 내부 rejection reason을 포함한다. Browser는 내부 reason 대신 `authenticated`, `unauthenticated`, `unavailable`의 tri-state만 받는다.
- 존재하지 않거나 삭제되었거나 account identity가 불완전한 계정의 login도 active account와 같은 profile의 canonical dummy Argon hash를 검증한다. 사용자 응답은 잘못된 비밀번호와 동일하게 유지한다.

### Production 이메일 발송 baseline

- 이메일 인증 코드와 비밀번호 재설정 코드는 production에서 logger/stub output으로 전달하지 않는다.
- `StubEmailSenderService`처럼 verification/reset code를 log에 출력하는 sender는 local/test/development 전용이다.
- Production auth email sender는 `EMAIL_PROVIDER=ses` 경로의 SESv2 adapter 또는 동등한 실제 provider를 사용한다.
- `EMAIL_SENDER` public port는 monitoring wrapper를 유지하고, concrete sender 선택은 stub/local과 SES/production delegate 경계에서 이뤄진다.
- SES sender는 verified domain 또는 verified email address를 사용한다. Production 발송 전 domain identity와 DKIM 설정을 권장한다.
- SES sandbox 상태에서는 수신자도 verified identity여야 하므로 실제 사용자 발송 전 production access 해제가 필요하다.
- SES email sending 자체에는 static outbound IP가 필수 조건이 아니다.
- `MonitoredEmailSenderService`는 provider success/failure를 security event와 metric으로 남기되, raw verification code, reset proof, auth token, provider credential을 metadata/log에 저장하지 않는다.
- Provider config invalid는 production readiness failure로 본다. Provider transient failure는 auth email operation failure로 기록하고 alert/degraded 판단 입력으로 사용한다.
- SES/AWS provider error는 `CONFIG_INVALID`, `ACCESS_DENIED`, `MESSAGE_REJECTED`, `THROTTLED`, `TRANSIENT`, `UNKNOWN` 같은 bounded category로만 보관한다.

### Auth 상태 / 정책 matrix

| 상태 축                                            | 정책                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| email verified/unverified                          | verified 전 protected API는 거부한다. signup/reset verification public API는 neutral response와 throttling을 적용한다                |
| active/deleted/retained/blocked                    | deleted/retained/blocked 계정은 login/session resolve에서 fail-closed한다                                                            |
| login allowed/lockout/throttled                    | account lockout은 Postgres 기준이고 IP burst/sustained throttle은 별도 guard다. Hash global guard는 capacity metric gate를 둔다      |
| password reset requested/verified/consumed/expired | reset code/proof는 single-use, expiry/consume race-safe, neutral response를 유지한다                                                 |
| rememberMe on/off                                  | on은 7일 persistent renewal, off는 24시간 absolute TTL + browser-session renewal cookie를 사용한다. access token은 모두 15분         |
| session active/revoked/expired                     | revoked/expired는 DB gate에서 fail-closed. logout current, reset/delete/logout-all은 all-session revoke 정책을 따른다                |
| refresh/renew token valid/previous/reused          | current token은 rotate한다. 직전 token은 8초 동안 stale로 분류하고, 그 밖의 old token은 suspected reuse + family revoke 대상이다     |
| access token current/expired/legacy JWT            | current opaque token hash만 통과한다. `sessionTokenExpiresAt` 만료, revoked/deleted/blocked, legacy JWT-like token은 fail-closed한다 |
| public/optional/protected API                      | route metadata로 분류한다. protected는 actor context 필수, optional은 actor context nullable                                         |

### Public / optional / protected API inventory baseline

| 구분                             | 현재/계획 API 예시                                                                                                                                                | 기준                                                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public auth                      | `send-signup-code`, `send-reset-code`, `verify-email-code`, `verify-reset-code`, `signup/validate-nickname`, `signup`, `login`, `reset-password`, `renew-session` | 인증 없이 접근 가능하되 neutral response, throttling, security event 기준을 적용한다                                                                                                                             |
| Optional auth                    | `GET /auth/session`, `POST /auth/logout`                                                                                                                          | auth가 없거나 invalid/old JWT-like token이면 actor context 없이 통과하고, valid opaque token이면 actor context를 request에 싣는다. Logout revoke 여부는 service-level access/renewal token hash proof가 결정한다 |
| Protected self-service auth/user | `POST /auth/change-password`, `GET/PATCH /api/users/me`, `PATCH /api/users/me/onboarding`, `POST /api/users/me/delete`                                            | `@CurrentUser()` actor context와 self-service capability 기준을 적용한다. `logout`은 renewal-token-only revoke 보존을 위해 Optional auth로 분리한다                                                              |
| Protected domain API             | chat/match/profile/notification/season-participation/roommate-search API                                                                                          | 우선 authenticated-only protected로 유지하고, route/action별 capability가 필요해질 때 `@RequireCapability()`에 추가한다                                                                                          |
| Operational/admin                | auth security event 조회, forced logout, audit disclosure                                                                                                         | 이번 milestone에서 BackOffice 구현은 제외한다. capability naming과 DB role boundary만 남긴다                                                                                                                     |

### 회귀 테스트 baseline

- Web BFF `apps/web/src/app/api/auth/__tests__/shared.test.ts`는 Remember Me persistent cookie가 7일 session/token family TTL을 따르는지 검증한다.
- session dependency 장애는 browser `unavailable`로 유지되고 cookie clear 또는 login redirect를 일으키지 않아야 한다.
- 동일 renewal token의 동시 요청은 하나만 성공하고 나머지는 8초 grace 안에서 stale로 수렴하며 session family를 revoke하지 않아야 한다.
- `rememberMe=false`도 renewal token을 발급하되 access/renewal cookie에 `Max-Age`를 두지 않아 browser-session cookie로 유지한다.
- missing/deleted/incomplete account login은 canonical dummy hash verify를 수행해야 한다.
- Login network throttle은 계정 잠금과 분리한다. Trusted proxy topology로 산출된 IP 기준 30회/1분 burst와 120회/10분 sustained bucket을 적용하며, 정상 shared-IP 20명 burst는 허용 범위다.
- Direct/local API는 forwarding header를 신뢰하지 않는다. Production은 `HTTP_TRUST_PROXY_HOPS` 또는 `HTTP_TRUST_PROXY_CIDRS` 중 실제 ingress topology 하나만 설정한다.
- Web rendering/hook/page/component UX는 auth 정책 baseline의 구현 범위가 아니다. Auth 영역의 Web 변경은 BFF route/helper/cookie/session transport에 한정하고, UI 후속은 #260에서 다룬다.
- Reset/password/session revoke baseline은 기존 API unit/integration test가 보호한다. 특히 reset 성공 시 verification consume/password update/all-session revoke/login lock clear, rollback, 동시 reset proof consume race가 covered 상태다.
- 회귀 테스트는 reset/change password 분리, neutral response, current/other session revoke semantics를 고정해야 한다.
- 세션 회귀 테스트는 renew rotation race, reuse detection, family revoke, logout-all/reset/delete와 renewal 동시 race를 고정해야 한다.

### Reset/change password 계약 baseline

- `send-reset-code`는 존재/비존재/삭제/미인증 계정 모두 같은 성공 응답을 유지한다. 실제 reset code 발급 eligibility는 active + emailVerified 계정으로 제한한다.
- `verify-reset-code`는 missing/deleted/unverified 상태를 노출하지 않는다. 해당 상태에서는 code 검증 service로 진입하지 않고 기존 invalid-code 응답과 같은 contract를 반환한다.
- `reset-password`는 missing/deleted/unverified/expired/consumed proof 상태를 모두 reset restart required contract로 처리한다. 성공 시 새 access token을 발급하지 않고 password update + verification proof consume + active session all-revoke를 같은 serializable transaction 안에서 처리한다.
- `change-password`는 로그인 상태의 protected API이며 forgot/reset-password와 route/contract를 공유하지 않는다. Request는 `currentPassword`와 `newPassword`만 허용한다.
- `change-password` 성공 시 현재 비밀번호를 검증하고, 새 비밀번호 정책과 동일 비밀번호 금지를 적용한 뒤 기존 active session을 모두 revoke한다. 그 다음 현재 session continuity를 위해 새 `AuthSession`/access token을 발급하며, 기존 session의 `rememberMe` 값을 새 session에 보존한다. 현재 access token은 opaque token이다.
- Web 변경은 `/api/auth/change-password` BFF route/helper에 한정한다. BFF는 upstream `accessToken`/`rememberMe`를 브라우저 JSON에 노출하지 않고 `auth-token` httpOnly cookie로만 회전한다.

### Session renewal baseline

- Remember Me는 cookie flag가 아니라 `AuthSession.refreshTokenHash` 기반 renewal token family로 동작한다. 별도 migration 없이 기존 nullable `refreshTokenHash`를 family seed/current renewal token hash로 사용한다.
- `rememberMe=false`도 renewal token을 발급한다. DB session absolute TTL은 24시간이며 access/renewal cookie는 `Max-Age` 없는 browser-session cookie로 둔다.
- `rememberMe=true`는 7일 `AuthSession` absolute TTL과 renewal httpOnly cookie를 사용한다. Web BFF는 access token과 renewal token을 서로 다른 cookie로 저장한다.
- `POST /auth/renew-session`은 current renewal token을 rotate하고 새 access token과 다음 renewal token을 반환한다.
- rotation 직전 renewal token은 8초 grace 동안 `AUTH_SESSION_RENEWAL_STALE`과 retry delay를 반환하며 cookie를 변경하거나 session을 revoke하지 않는다. grace를 벗어난 old/unknown token만 suspected reuse로 보고 session family를 revoke한다.
- renewal rotation은 serializable transaction 안에서 current `refreshTokenHash`, `revokedAt`, `expiresAt`, `rememberMe` 조건부 update로 처리한다. logout/reset/delete가 먼저 session을 revoke하면 renewal은 fail-closed로 실패한다.
- Browser bootstrap은 side effect를 숨긴 GET 대신 `POST /api/auth/session/resolve`를 사용한다. BFF는 access cookie 검증 실패와 renewal cookie 존재 여부를 구분해 `/auth/renew-session` 후 API `/auth/session`을 재조회한다.
- API `GET /auth/session`은 cookie를 변경하지 않는 pure query이며 authoritative rejection reason을 BFF에 제공한다. Browser에는 내부 reason이나 access/renewal token을 노출하지 않는다.
- Web Proxy는 dependency 조회를 수행하지 않고 auth transport cookie 존재 여부만 optimistic gate로 사용한다. 최종 redirect와 recovery는 client session resolve가 담당한다.
- BFF는 stale 응답에서 한 번만 backoff/retry하고, 계속 stale이거나 dependency 오류이면 browser `unavailable`을 반환한다. timeout/5xx/invalid schema에서도 auth cookie를 유지한다.
- `logout`은 access token뿐 아니라 renewal cookie의 session id도 revoke 후보로 전달한다. `reset-password` BFF 성공 응답은 기존 auth cookies를 지워 reset/relogin 정책과 맞춘다.
- Rendering, React hook, page/component UX는 #260 범위이며 auth API/session policy에 포함하지 않는다.

### Opaque session transport baseline

- Access transport는 short JWT bridge가 아니라 opaque access/session token이다. token 값은 `v1.<sessionId>.<random>` 형식의 bearer secret이며, client는 token 내용을 해석하지 않는다.
- DB에는 raw access token을 저장하지 않고 `AuthSession.sessionTokenHash`만 저장한다. `sessionTokenHash`는 unique/point lookup authority이며, `sessionTokenExpiresAt`은 short access token TTL(15분)을 소유한다.
- `AuthSession.expiresAt`은 session/renewal family absolute TTL이다. `rememberMe=false`는 24시간 absolute TTL과 browser-session renewal cookie를 사용하고, `rememberMe=true`는 7일 absolute TTL과 persistent renewal cookie를 사용한다. access token은 두 경우 모두 15분이며 access cookie는 `Max-Age`가 없는 session cookie로 유지하고 renewal rotation으로 복구한다.
- Renewal rotation은 현재 hash를 `previousRefreshTokenHash`로 이동하고 DB clock 기준 8초 동안만 `previousRefreshTokenValidUntil`과 함께 보존한다. 이 구간의 직전 token은 정상 multi-tab 경쟁으로 보고 stale 응답만 반환하며 session을 폐기하지 않는다. Grace가 끝난 직전 token과 그 밖의 unknown token은 reuse로 분류해 session family를 revoke한다.
- Browser는 stale 응답에서 cookie를 변경하지 않고 짧은 backoff 후 session resolve를 한 번만 재시도한다. 재시도도 stale이거나 dependency를 확인할 수 없으면 기존 cookie를 보존한 `unavailable`로 수렴한다.
- 요청 인증은 `JwtService`/`JWT_SECRET`/JWT `sid` payload에 의존하지 않는다. `getSession`, `@CurrentUser()` guard, logout current, chat realtime ticket 발급 등 access-token entrypoint는 opaque token hash lookup을 공유한다.
- old JWT-like access token은 grace window 없이 reject한다. 기존 active session row는 유지하지만 `sessionTokenHash`가 없는 access-only request는 재로그인이 필요하다. Remember Me renewal cookie가 있으면 renewal endpoint가 새 opaque access token으로 복구한다.
- Production Web BFF cookie는 `__Host-auth-token`, `__Host-auth-renewal-token`을 사용한다. Development/test HTTP runtime은 `auth-token`, `auth-renewal-token`을 유지한다.
- Production cookie는 `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`을 강제한다. Canonical public origin은 코드에 hostname을 고정하지 않고 production HTTPS `NEXT_PUBLIC_APP_URL`로 주입한다.
- BFF는 upstream access/renewal token과 login user summary를 browser JSON에 노출하지 않고 최소 결과 DTO와 httpOnly cookie만 반환한다. Auth response는 `Cache-Control: no-store`를 사용한다.
- #206 JWT key rotation은 JWT bridge 제거로 대체 충족한다. JWT가 auth transport path에 다시 남는 예외가 발견되면 release blocker로 올리고 `kid`/keyset/dual verification period를 별도 Decision으로 재검토한다.

### Verification code/proof ACID baseline

- signup/reset verification code 발급은 `emailNormalized + purpose` 단위 advisory lock과 serializable transaction 안에서 기존 unconsumed code/proof를 consume 처리한 뒤 새 code를 생성한다. Reset code도 더 이상 insert-only path를 사용하지 않는다.
- code 검증 대상은 `verifiedAt IS NULL`, `consumedAt IS NULL`, `expiresAt > CURRENT_TIMESTAMP`, `failedAttempts < max` 조건을 만족하는 최신 active code로 제한한다. 이미 verified/consumed/expired 상태인 code는 같은 invalid-code contract로 fail-closed한다.
- 올바른 code 검증은 TypedSQL `markVerificationCodeVerified.sql` conditional update로 처리하며, 동시 검증에서도 verified transition은 최대 1회만 성공한다.
- 잘못된 code 검증은 TypedSQL `recordVerificationCodeFailure.sql` conditional update로 처리한다. `failedAttempts` 증가와 max-attempt 도달 시 `consumedAt` 설정은 같은 atomic update 안에서 일어나며, 동시 실패 시도 후 max에 도달한 code는 active 상태로 남지 않는다.
- signup/reset proof consume은 TypedSQL `consumeVerificationCodeProof.sql` conditional update로 처리한다. `verifiedAt IS NOT NULL`, `consumedAt IS NULL`, `expiresAt > CURRENT_TIMESTAMP`를 모두 만족해야 하며, expired/consumed/stale proof는 password update, session revoke, account creation side effect 없이 rollback/neutral failure로 처리한다.
- PostgreSQL serializable transaction의 raw query `40001 could not serialize` 경합은 retry 대상이다. Retry 후 stale proof는 기존 restart/verification-required contract로 매핑한다.
- Verification code/proof 정책은 API/store/service/transaction ACID 경계와 integration test baseline만 소유하며 React rendering/hook/page/component는 #260 범위다.

### Registration·credential mutation atomic baseline

- Signup은 verification grant purpose lock/consume을 첫 authoritative write로 수행하고 account, display identity, academic identity, legal acceptance, initial session, 필수 `SIGNUP_SUCCEEDED` security event를 같은 serializable transaction에서 commit한다.
- Signup transaction의 display/academic identity, legal acceptance, session, 필수 event append 중 하나라도 실패하면 verification grant consume과 account 생성까지 모두 rollback한다. 계정만 생성되고 로그인이 필요한 부분 성공 응답은 public contract에 두지 않는다.
- 닉네임 사전 확인은 active `SIGNUP` grant가 있는 브라우저에 현재 format/moderation/availability만 알려 주며 reservation을 만들지 않는다. Final signup은 `nicknameNormalized` unique constraint 충돌을 `AUTH_NICKNAME_ALREADY_TAKEN`으로 반환해 사용자를 닉네임 입력 단계로 복구한다.
- Change Password는 current password verify 뒤 transaction에서 current session과 observed password hash를 다시 확인한다. Password CAS update, 기존 active session 전체 revoke, replacement session 1개, password-changed mail outbox, 필수 `SESSION_REVOKE_ALL`·`CHANGE_PASSWORD_SUCCEEDED` event를 같은 transaction에서 commit한다.
- Change Password transaction의 replacement session, outbox, 필수 event append가 실패하면 password와 기존 session revoke를 함께 rollback한다. 비밀번호만 변경되고 재로그인을 요구하는 부분 성공 응답은 public contract에 두지 않는다.
- Signup/Change Password 성공 응답의 access/renewal token은 Web BFF가 HttpOnly cookie로 materialize하고 browser JSON에서는 제거한다.

### Protected API/capability/actor context baseline

- API route access mode는 metadata로 고정한다.
  - `@Public()`은 auth resolution 없이 통과한다.
  - `@OptionalAuth()`는 Bearer token이 없으면 nullable actor context로 통과하고, token이 있으면 opaque session resolve 결과를 `request.authUser`로 고정한다.
  - `@RequireCapability(...capabilities)`는 protected mode를 의미한다. capability 인자가 없으면 authenticated-only protected route이고, 인자가 있으면 actor context의 capability가 모두 있어야 한다.
  - `@CurrentUser()`는 guard가 고정한 actor context만 반환한다. Guard 없이 사용되면 programming error로 본다.
- actor context의 canonical source는 opaque access/session token hash lookup 결과다. legacy JWT-like token, revoked session, access-token expiry, absolute session expiry, deleted user, missing account identity는 actor context resolve 단계에서 fail-closed한다.
- 초기 self-service capability seed는 아래 4개만 구현한다.
  - `user:read:self`
  - `user:update:self`
  - `auth:session:revoke:self`
  - `auth:password:change:self`
- `POST /auth/logout`은 neutral/renewal-token-only logout을 보존하기 위해 Optional auth route로 둔다. Guard는 actor context를 준비만 하고, revoke 권한은 `AuthSessionService.logout()`의 access/renewal token hash proof가 결정한다. `auth:session:revoke:self`는 향후 authenticated revoke-self/logout-all/forced-revoke route에서 사용할 수 있는 seed로 남긴다.
- capability naming은 `domain:action:scope` 형식을 우선한다. BackOffice/admin capability는 이번 milestone에서 구현하지 않고, 필요 시 `admin:<resource>:<action>` 형식으로 후속 BackOffice scope에서 추가한다.
- Domain context guard는 auth actor/capability guard와 분리한다.
  - Domain guard는 route param/body/actor 기반 context 준비와 coarse fail-closed까지만 담당한다.
  - 기존 service/owner가 소유한 사용자-facing action error는 guard가 덮어쓰지 않는다. 필요한 경우 route-specific failure mode로 기존 error code를 유지한다.
  - Current season participant mutation 중 profile/dormitory draft route는 context ensure 실패를 `SEASON_PROFILE_DRAFT_NOT_ALLOWED`로, registration route는 `SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED`로 매핑한다. profile completeness, dormitory selectable/valid, duplicate finalize, stale participant status는 계속 season-participants service/owner가 판단한다.
  - De-registration(`POST /api/seasons/current/participation/deregister`)은 현재 service path가 canonical이다. live `ActiveMatch` 차단, pending request 정리, 비매칭 thread read-only 처리, 같은 season 재참여 금지 side effect를 owner/transaction이 함께 처리하므로 guard로 선차단해 `SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED` behavior를 바꾸지 않는다. 향후 `require-existing` context를 적용하더라도 이 error code와 side effect boundary를 유지해야 한다.
  - Chat detail/read-marker guard는 `ChatThreadContextResolver`를 통해 visible active member context만 준비한다. `leaveThread`는 기존 `CHAT_THREAD_LEAVE_NOT_ALLOWED` service behavior를 보존하기 위해 domain context guard 적용 대상에서 제외한다.
  - Active match unmatch cancel route는 cancel-specific failure mode를 사용해 ended/non-active/no pending request에서도 `ACTIVE_MATCH_UNMATCH_REQUEST_CANCEL_NOT_ALLOWED`를 유지한다.
- Route inventory drift는 unit test에서 모든 controller HTTP route의 method/path/handler와 access mode/capability metadata를 비교해 감지한다.
- Web rendering/hook/page/component 변경은 auth 정책 범위가 아니다. Web 관련 후속은 BFF가 protected API response를 해석하는 범위로 제한하고, React UX는 #260에 남긴다.

### Abuse/audit/security event/mail monitoring baseline

- Auth security event는 `AuthSecurityEvent` table에 저장한다. Event type/severity, actor/target user id, session id, hashed email/IP/User-Agent dimension, safe metadata, createdAt만 저장하고 raw password/token/verification code/secret/hash 값은 저장하지 않는다.
- Event 저장 대상 baseline은 login success/failure/lockout, signup/reset verification code request, verification success/failure, reset password consume, change password success, session refresh, session revoke/logout, reset/change password의 all-session revoke, renewal token reuse detection, opaque transport rejection, mail send success/failure다.
- Login security metric은 no-PII bounded label만 사용한다. 결과 counter, burst/sustained throttle counter, real/dummy password verify duration, in-flight gauge를 기록하며 raw email/IP/user/session id를 metric label로 사용하지 않는다.
- Missing/deleted/incomplete account는 source에 dummy password를 두지 않은 canonical encoded Argon2id hash를 검증한다. Hash profile 변경은 active hash와 dummy hash를 같은 release unit에서 갱신한다.
- 계정 잠금은 Postgres `LoginAttempt`의 5회 실패/5분 기준을 유지한다. Network throttle은 trusted IP 기준 30회/1분 burst와 120회/10분 sustained bucket으로 분리하며 로그인 성공이 IP bucket을 초기화하지 않는다.
- Nickname validation은 active signup grant fingerprint 기준 20회/1분, final signup은 grant fingerprint 기준 5회/10분, Change Password는 actor/session fingerprint 기준 10회/10분 admission을 적용한다. 모두 expensive password hash/verify와 transaction write보다 먼저 실행하고 trusted-IP 제한은 secondary boundary로 둔다.
- Signup nickname/final admission/password hash lifecycle과 Signup·Change Password mutation stage는 bounded operation/outcome metric만 사용한다. Raw email/nickname/user/session/IP/token/grant를 label이나 structured log에 기록하지 않는다.
- Login 같은 운영 관측 event는 기록 실패가 사용자 흐름을 막지 않는 fail-open telemetry가 될 수 있다. 반면 Signup·Reset·Change Password의 credential 상태를 설명하는 필수 lifecycle event는 owning transaction에 포함하며 기록 실패 시 mutation 전체를 rollback한다.
- Password reset 성공 transaction은 해당 email의 `LoginAttempt`를 함께 삭제한다. Proof consume이 rollback되면 password, session, login attempt 상태도 변경하지 않는다.
- 모든 Argon hash/verify는 process-local admission을 공유한다. Release candidate 기본값은 동시 실행 4, 대기열 32, 최대 대기 2초이며 queue 초과나 timeout은 `AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE` 503과 bounded `Retry-After`로 종료한다. Phase 5 production-like stress evidence가 production 최종값을 소유한다.
- Opaque transport rejection은 legacy JWT-like token, malformed access/renewal token, missing/revoked/expired/deleted/incomplete-account session resolve failure를 운영 triage event로 남긴다. 사용자 응답은 기존 fail-closed/neutral contract를 유지한다.
- Mail monitoring은 특정 provider를 고정하지 않는다. `EmailSender` boundary를 monitoring wrapper로 감싸 bounded send outcome과 provider error category만 기록한다. outbox dispatcher는 `accepted`/`failed`/`unknown`/`superseded` counter와 oldest pending lag를 Prometheus에 노출한다.
- SES `ACCEPTED`는 provider 접수 상태이며 최종 delivery와 동일하지 않다. Production은 Configuration Set event publishing으로 delivery, bounce, complaint를 CloudWatch/SNS/EventBridge 중 승인된 운영 경계에 전달하고, raw 수신자·provider message body 없이 correlation id와 bounded outcome만 incident evidence에 사용한다.
- Reset request, mail dispatch, pending outbox lag 운영 판단은 각 owner가 기록한 bounded counter/gauge와 Prometheus rule을 사용한다. 감사 로그를 주기적으로 재조회해 별도 metric이나 특정 솔루션 도입 결정을 만들지 않는다. Raw email/IP는 metric label로 노출하지 않는다.
- CAPTCHA/step-up 같은 추가 abuse control은 runtime 추천 문자열로 결정하지 않고, throttle·lockout·owner-local metric과 production evidence를 바탕으로 별도 정책 변경에서 검토한다. CAPTCHA/step-up provider integration과 BackOffice console은 이번 milestone에서 구현하지 않는다.
- Security event 조회/retention은 비용과 privacy를 함께 고려한다. 기본 제품 구현은 write path와 index baseline만 포함하고, reporting/read replica/BackOffice search는 조회 부하나 운영 승인 trigger가 생길 때 별도 이슈로 분리한다.
- Web rendering/hook/page/component 변경은 없다. BFF가 필요한 경우에도 token/cookie transport와 response mapping에만 한정한다.

### Redis/RDS/DB role 운영 hardening baseline

- Auth state의 source-of-truth는 계속 Postgres다. `AuthSession`, verification code/proof, login lockout, account state, `AuthSecurityEvent`는 Redis가 아니라 DB 기준으로 판정한다.
- Redis는 이번 milestone에서 production dependency로 도입하지 않는다. Redis는 아래 trigger 중 하나가 실제 metric으로 확인될 때만 후속 이슈에서 distributed throttle 또는 hot session cache 후보로 검토한다.
  - multi-instance throttle bypass가 관측된다.
  - auth write IOPS 또는 DB connection/pool pressure가 RDS 비용/성능 병목으로 확인된다.
  - opaque session resolve/login/reset/renewal p95 latency가 설정 threshold를 지속 초과한다.
- Redis가 후속 도입되더라도 session authority, verification authority, account lockout authority를 소유하지 않는다. Redis 장애 시 auth source-of-truth는 Postgres로 유지하고 distributed throttle/cache만 local/DB fallback + alert로 degrade한다.
- Auth TTL cleanup은 `RetentionWorkerPrismaService` credential 경계에서 batch 단위로 실행한다. 실제 client가 없는 미래용 cleanup role은 미리 생성하지 않는다. Cleanup 대상은 expired/revoked auth session, verification code/proof, verification request log, login attempt, security event retention이다. Cleanup query는 indexed cutoff predicate, ordered bounded target CTE, delete returning count 형태로 유지한다.
- Cleanup metric은 table별 deleted count, target별 latest batch saturation, last run/failure timestamp를 no-PII로 기록한다. 개별 target이 batch size를 계속 채우는지는 Prometheus가 지속 시간과 함께 경고로 판정한다.
- DB credential boundary는 application RBAC를 대체하지 않는 defense-in-depth다. Runtime credential은 ordinary auth read/write, retention worker는 TTL cleanup table `SELECT/DELETE`, read-only credential은 `SELECT`, migration credential은 별도 `MIGRATION_DATABASE_URL`/`DIRECT_URL` DDL/admin path로 분리한다.
- Prisma pool 분리는 비용 tradeoff가 있다. 현재 active app-side roles는 runtime, retention worker, retention disclosure 3개이며 default `DATABASE_POOL_MAX=10` 기준 최대 30 connection budget을 baseline으로 둔다. 별도 operational client를 추가하면 role당 `DATABASE_POOL_MAX`만큼 connection budget이 증가하므로 RDS max connection/IOPS 관측과 실제 owner가 확인된 후 결정한다.
- Auth cleanup의 삭제량·실패·target별 latest batch saturation은 owner-local Prometheus metric만 소유한다. `/health/auth` snapshot route는 제공하지 않으며 경고 threshold·지속 시간·routing은 Prometheus rule이 소유한다. 상세 security event 검색과 미래 BackOffice UI는 별도 operator product contract로 설계한다.

## 비밀번호 정책

| 항목                | 정책                                                  |
| ------------------- | ----------------------------------------------------- |
| 최소 길이           | 10자                                                  |
| 최대 길이           | 128자 (FE/BE 동일)                                    |
| 허용 문자           | 영문·숫자·ASCII 기호                                  |
| 필수 조합           | 두지 않음                                             |
| 특수문자 강제       | 하지 않음                                             |
| 대소문자 강제       | 하지 않음                                             |
| 공백                | 허용하지 않음                                         |
| 한글·기타 Unicode   | 허용하지 않음                                         |
| 이메일 정보 차단    | 전체 주소·로컬 파트와 대소문자 무시 exact 비교로 차단 |
| 연속/반복 문자 제한 | 두지 않음                                             |

### 비밀번호 hash 실행 경계

- 회원가입은 새 비밀번호를 저장하기 전에 Argon2id hash를 1회 생성한다.
- 로그인은 저장된 hash 문자열과 입력 비밀번호를 문자열 비교하지 않는다. 사용자 row가 존재하고 cheap lock/account guard를 통과한 각 로그인 시도에서 encoded hash에 포함된 salt/parameter로 Argon2id verify 연산을 수행한다. 따라서 성공 로그인과 잘못된 비밀번호 로그인 모두 hash CPU/memory budget에 포함한다.
- session 조회와 opaque access/renewal token 검증은 password hash를 다시 계산하지 않는다. 이미 발급된 session을 이용하는 일반 API 요청도 Argon2id를 실행하지 않는다.
- 비밀번호 재설정/변경은 새 hash를 생성한다. 기존 비밀번호와 동일한지 또는 현재 비밀번호가 맞는지 확인하는 경로에서는 기존 hash verify가 추가될 수 있다.
- 신규 hash, canonical dummy hash, seed/fixture는 Argon2id 19MiB/t=2/p=1 단일 baseline을 사용한다. 아직 배포된 사용자 데이터가 없으므로 old-hash compatibility나 점진적 rehash는 두지 않는다. 4GB/2CPU local constrained H1~H7/H9 evidence와 H8/AWS reference 미수행 risk acceptance를 근거로 최초 배포 baseline을 확정하며, 실제 운영 지표가 기준을 벗어나면 별도 capacity/credential migration decision으로 재평가한다.

## 회원가입 기본 단계

| 단계   | 수집 항목                                                 | 비고                                                                                                        |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Step 1 | 이메일 인증                                               | 필수                                                                                                        |
| Step 2 | 약관 동의                                                 | 필수                                                                                                        |
| Step 3 | 계정 정보: `nickname`, `password`                         | 필수                                                                                                        |
| Step 4 | 학적 정보: `campus`, `gender`, `collegeCode`, `birthYear` | 필수. `collegeCode`/`birthYear`는 `UserAcademicIdentity`로 저장                                             |
| Step 5 | 완료                                                      | 가입 후/시즌 중 season profile draft journey로 이동한다. 필드 상세는 [profile-model.md](./profile-model.md) |

`POST /auth/signup`은 lifestyle, condition, `intro`, profile object를 받지 않는다. Auth/signup은 계정 row, 표시 identity, account academic identity까지만 원자적으로 만든다. Season profile draft/lifestyle/condition/intro는 season-participants/profile owner가 별도 흐름에서 소유한다.

`POST /auth/signup/validate-nickname`은 활성 `SIGNUP` 이메일 인증 grant를 가진 브라우저가 닉네임 형식·금칙어·현재 사용 가능 여부만 사전 확인하는 보조 API다. 이 결과는 닉네임을 예약하지 않으며, 최종 소유권은 `POST /auth/signup` transaction과 `nicknameNormalized` unique constraint가 결정한다.

## 캠퍼스 정책

| 항목      | 정책                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| 수집 시점 | 회원가입 Step 3                                                              |
| 타입      | `CHUNCHEON`, `SAMCHEOK`, `DOGYE` 등 확장 가능 구조                           |
| 현재 운영 | `CHUNCHEON`만 매칭 서비스 운영. 타 캠퍼스는 가입 가능하나 매칭 서비스 미제공 |
| 변경      | 관리자 요청으로만 변경                                                       |

캠퍼스는 계정 레벨 속성으로 취급한다.
매칭 필터링과 기숙사 건물 범위를 결정하지만, 사용자 자율 변경 대상은 아니다.
캠퍼스 운영 상태, 비운영 캠퍼스 기능 범위, 매칭 참여 자격 상세는 [access-eligibility.md](./access-eligibility.md)를 참조한다.

## 학업 identity 정책

`UserAcademicIdentity`는 계정 레벨의 학업/연령 identity를 소유한다. 이 값은 닉네임처럼 사용자가 자신을 나타내는 기본 정보지만, season profile draft의 선택 필드가 아니다.

| 필드          | 수집 시점              | 정책                                                                                                                                                                                                                                                                                            |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collegeCode` | 회원가입/account setup | viewer campus의 active college catalog 안에서 선택한다. 전과/학적 변경 가능성을 고려해 registration 전 self-service correction allowance를 둔다                                                                                                                                                 |
| `birthYear`   | 회원가입/account setup | exact birth year로 저장한다. 신규 입력/정정 UI guard는 현재 연도 기준 18~30세(`currentYear - 30` ~ `currentYear - 18`) 범위로 제한한다. `ageBand`는 roommate-search filter에서 한국식 나이 code를 season reference year 기준 birthYear bucket으로 변환하는 derived value이며 DB 입력값이 아니다 |

### 단과대 catalog baseline

단과대는 자유 입력 문자열이 아니라 shared catalog와 `CollegeMaster`가 함께 소유하는 reference data다.

- FE는 선택한 캠퍼스의 active catalog만 사용자용 이름으로 노출한다.
- Contract는 알려진 `collegeCode`와 `campus` 조합을 함께 검증한다.
- Signup transaction은 `CollegeMaster(code, campusCode, isActive = true)`를 다시 확인한 뒤 `UserAcademicIdentity`를 생성한다.
- 같은 이름의 단과대가 여러 캠퍼스에 있어도 persistence의 campus ownership이 오염되지 않도록 code는 캠퍼스별로 분리한다.
- 조직 개편으로 이름이나 소속이 바뀌면 공식 학사/입학 자료를 확인해 shared catalog와 seed를 같은 변경 단위로 갱신한다.

2026학년도 사용자용 catalog는 다음을 기준으로 한다.

| 캠퍼스 | 사용자에게 보이는 단과대                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 춘천   | 간호대, 경영대, 농업생명대, 동물생명대, 문화예술·공대, 사범대, 사회과학대, 산림환경대, 수의대, 약대, 의대, 의생명과학대, 인문대, 자연과학대, IT대, 글로벌미래융합대 |
| 삼척   | 공학대, 인문사회대, 디자인스포츠대                                                                                                                                  |
| 도계   | 공학대, 인문사회대, 보건과학대, 자유전공학부                                                                                                                        |

세 캠퍼스 catalog의 공식 기준은 강원대학교의 [2026학년도 수시모집요강](https://admission.kangwon.ac.kr/DATA/download/admission/2026%ED%95%99%EB%85%84%EB%8F%84%20%EA%B0%95%EC%9B%90%EB%8C%80%ED%95%99%EA%B5%90%20%EC%88%98%EC%8B%9C%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95%28%EC%B1%85%EC%9E%90%29.pdf), [2026학년도 정시모집요강](https://itcall.kangwon.ac.kr/DATA/cmmAtchmnfl/tn_entsch_book/20251205/20251205134615102Hsm.pdf)의 캠퍼스·단과대·모집단위 표와 [강원대학교 춘천캠퍼스 조직도](https://kangwon.ac.kr/www/contents.do?key=1092)다. 춘천의 수의과·약학·의과대학은 각각 독립 단과대로 분리하고, 자유전공학부가 속한 글로벌미래융합대학도 별도 단과대로 반영한다. 도계 자유전공은 공식 단과대 분류가 `독립학부`이지만, 가입 화면에서는 실제 소속을 알아보기 쉬운 `자유전공학부`로 표시한다.

Readiness / correction 규칙:

1. 이메일 인증이 끝난 active verified user에게 `UserAcademicIdentity`가 없으면 current-user도 `ACCOUNT_IDENTITY_INCOMPLETE / USER_ACADEMIC_IDENTITY_REQUIRED`로 fail-closed한다. 이는 registration readiness incomplete가 아니라 account invariant 위반이다.
2. 최초 season registration finalize 전에는 `birthYear`를 account setup mistake correction으로 정정할 수 있다. 이 정책은 별도 1회 카운터가 아니라 `SeasonParticipantProfileHistory(source = SEASON_REGISTRATION)` snapshot 존재 여부 기준이다. 따라서 아직 한 번도 registration finalize를 완료하지 않았다면 self-service 정정은 횟수로 잠그지 않는다.
3. registration snapshot이 한 번이라도 확정된 뒤에는 일반 사용자 self-service `birthYear` 변경을 막고, support/admin override + audit event로만 처리한다. 이 경우 API는 `ACADEMIC_BIRTH_YEAR_LOCKED_AFTER_REGISTRATION`을 반환한다.
4. `collegeCode`는 전과 가능성을 고려해 academic year/off-season cycle 단위의 self-service allowance를 둔다. 단, current season registration 완료 이후에는 registration snapshot 정합성을 위해 일반 사용자 변경을 막고 support/admin override + audit event로만 처리한다.
5. College correction allowance는 season-transition scheduler가 모든 사용자를 bulk reset하는 모델이 아니라, 변경 요청 transaction 안에서 `AcademicIdentityCorrectionAllowanceOwner`가 current/upcoming academic cycle을 계산해 lazy rollover 후 atomic decrement하는 모델을 canonical로 둔다. Scheduler는 correctness source가 아니며, 필요 시 관측/prewarm/오래된 row 정리 보조 작업으로만 둔다.
6. 해당 academic-cycle allowance를 모두 사용한 뒤 일반 사용자 `collegeCode` 변경을 요청하면 API는 `ACADEMIC_COLLEGE_CHANGE_ALLOWANCE_EXHAUSTED`를 반환한다. Campus의 current/upcoming academic cycle을 산출할 수 없으면 calendar year fallback 없이 `ACADEMIC_CORRECTION_CYCLE_UNAVAILABLE`로 fail-closed한다.
7. `UserAcademicIdentity` 변경 정책은 nickname의 30일 cooldown을 재사용하지 않는다. Birth year는 최초 등록 전 snapshot-existence guard, college는 academic-cycle allowance라는 field-specific correction policy를 따른다. 다만 nickname과 academic identity 모두 registration 완료 후에는 season-facing snapshot과 live source 불일치를 막기 위한 **registration snapshot lock**을 공유한다.
8. registration snapshot lock으로 일반 사용자 `UserAcademicIdentity` 변경이 막히면 API는 `ACADEMIC_IDENTITY_LOCKED_BY_REGISTRATION`을 반환한다. Nickname의 기존 `NICKNAME_LOCKED_BY_SEASON` code와 같은 잠금 축이지만, 변경 대상과 복구 UX가 다르므로 별도 code를 사용한다.
9. 이미 저장된 `birthYear`는 해가 바뀌어 사용자의 계산 나이가 변해도 invalidate하지 않는다. 입력/수정 범위 검증은 신규 입력 시점의 guard다. 법적 최소 연령 고지는 만 14세 이상으로 유지하되, 서비스 대상이 대학생인 점을 반영해 회원가입/정정 UI는 현재 연도 기준 만 18~30세 출생연도만 선택하게 한다.
10. `UserAcademicIdentityChangeAllowance`는 retained payload가 아니라 self-service correction을 제어하는 운영 상태다. 계정 삭제/비식별화 이후 product path에 남기지 않으며, `UserAcademicIdentity` live row와 함께 삭제/cascade된다. allowance row에는 tombstone display나 retained-vault payload를 만들지 않는다.

## Account identity invariant와 registration readiness

`UserDisplayIdentity`와 `UserAcademicIdentity`는 모두 active verified account가 가져야 하는 account identity row다. 둘 다 signup/account setup transaction에서 원자적으로 생성되어야 하며, 정상 데이터에서는 누락되지 않아야 한다.

runtime 표현도 동일하게 fail-closed를 기본으로 한다.

| 항목                   | 계정 invariant                                                                                                                   | Current-user / registration readiness 표현                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserDisplayIdentity`  | active verified account의 nickname source다. 누락은 계정 표시 identity 자체를 만들 수 없는 데이터 불변식 위반이다                | current-user/session summary를 안전하게 만들 수 없으므로 `ACCOUNT_IDENTITY_INCOMPLETE` + `USER_DISPLAY_IDENTITY_REQUIRED`로 fail-closed한다                                                                         |
| `UserAcademicIdentity` | active verified account의 academic identity source다. 누락은 signup/account setup atomicity 위반 또는 migration gap으로 취급한다 | current-user/account summary를 정상 계정으로 만들 수 없으므로 `ACCOUNT_IDENTITY_INCOMPLETE` + `USER_ACADEMIC_IDENTITY_REQUIRED`로 fail-closed한다. Registration finalize와 public/search snapshot도 fail-closed한다 |

즉, **account invariant**는 “정상 계정 데이터가 갖춰야 하는 최소 row”이고, **registration readiness incomplete**는 “정상 계정이 가진 입력값을 바탕으로 season registration을 완료할 수 없는 사용자 상태”다. `UserAcademicIdentity`는 registration readiness 계산의 입력이지만, active verified account에서 row 자체가 누락된 것은 readiness incomplete가 아니라 account invariant 위반이다. 복구가 필요하면 product current-user 성공 응답이 아니라 support/admin/migration 경로에서 처리한다.

## Academic identity audit / retention

`UserAcademicIdentity` 변경은 nickname 변경처럼 audit 대상이다. 감사 이력은 운영 문의, 전과/오입력 정정, 제재/신고 연계, 계정 삭제 후 제한 보존을 위해 별도 `UserAcademicIdentityChangeEvent` 계열 모델에서 관리한다.

권장 event 필드:

- `userId`, `retainedIdentityId`, `retainedVaultObjectId`
- `source`: `USER_SELF`, `SUPPORT_OVERRIDE`, `POLICY_ENFORCEMENT`, `SYSTEM_BACKFILL`
- `reason`: `USER_CORRECTION`, `ACADEMIC_CYCLE_ALLOWANCE`, `SUPPORT_REQUEST`, `REPORT_REVIEW`, `ENFORCEMENT_ACTION`, `ADMIN_MANUAL`
- `actorType`, `actorId`
- `previousCollegeCode`, `nextCollegeCode`, `previousBirthYear`, `nextBirthYear`
- `seasonId`, `participantId`
- `reportId`, `moderationCaseId`, `sanctionId`, `approvalReference`, `metadata`
- `changedAt`, `redactedAt`, `redactionReason`

계정 삭제 시 academic identity event의 원문 payload는 RRPD `RetainedVaultObject(target = ACADEMIC_IDENTITY_AUDIT_EVENT)`로 이동하고 hot row의 직접 식별 가능 값은 redaction한다. Active `UserAcademicIdentity` live row는 삭제해 product path에 `collegeCode`/`birthYear`가 남지 않게 한다. Disclosure는 retained vault 접근 승인/로그 정책을 따른다.

`UserAcademicIdentityChangeAllowance`는 변경 감사 이력이 아니라 correction 가능 횟수/주기를 나타내는 live operational state다. 따라서 account deletion archive job의 retained-vault 대상이 아니며, 삭제 계정에 대해 별도 tombstone이나 hot marker를 유지하지 않는다. 필요 시 사후 운영 판단은 `UserAcademicIdentityChangeEvent`의 retained audit payload와 access log를 통해 수행한다.

## 백엔드 강제 항목

| 항목                           | 구현 원칙                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| UUID 생성                      | 회원가입 시 서버 생성                                                                                            |
| 이메일 발송                    | Production은 SES 또는 동등 provider, local/test는 stub 허용                                                      |
| Opaque session token 발급/검증 | 서버 DB session/token hash가 최종 권한 보유                                                                      |
| 비밀번호 해싱                  | Release candidate argon2id memory=19MiB/t=2/p=1 단일 baseline. Capacity gate 실패 시 release 전에 전체 설정 조정 |
| 로그인 잠금                    | 서버 저장 상태 기준                                                                                              |

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 관련 이슈                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2026-03-23 | 비밀번호 해싱: bcrypt → argon2id (OWASP 1순위). 최대 길이: "프론트 72자, 서버 72바이트" → "128자 (FE/BE 동일)". 72바이트 제한은 bcrypt 기술 한계로 argon2id에서 불필요                                                                                                                                                                                                                                                                                                  | #176                            |
| 2026-04-23 | 이메일 인증/비밀번호 재설정 인증 코드 TTL을 600초로 명시. 현재 구현 및 기술 문서와 정합화                                                                                                                                                                                                                                                                                                                                                                               | #192                            |
| 2026-05-29 | College correction allowance는 scheduler/bulk reset이 아니라 `AcademicIdentityCorrectionAllowanceOwner`의 요청 transaction lazy rollover + atomic decrement를 canonical으로 두고, cycle 산출 불가 시 fail-closed한다고 명시                                                                                                                                                                                                                                             | #195                            |
| 2026-05-29 | `UserAcademicIdentityChangeAllowance`는 retained-vault payload가 아니라 live correction allowance state이므로 계정 삭제 시 삭제/cascade하고 tombstone을 만들지 않는다고 명시                                                                                                                                                                                                                                                                                            | #195                            |
| 2026-05-29 | `UserDisplayIdentity`와 `UserAcademicIdentity`를 active verified account의 account identity invariant로 정리하고, 둘 중 하나가 누락되면 current-user도 `ACCOUNT_IDENTITY_INCOMPLETE`로 fail-closed한다고 명시. Academic identity 변경 audit 및 계정 삭제 시 retained vault 보존 방향을 추가                                                                                                                                                                             | #195                            |
| 2026-05-29 | `UserAcademicIdentity`를 account-level academic identity로 추가하고, `collegeCode`/`birthYear` 수집·정정·registration snapshot lock 정책을 명시. Nickname과 academic identity 모두 registration 완료 후 live source와 season snapshot 불일치를 막는 같은 잠금 축을 사용하되, academic identity는 `ACADEMIC_IDENTITY_LOCKED_BY_REGISTRATION`, `ACADEMIC_BIRTH_YEAR_LOCKED_AFTER_REGISTRATION`, `ACADEMIC_COLLEGE_CHANGE_ALLOWANCE_EXHAUSTED` 전용 code를 사용한다고 정리 | #195                            |
| 2026-05-30 | `birthYear` self-service correction은 1회 카운터가 아니라 최초 `SEASON_REGISTRATION` snapshot 존재 여부 기준이며, registration finalize 전에는 횟수로 잠그지 않는다고 명시했다                                                                                                                                                                                                                                                                                          | #195                            |
| 2026-06-02 | Auth session/security baseline 기준을 반영했다. DB-backed session/token family, Remember Me 7일 baseline, Redis metric gate, email/secret/DB role 후속 gate, reset verification ACID, self-service capability seed, cookie/CSRF matrix, Web BFF-only scope(#260), public/optional/protected API inventory와 회귀 테스트 baseline을 명시했다                                                                                                                             | Auth 제품 완성                  |
| 2026-06-02 | Auth reset/change password 기준을 반영했다. reset code eligibility를 active+verified로 제한하고 verify/reset 단계의 missing/deleted/unverified 상태 노출을 막았으며, protected change-password contract와 BFF-only cookie rotation 기준을 명시했다                                                                                                                                                                                                                      | Auth 제품 완성                  |
| 2026-06-02 | Auth session renewal 기준을 반영했다. Remember Me 7일 renewal token family, refreshTokenHash 기반 rotation/reuse detection/family revoke, logout/reset/delete renewal race fail-closed, BFF access/renewal cookie transport 분리를 명시했다                                                                                                                                                                                                                             | Auth 제품 완성                  |
| 2026-06-03 | Auth verification ACID 기준을 반영했다. signup/reset verification code replacement, verify/failure/proof consume을 advisory lock + TypedSQL conditional update + serializable retry 기준으로 정리하고, expired/stale proof side effect 금지와 Web UI 제외 범위를 명시했다                                                                                                                                                                                               | Auth 제품 완성                  |
| 2026-06-03 | Auth protected API/capability 기준을 반영했다. `@Public()`/`@OptionalAuth()`/`@RequireCapability()`/`@CurrentUser()` metadata 기반 route auth matrix, opaque session actor context, self-service capability seed, logout Optional auth/service proof boundary, BackOffice 제외 admin capability naming을 명시했다                                                                                                                                                       | Auth 제품 완성                  |
| 2026-06-03 | Auth domain context guard 기준을 반영했다. Domain context guard는 auth actor/capability guard와 분리하고, service/owner의 사용자-facing action error를 덮어쓰지 않도록 route-specific failure mode를 사용한다고 명시했다. De-registration은 service path를 canonical으로 유지하고, `leaveThread` guard 제외와 active-match cancel-specific error 보존도 함께 정리했다                                                                                                   | Auth 제품 완성                  |
| 2026-06-03 | Auth abuse/audit/security event 기준을 반영했다. `AuthSecurityEvent` schema, hashed email/IP/UA dimension, 민감값 저장 금지, login/reset/session/opaque/mail event baseline, mail monitoring metric, abuse/alert trigger, CAPTCHA/BackOffice 제외 범위를 명시했다                                                                                                                                                                                                       | Auth 제품 완성                  |
| 2026-06-03 | Auth 운영 hardening 기준을 반영했다. Postgres authoritative 유지, Redis metric gate/degrade, auth TTL cleanup batch/index/lag metric, DB credential boundary, Prisma pool budget, `/health/auth` 운영 snapshot 기준을 명시했다                                                                                                                                                                                                                                          | Auth 제품 완성                  |
| 2026-06-03 | Auth 운영 정책 보강 기준을 반영했다. auth cleanup은 현재 `RetentionWorkerPrismaService` 실행/future `auth_cleanup_worker` role 후보임을 명시하고, `/health/auth`를 public internet health가 아닌 `admin:operations:health:read` ops-only endpoint로 정책화했다                                                                                                                                                                                                          | Auth 제품 완성                  |
| 2026-06-04 | Auth 제품 정책 기준을 반영했다. 회원가입 Step 4는 auth API payload가 아니라 season profile draft journey이며, signup과 회원가입 사전 검증이 lifestyle/intro/profile object를 받지 않는다고 명시했다.                                                                                                                                                                                                                                                                    | Auth 제품 완성                  |
| 2026-08-01 | 회원가입 draft 검증을 제거하고 인증 grant 기반 닉네임 전용 사전 검증 경계로 축소했다. 닉네임 사전 확인은 예약이 아니며 최종 signup transaction의 unique constraint를 소유권 기준으로 유지한다.                                                                                                                                                                                                                                                                          | Auth registration lifecycle     |
| 2026-06-04 | Official policy standalone wording cleanup을 수행했다. 계획 단계 의존 표현을 제품 정책 언어로 바꾸고, opaque DB-backed session, Postgres authoritative, Web UX 후속 범위, operations health boundary를 독립 정책 문장으로 정리했다                                                                                                                                                                                                                                      | Auth 제품 완성                  |
| 2026-06-17 | Production 이메일 발송 baseline을 추가했다. Stub/log sender는 local/test/development 전용이고, production은 SES 또는 동등 provider, verified identity, DKIM 권장, sandbox 해제 기준을 따른다고 명시했다                                                                                                                                                                                                                                                                 | production deployment readiness |
| 2026-06-17 | SESv2 auth email sender adapter 기준을 반영했다. Production은 `EMAIL_PROVIDER=ses`와 monitored `EMAIL_SENDER` wrapper 뒤의 SES delegate를 사용하고, provider failure는 bounded category로만 기록한다.                                                                                                                                                                                                                                                                   | production deployment readiness |
| 2026-07-27 | 비밀번호 hash가 회원가입뿐 아니라 비밀번호 기반 로그인 verify에도 실행되며, session/token 검증은 Argon 부하에 포함되지 않는다는 실행 경계를 명시했다. Argon2id 19MiB 전환은 4GB/2vCPU production-like stress gate 이후로 고정했다                                                                                                                                                                                                                                       | password hash capacity          |
| 2026-07-28 | Browser session tri-state, unavailable cookie 보존, remember-off session renewal, 8초 previous-token stale grace, invalid-account dummy hash 검증을 Login/Session target baseline으로 확정했다                                                                                                                                                                                                                                                                          | login/session hardening         |
| 2026-07-28 | Auth BFF의 8초 timeout, network/5xx/schema failure 분류, login runtime response 검증, minimal browser DTO, no-store, same-origin metadata 관찰, trusted XFF 정규화, production `__Host-` cookie와 HTTPS canonical origin 기준을 반영했다                                                                                                                                                                                                                                | auth BFF hardening              |
| 2026-07-28 | Browser session bootstrap을 명시적 POST resolve와 authenticated/unauthenticated/unavailable tri-state로 전환했다. API rejection reason, unavailable cookie 보존, Main recovery, auth flow nonblocking notice, optimistic Proxy gate를 연결했다                                                                                                                                                                                                                          | session resolve boundary        |
| 2026-07-29 | 모든 로그인·회원가입·비밀번호 변경 session에 renewal token을 발급하고, access cookie는 항상 session cookie로 유지하며 renewal cookie의 persistence만 로그인 유지 선택에 따라 구분했다                                                                                                                                                                                                                                                                                   | remember-me semantics           |
| 2026-07-29 | Renewal rotation에 직전 token hash와 DB clock 기반 8초 grace를 추가했다. 정상 multi-tab 경쟁은 stale + browser 1회 재시도로 복구하고, grace 밖 old/unknown token만 reuse event와 session revoke로 처리한다                                                                                                                                                                                                                                                              | renewal concurrency             |
| 2026-07-29 | Login timing을 canonical dummy Argon2id verify로 정규화하고 account lock과 30/min·120/10min trusted-IP throttle을 분리했다. Password reset transaction은 login lock을 함께 해제하며 login 결과·throttle·real/dummy verify metric을 no-PII label로 기록한다                                                                                                                                                                                                              | login security hardening        |
| 2026-08-01 | Auth verification/credential/mail outbox metric, versioned HMAC dimension, reset abuse·mail failure·outbox lag alert 연결을 운영 기준으로 추가했다. Signup/Change Password의 transaction 이후 session 발급 실패는 재로그인 가능한 stable outcome으로 구분한다                                                                                                                                                                                                           | auth security operations        |
| 2026-08-02 | Signup의 account·identity·legal·grant·initial session·필수 audit과 Change Password의 password CAS·session replacement·mail outbox·필수 audit을 각각 단일 transaction으로 통합했다. 부분 성공 응답을 제거하고 nickname/final-signup/change-password admission 및 no-PII metric 기준을 추가했다.                                                                                                                                                                          | auth credential lifecycle       |
| 2026-08-03 | 신규·dummy hash와 seed/fixture를 Argon2id 19MiB/t=2/p=1 단일 baseline으로 맞췄다. 배포 사용자 데이터가 없어 old-hash migration 분기는 두지 않으며, 모든 password hash/verify는 동시 4·대기 32·2초 timeout의 process-local admission을 공유하고 overload는 bounded 503으로 종료한다. Production 최종 profile과 상한은 production-like capacity gate가 소유한다.                                                                                                          | password hash capacity          |
| 2026-08-03 | 실제 signal source가 없던 Redis 도입 판단 runtime gate와 전용 환경변수·metric을 제거했다. Auth health는 cleanup/RDS pool의 현재 운영 상태만 노출하고, 후속 인프라 도입은 production-like 부하 증거와 운영 runbook에서 결정한다.                                                                                                                                                                                                                                         | auth operations                 |
| 2026-08-03 | 감사 이벤트를 주기적으로 재조회하던 security alert 집계를 제거했다. Reset/mail/outbox 운영 경보는 owner-local metric과 Prometheus rule을 사용하고 `/health/auth`는 cleanup/RDS pool 상태만 제공한다.                                                                                                                                                                                                                                                                    | auth operations                 |
| 2026-08-04 | 실제 시간을 나타내지 않던 cleanup lag sentinel을 target별 latest batch saturation으로 교체했다. `/health/auth`의 alert/RDS planning 판정과 미사용 cleanup 전용 DB role을 제거하고 cleanup failure·지속 포화 경고는 Prometheus가 소유하도록 정리했다.                                                                                                                                                                                                                    | auth operations                 |
| 2026-08-05 | 비밀번호 정책을 10~128자 printable ASCII·공백 미허용으로 current contract와 맞추고 이메일 전체 주소·로컬 파트 exact 차단을 명시했다. 4GB/2CPU H1~H7/H9 local constrained evidence와 H8/AWS reference 미수행 risk acceptance를 근거로 Argon2id 19MiB/t=2/p=1 및 admission 동시 4·대기 32·2초를 최초 배포 baseline으로 확정했다.                                                                                                                                          | password policy/capacity        |
