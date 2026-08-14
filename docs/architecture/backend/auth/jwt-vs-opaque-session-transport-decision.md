# Opaque session transport 결정

**상태**: Accepted / current

## 결정

사용자 인증 transport는 JWT offline verification 대신 DB-backed opaque access/session token을 사용한다.
클라이언트에는 random token만 전달하고 DB에는 hash만 저장한다.

## 선택 근거

- 계정 삭제, password 변경, logout-all, session reuse 탐지를 즉시 반영해야 한다.
- Protected request가 결국 DB session state를 확인하므로 JWT claim을 별도로 유지할 이점이 작다.
- Session revoke와 renewal rotation의 source of truth를 PostgreSQL 한 곳에 유지할 수 있다.
- 아직 측정되지 않은 병목을 이유로 Redis/cache를 인증 authority에 선행 도입하지 않는다.

## 현재 경계

| 책임                       | 현재 owner                                   |
| -------------------------- | -------------------------------------------- |
| opaque token 생성·hash     | `apps/api/src/auth/sessions/opaque-token.ts` |
| session issue/renew/revoke | `apps/api/src/auth/sessions/`                |
| route guard와 token 추출   | `apps/api/src/auth/access/`                  |
| actor context projection   | `apps/api/src/auth/application/`             |
| cookie/BFF transport       | `apps/web/src/auth/bff/`                     |
| TTL·공개 정책              | `docs/policies/account-authentication.md`    |

## 불변식

- Raw access/renewal token은 영속화하거나 log에 남기지 않는다.
- Access token 만료와 session family absolute TTL은 별도 의미를 가진다.
- Renewal은 rotation과 reuse detection을 유지한다.
- Redis는 authority가 아니며, 실제 point lookup 병목이 관측될 때만 보조 계층으로 별도 결정한다.
