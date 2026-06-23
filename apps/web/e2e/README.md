# Web Playwright E2E

Web Playwright는 두 lane으로 분리한다.

## Web-only smoke

```bash
pnpm web:e2e
```

- `apps/web/playwright.config.ts`를 사용한다.
- production-like standalone Web server를 띄우고 `API_URL=http://127.0.0.1:9`로 고정한다.
- 목적은 public route와 unauthenticated protected-route redirect를 API/DB 없이 확인하는 것이다.

## Full-stack `/main` smoke

```bash
pnpm web:e2e:fullstack
# 또는
pnpm --dir apps/web exec playwright test -c playwright.fullstack.config.ts
```

- `apps/web/playwright.fullstack.config.ts`를 사용한다.
- local Postgres를 `docker-compose.dev.yml`로 띄우고, Prisma schema push/seed 후 API dev server와 Web dev server를 함께 실행한다.
- 기본 DB URL은 `postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public`이다.
  다른 DB를 쓰려면 `HOME_E2E_DATABASE_URL`을 명시한다.
- 기본 API/Web URL은 각각 `http://127.0.0.1:4000`, `http://127.0.0.1:3000`이다.
  필요하면 `API_URL`, `PLAYWRIGHT_BASE_URL`로 override한다.

### Seed accounts

| 시나리오                   | email                           | password   |
| -------------------------- | ------------------------------- | ---------- |
| Home dashboard 기준 사용자 | `home-e2e-viewer@kangwon.ac.kr` | `1q2w3e4r` |
| 비운영 캠퍼스 fail-closed  | `test-samcheok-m@kangwon.ac.kr` | `1q2w3e4r` |

`home-e2e-viewer`는 현재 시즌 matching window, 다산관 배정, active match, 받은 pending request, unread chat count를 함께 검증하도록 seed된다.
Playwright auth storage state는 `apps/web/playwright/.auth/`에 생성되며 git에 올리지 않는다.

## Boundary

- Web-only smoke는 PR 기본 Web gate 후보로 가볍게 유지한다.
- Full-stack smoke는 API/DB/Docker 의존성이 있으므로 local/manual 또는 별도 scheduled/label CI 후보로 둔다.
- Home UI state를 빠르게 시각 비교하는 용도는 Storybook/visual workshop에서 다루고, 실제 auth/API/DB 정합성은 full-stack smoke가 담당한다.
