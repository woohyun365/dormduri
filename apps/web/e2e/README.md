# Web Playwright E2E

Web Playwright는 두 lane으로 분리한다.

## Web-only smoke

```bash
pnpm web:e2e
```

- `apps/web/playwright.config.ts`를 사용한다.
- production-like standalone Web server를 띄우고 `API_URL=http://127.0.0.1:9`로 고정한다.
- 목적은 public route와 unauthenticated protected-route redirect를 API/DB 없이 확인하는 것이다.
- auth route smoke는 `/login`, `/signup`, `/password-reset`의 shell 렌더링, 접근성 locator, public handoff link, neutral 안내 copy를 확인한다.
- API/DB가 없는 lane이므로 `POST /api/auth/session/resolve`는 Playwright route/fetch smoke seam으로 `{ status: "unauthenticated" }`를 반환하게 고정한다.
  실제 이메일 인증 코드 발송, signup/reset happy path, cookie가 필요한 로그인 성공 journey는 full-stack lane 또는 별도 auth E2E에서 다룬다.

## Full-stack `/main` smoke

```bash
pnpm web:e2e:fullstack
# 또는
pnpm --dir apps/web exec playwright test -c playwright.fullstack.config.ts
```

- `apps/web/playwright.fullstack.config.ts`를 사용한다.
- local Postgres를 `docker-compose.dev.yml`로 띄우고, Prisma schema push/seed 후 API dev server와 Web dev server를 함께 실행한다.
- `main-home.fullstack.spec.ts`는 실제 `/login` UI 입력 → session cookie → `/main` handoff smoke 1개를 유지한다.
- `auth-session.fullstack.spec.ts`는 remember-off browser-session cookie, access 만료 후 renewal rotation, logout 후 unauthenticated 수렴을 실제 BFF/API/DB로 확인한다.
- Home 상태 matrix는 테스트 전용 `AuthSession`을 DB에 직접 seed해 로그인 rate-limit과 분리하고, 실제 API/BFF/DB/Web render를 함께 확인한다.
- seed mode 전환은 `apps/web/e2e/support/home-e2e-seed.ts`가 소유한다. spec 종료 시 `HOME_E2E_SEED_MODE=current-matching`으로 복원한다.
- `/login` UI locator는 desktop help panel 문구와 label ambiguity가 생기지 않도록 `getByRole('textbox', { name: '이메일' })`처럼 role/name 기준으로 고정한다.
- 기본 DB URL은 `postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public`이다.
  다른 DB를 쓰려면 `HOME_E2E_DATABASE_URL`을 명시한다.
- 기본 API/Web URL은 각각 `http://127.0.0.1:4000`, `http://127.0.0.1:3000`이다.
  필요하면 `API_URL`, `PLAYWRIGHT_BASE_URL`로 override한다.

### Seed accounts / mode matrix

| 시나리오                                | email                               | password   |
| --------------------------------------- | ----------------------------------- | ---------- |
| Home dashboard 기준 사용자              | `home-e2e-viewer@kangwon.ac.kr`     | `1q2w3e4r` |
| 과거 시즌 등록 이력만 있는 사용자       | `home-e2e-history@kangwon.ac.kr`    | `1q2w3e4r` |
| 시즌 오픈 수동 검증 후보                | `home-e2e-open@kangwon.ac.kr`       | `1q2w3e4r` |
| 시즌 마감 정리 수동 검증 후보           | `home-e2e-postmatch@kangwon.ac.kr`  | `1q2w3e4r` |
| season profile complete + 기숙사 미선택 | `home-e2e-incomplete@kangwon.ac.kr` | `1q2w3e4r` |
| 비운영 캠퍼스 fail-closed               | `test-samcheok-m@kangwon.ac.kr`     | `1q2w3e4r` |

`home-e2e-viewer`는 현재 시즌 matching window, 다산관 배정, active match, 받은 pending request, unread chat count를 함께 검증하도록 seed된다.
`HOME_E2E_SEED_MODE`는 `current-matching`, `future-preview`, `season-open`, `post-match`를 지원한다.
Playwright matrix는 mode별로 seed를 reset하고, 직접 로그인 smoke를 제외한 케이스는 test-only session cookie를 사용한다.
Playwright auth storage state는 `apps/web/playwright/.auth/`에 생성되며 git에 올리지 않는다.

## Boundary

- Web-only smoke는 PR 기본 Web gate 후보로 가볍게 유지한다.
- Full-stack smoke는 API/DB/Docker 의존성이 있으므로 local/manual 또는 별도 scheduled/label CI 후보로 둔다.
- Full-stack/dev server 실행 후 `apps/web/next-env.d.ts`가 `.next/dev/types`로 바뀔 수 있다. 이 generated drift는 commit하지 않고 원복한다.
- Home UI state를 빠르게 시각 비교하는 용도는 Storybook/visual workshop에서 다루고, 실제 auth/API/DB 정합성은 full-stack smoke가 담당한다.
