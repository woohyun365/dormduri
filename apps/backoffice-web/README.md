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

| 위치                                 | 책임                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                       | 모든 page 요청의 nonce CSP(§5)                                                                                  |
| `src/bff/`                           | 출처 대조(`request-guard.ts`), session cookie, 활동 header, upstream client, BFF route wrapper                  |
| `src/app/api/**`                     | BFF route 22개. 모두 `bffMutation`으로 만든 POST                                                                |
| `src/server/`                        | server render read: session gate(`requireFullSession`·`requireRecoverySession`), 화면 read                      |
| `src/app/(auth)/**`                  | 로그인·초대 등록·복구 로그인 page                                                                               |
| `src/app/(console)/**`               | 로그인 뒤 page: 홈, 운영자 계정, 권한 요청, 감사 기록, 내 보안 설정                                             |
| `src/screens/<기능>/`                | 화면 component(client). `credentials/`는 TOTP·복구 code 한 번 보기를 등록·보안 화면이 같이 씀                   |
| `src/client/`                        | browser의 BFF 호출과 passkey 의식(`@simplewebauthn/browser`)·재인증                                             |
| `src/ui/`                            | 공용 form 부품, 오류 문구, 한국어 이름표, KST 시각 표시. 디자인 지침은 [`src/ui/README.md`](./src/ui/README.md) |
| `src/app/globals.css`                | 시각 값 token 원본(`@theme inline`). 화면은 token 이름만 쓰고 ESLint가 그 밖의 값을 막는다                      |
| `src/security/`                      | CSP와 공통 보안 header 값                                                                                       |
| `.storybook/`, `src/**/__stories__/` | Storybook 설정과 story(가짜 fixture, 디자인 지침 ⑨)                                                             |

## 3. BFF와 session

- Session token은 로그인·등록 응답에서 BFF가 받아 `dormduri_bo_session` cookie에만 둔다. 속성은 `HttpOnly`·`Secure`·
  `SameSite=Strict`·`Path=/`이고 Domain과 만료가 없다(browser를 닫으면 사라진다). page에는 token을 주지 않는다. API가
  `session_required`·`session_expired`로 답한 BFF 응답은 cookie를 지운다. 로그아웃은 API 결과와 관계없이 cookie를 지우고,
  API가 끝냈음을 확인하지 못했으면(닿지 못함·오류) 그 오류로 답해 로그인 화면이 그 사실을 알린다.
- 모든 BFF route는 POST다. route wrapper(`src/bff/mutation-route.ts`)는 차례로 ① `Origin`이 `http://localhost:4300`이고
  `Sec-Fetch-Site`가 `same-origin`이며 `Host`가 `localhost:4300`인지(하나라도 없거나 다르면 403 `forbidden_origin`), ② path id가
  UUID인지(아니면 404), ③ session이 필요한 route에 cookie가 있는지(없으면 401), ④ 본문이 `application/json`이고(아니면 415)
  64 KiB 이하이며(넘으면 그 자리에서 읽기를 멈춤) shared 요청 schema에 맞는지(아니면 400)를 본 뒤에만 API를 한 번 부른다. 앞 단계에서 거절한 요청은 API에 닿지
  않는다. 모든 응답은 `Cache-Control: no-store`다.
- `SameSite=Strict`는 같은 site인 다른 localhost port(사용자 Web 개발 server 3000, Grafana 터널 3001)의 요청을 막지 못한다. 위
  출처 대조가 browser가 보내는 위조 요청을 막고, 운영자 컴퓨터 안 process가 cookie를 재사용하는 것은 막지 못한다(전용 browser
  profile 안내는 배포 runbook).
- 재인증이 필요한 작업(권한 요청·승인·거절, 계정 비활성화, TOTP·복구 code 재발급. 백오피스 API README의 목록과 같다)은 API가
  `reauthentication_required`로 답하면 화면이 passkey 재인증을 한 번 하고 같은 작업을 다시 보낸다(`withReauthentication`).
  passkey 추가도 같은 wrapper로 보내지만 지금 API는 그 작업에 재인증을 요구하지 않는다.
- 모든 route는 `src/app/api/bff-route-table.test.ts`의 표와 같아야 한다. 표는 route마다 접근 방식, upstream path, 요청 fixture,
  upstream 성공 응답(본문 200 또는 204)과 page가 받는 본문을 두고, 실제 route module을 upstream fake로 실행한다. 새 route는
  `bffMutation`으로 만들고 표에 행을 더한다. e2e는 모든 route를 실제 API로 한 번씩 지난다(§7).

## 4. 화면과 idle 15분

- 모든 page는 요청마다 server에서 그린다(root layout의 `connection()`). page마다 session을 읽고(`GET /auth/session`, React
  `cache`로 요청당 한 번) 없거나 끝났으면 로그인으로, recovery 범위면 `/recovery`로 보낸다.
- API는 session으로 온 모든 요청에서 마지막 활동 시각을 옮긴다. 그래서 화면은 session을 주기적으로 묻지 않고 링크 prefetch도
  끈다(`prefetch={false}`). idle 안내(`IdleNotice`)는 server가 읽은 idle 만료까지 남은 시간으로 센다. API에 닿은 BFF 호출(BFF가
  `x-backoffice-session-activity` header로 알림. API의 권한 거부도 활동이다)이나 page 이동 뒤에는 15분을 다시 세고 이미 뜬 안내를
  지운다. BFF가 스스로 거절했거나 API에 닿지 못한 호출은 세지 않는다. absolute 8시간은 활동으로 늘지 않는다. 시간이 다 되면
  안내와 로그인 링크를 보이고 아무 요청도 보내지 않는다.
