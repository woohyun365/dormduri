# apps/backoffice-web

운영자가 SSM 포트 포워딩의 `http://localhost:4300`으로 여는 백오피스 화면과 BFF다. 로그인·초대 등록·복구 로그인, 운영자 계정·초대,
권한 요청·승인, 감사 목록과 월 점검 기록, 내 보안 설정을 보인다. 운영자 접근 규칙의 원본은
[운영자 접근 정책](../../docs/policies/operator-access.md)(`OA-R*`)이고, 업무 판정은 [백오피스 API](../backoffice-api/README.md)가 한다.
이 문서는 화면과 BFF가 그 규칙을 어디서 지키는지와 실행·test 방법을 설명한다.

## 1. 경계

- browser는 이 앱의 BFF(`src/app/api/**`)만 부른다. 백오피스 API는 BFF와 server component만 부르고(`src/bff/upstream.ts`), 그
  주소(`BACKOFFICE_API_URL`)는 browser에 나가지 않는다.
- 다른 앱(`apps/web`·`apps/api`·`apps/backoffice-api`) code를 import하지 않는다(ESLint `no-restricted-imports`). 계약은
  `@repo/shared/backoffice`의 요청·응답 schema다. BFF는 upstream 응답을 응답 schema로 parse하고, 맞지 않으면 고정 오류
  `upstream_invalid`(502)로 답한다.
- 화면은 server component가 요청마다 API를 `no-store`로 읽어 그리고 client cache library를 두지 않는다. 상태 변경은 BFF route
  handler만 받고 server action(`'use server'`)은 쓰지 않는다(ESLint가 막는다). 변경 뒤에는 `router.refresh()`로 server에서 다시
  그린다.
- 판정은 API가 한다. 메뉴와 버튼은 session의 권한 목록으로 숨기기만 한다.

## 2. 구조

| 위치                   | 책임                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `src/proxy.ts`         | 모든 page 요청의 nonce CSP(§5)                                                                |
| `src/bff/`             | 출처 대조(`request-guard.ts`), session cookie, upstream client, BFF route wrapper             |
| `src/app/api/**`       | BFF route 22개. 모두 `bffMutation`으로 만든 POST                                              |
| `src/server/`          | server render read: session gate(`requireFullSession`·`requireRecoverySession`), 화면 read    |
| `src/app/(auth)/**`    | 로그인·초대 등록·복구 로그인 page                                                             |
| `src/app/(console)/**` | 로그인 뒤 page: 홈, 운영자 계정, 권한 요청, 감사 기록, 내 보안 설정                           |
| `src/screens/<기능>/`  | 화면 component(client). `credentials/`는 TOTP·복구 code 한 번 보기를 등록·보안 화면이 같이 씀 |
| `src/client/`          | browser의 BFF 호출과 passkey 의식(`@simplewebauthn/browser`)·재인증                           |
| `src/ui/`              | 공용 form 부품, 오류 문구, 한국어 이름표, KST 시각 표시                                       |
| `src/security/`        | CSP와 공통 보안 header 값                                                                     |

## 3. BFF와 session

- Session token은 로그인·등록 응답에서 BFF가 받아 `dormduri_bo_session` cookie에만 둔다. 속성은 `HttpOnly`·`Secure`·
  `SameSite=Strict`·`Path=/`이고 Domain과 만료가 없다(browser를 닫으면 사라진다). page에는 token을 주지 않는다. 로그아웃과,
  API가 `session_required`·`session_expired`로 답한 BFF 응답은 cookie를 지운다.
- 모든 BFF route는 POST다. route wrapper(`src/bff/mutation-route.ts`)는 차례로 ① `Origin`이 `http://localhost:4300`이고
  `Sec-Fetch-Site`가 `same-origin`이며 `Host`가 `localhost:4300`인지(하나라도 없거나 다르면 403 `forbidden_origin`), ② path id가
  UUID인지(아니면 404), ③ session이 필요한 route에 cookie가 있는지(없으면 401), ④ 본문이 `application/json`이고(아니면 415)
  64 KiB 이하이며 shared 요청 schema에 맞는지(아니면 400)를 본 뒤에만 API를 한 번 부른다. 앞 단계에서 거절한 요청은 API에 닿지
  않는다. 모든 응답은 `Cache-Control: no-store`다.
- `SameSite=Strict`는 같은 site인 다른 localhost port(사용자 Web 개발 server 3000, Grafana 터널 3001)의 요청을 막지 못한다. 위
  출처 대조가 browser가 보내는 위조 요청을 막고, 운영자 컴퓨터 안 process가 cookie를 재사용하는 것은 막지 못한다(전용 browser
  profile 안내는 배포 runbook).
- 재인증이 필요한 작업(권한 요청·승인·거절, 계정 비활성화, passkey 추가, TOTP·복구 code 재발급)은 API가
  `reauthentication_required`로 답하면 화면이 passkey 재인증을 한 번 하고 같은 작업을 다시 보낸다(`withReauthentication`).