- 감사·승인 요청 목록은 최신순 keyset page다. 다음 page 링크는 API가 준 `nextPage`(`beforeTime`·`beforeId`)를 query로 넘긴다.
- 운영자 이름·이메일은 owner 역할만 본다. 화면은 이름을 계정 목록 API에서 얻고, 그 API가 `admin:account:invite`를 요구한다. 그 밖의
  운영자는 감사·요청 목록에서 계정 id만 본다.

## 5. 보안 header

- `src/proxy.ts`는 `Sec-Fetch-Site`가 `same-site`·`cross-site`인 page 요청을 403으로 거부한다. 다른 localhost port page의 이미지·
  링크도 `SameSite=Strict` cookie를 싣고, page를 그리면 session을 읽어 활동 시각을 옮기기 때문이다. 운영자의 page 요청은 직접 연
  것(`none`)과 앱 안 이동(`same-origin`)뿐이다. prefetch 요청도 proxy를 지나 같은 판정을 받는다(화면은 prefetch를 끈다).
- `src/proxy.ts`가 요청마다 128 bit nonce를 만들어 CSP를 요청 header(Next.js가 거기서 nonce를 읽어 자기 script에 붙인다)와
  응답 header에 둔다: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; connect-src 'self'; img-src 'self'
data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'`. 개발 server만 `'unsafe-eval'`을 더한다.
  적용 방식은 Next.js 16.4 동봉 문서 `content-security-policy.md`(nonce는 동적 rendering 필요)를 따른다.
- inline `style` 속성은 CSP가 막으므로 component는 class만 쓴다.
- 오류 화면의 "다시 시도"는 `retry()`로 server component를 다시 읽는다(Next.js 16.3+, `reset()`은 다시 읽지 않는다).
- `next.config.ts`가 모든 응답에 `X-Content-Type-Options: nosniff`·`Referrer-Policy: no-referrer`를 두고, 동적 page는 Next.js가
  `Cache-Control: no-store`를 둔다. http localhost라 HSTS는 두지 않는다. 공개 포트·Host 대조(`421`)는 admin ingress가 맡는다.

## 6. 환경변수

| 이름                 | 뜻                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BACKOFFICE_API_URL` | 백오피스 API의 내부 origin(production 필수, path·query·credential 없음). 개발 기본 `http://127.0.0.1:4310` |

Origin(`http://localhost:4300`)과 Host는 code 상수다. 바꾸면 WebAuthn RP ID와 함께 모든 passkey를 다시 등록해야 한다.

## 7. Test

| 명령(root)                                     | 범위                                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm backoffice-web:check`                    | 준비(shared build) 뒤 lint·typecheck·unit                                                                                                                                    |
| `pnpm backoffice-web:test:prepared`            | BFF(출처 대조, cookie 속성, route wrapper와 upstream fake, route 전수 표), CSP, component(role·label query), token·server action lint 실효 설정, story fixture의 공유 schema |
| `pnpm backoffice-web:build:prepared`           | `next build`                                                                                                                                                                 |
| `pnpm backoffice-web:e2e:prepared`             | Playwright Chromium e2e(아래)                                                                                                                                                |
| `pnpm backoffice-web:storybook:build:prepared` | Storybook static build(`storybook-static/`)                                                                                                                                  |
| `pnpm backoffice-web:storybook:check:prepared` | story 검사: 모든 story의 render 오류 0·axe 위반 0(디자인 지침 ⑨)                                                                                                             |

E2e(`e2e/backoffice-flow.spec.ts`)는 production build를 고정 origin `http://localhost:4300`에 띄우고, global setup이 일회용
schema에 운영과 같은 role bootstrap·migration·grant 표를 적용한 뒤 실제 백오피스 API build를 `dormduri_backoffice`로 띄워
`bootstrap-owner` code를 받는다. Chromium 가상 authenticator로 owner(platform passkey)가 등록 → TOTP 확인 → 로그아웃·재로그인
→ 운영자 초대 → 운영자(security key) 등록 → 권한 요청과 1인 자기 승인 → 운영자가 감사 목록에서 승인 확인을 지난다. 이어 둘째 owner의
거절, 요청 취소, 초대 취소, 계정 비활성화, 월 점검 기록, TOTP·복구 code 재발급, 다른 기기 passkey 추가, TOTP·복구 code 복구
로그인과 복구 session의 passkey 등록으로 모든 BFF route를 실제 API로 한 번씩 지난다. 모든 page의 CSP 위반 0, cookie 속성, 보안
header, 가짜 시계로 16분을 보낸 page의 요청 0과 idle 안내, 위조 출처 403, axe 검사 한 번을 본다.
`e2e/cross-port-request.spec.ts`는 다른 localhost port에 띄운 page의 이미지·prefetch를 실제 Chromium이 `Sec-Fetch-Site: same-site`로
보내고 403을 받는지 본다(§5). Admin DB URL은
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
백오피스 단계 배포의 smoke에서 확인한다.