- 모든 route와 접근 방식은 `src/app/api/bff-route-table.test.ts`의 표와 같아야 한다. 새 route는 `bffMutation`으로 만들고 표에
  행을 더한다.

## 4. 화면과 idle 15분

- 모든 page는 요청마다 server에서 그린다(root layout의 `connection()`). page마다 session을 읽고(`GET /auth/session`, React
  `cache`로 요청당 한 번) 없거나 끝났으면 로그인으로, recovery 범위면 `/recovery`로 보낸다.
- API는 session으로 온 모든 요청에서 마지막 활동 시각을 옮긴다. 그래서 화면은 session을 주기적으로 묻지 않고 링크 prefetch도
  끈다(`prefetch={false}`). idle 안내(`IdleNotice`)는 server가 읽은 idle 만료까지 남은 시간으로 세고, BFF 호출이나 page 이동
  뒤에는 15분을 다시 센다. absolute 8시간은 활동으로 늘지 않는다. 시간이 다 되면 안내와 로그인 링크를 보이고 아무 요청도 보내지
  않는다.
- 감사·승인 요청 목록은 최신순 keyset page다. 다음 page 링크는 API가 준 `nextPage`(`beforeTime`·`beforeId`)를 query로 넘긴다.
- 운영자 이름·이메일은 owner 역할(`admin:account:invite`)만 본다. 그 밖의 운영자는 감사·요청 목록에서 계정 id만 본다(plan §12
  disclosure matrix).

## 5. 보안 header

- `src/proxy.ts`가 요청마다 128 bit nonce를 만들어 CSP를 요청 header(Next.js가 거기서 nonce를 읽어 자기 script에 붙인다)와
  응답 header에 둔다: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; connect-src 'self'; img-src 'self'
data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'`. 개발 server만 `'unsafe-eval'`을 더한다.
  적용 방식은 Next.js 16.4 동봉 문서 `content-security-policy.md`(nonce는 동적 rendering 필요)를 따른다.
- inline `style` 속성은 CSP가 막으므로 component는 class만 쓴다.
- `next.config.ts`가 모든 응답에 `X-Content-Type-Options: nosniff`·`Referrer-Policy: no-referrer`를 두고, 동적 page는 Next.js가
  `Cache-Control: no-store`를 둔다. http localhost라 HSTS는 두지 않는다. 공개 포트·Host 대조(`421`)는 admin ingress가 맡는다.

## 6. 환경변수

| 이름                 | 뜻                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BACKOFFICE_API_URL` | 백오피스 API의 내부 origin(production 필수, path·query·credential 없음). 개발 기본 `http://127.0.0.1:4310` |

Origin(`http://localhost:4300`)과 Host는 code 상수다. 바꾸면 WebAuthn RP ID와 함께 모든 passkey를 다시 등록해야 한다.

## 7. Test

| 명령(root)                           | 범위                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `pnpm backoffice-web:check`          | 준비(shared build) 뒤 lint·typecheck·unit                                                                   |
| `pnpm backoffice-web:test:prepared`  | BFF(출처 대조, cookie 속성, route wrapper와 upstream fake, route 전수 표), CSP, component(role·label query) |
| `pnpm backoffice-web:build:prepared` | `next build`                                                                                                |
| `pnpm backoffice-web:e2e:prepared`   | Playwright Chromium e2e(아래)                                                                               |

E2e(`e2e/backoffice-flow.spec.ts`)는 production build를 고정 origin `http://localhost:4300`에 띄우고, global setup이 일회용
schema에 운영과 같은 role bootstrap·migration·grant 표를 적용한 뒤 실제 백오피스 API build를 `dormduri_backoffice`로 띄워
`bootstrap-owner` code를 받는다. Chromium 가상 authenticator로 owner(platform passkey)가 등록 → TOTP 확인 → 로그아웃·재로그인
→ 운영자 초대 → 운영자(security key) 등록 → 권한 요청과 1인 자기 승인 → 운영자가 감사 목록에서 승인 확인을 지나고, 모든 page의
CSP 위반 0, cookie 속성, 보안 header, 쉬는 page의 요청 0, 위조 출처 403, axe 검사 한 번을 본다. Admin DB URL은
`DORMDURI_BACKOFFICE_E2E_ADMIN_DATABASE_URL`, 없으면 `DATABASE_URL`이고 loopback이 아니면
`DORMDURI_BACKOFFICE_E2E_DISPOSABLE_DATABASE=yes`가 있어야 돈다. API port는 `BACKOFFICE_E2E_API_PORT`(기본 4311)다. CI는
`.github/workflows/backoffice-ci.yml`의 Web job이 이 순서로 돌린다.

```sh
pnpm db:up
pnpm backoffice-api:prepare && pnpm backoffice-api:build:prepared
pnpm backoffice-web:build:prepared
pnpm --dir apps/backoffice-web exec playwright install chromium
pnpm backoffice-web:e2e:prepared
```

실제 Owner browser·authenticator가 RP ID `localhost`로 passkey를 등록하고 `http://localhost`의 `Secure` cookie를 저장하는지는
단계 배포 smoke에서 확인한다(plan OQ-BF1).
