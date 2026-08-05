# Troubleshooting

현재 repository에서 재현 가능한 개발·테스트 문제만 유지합니다. 새 문서는
[TEMPLATE.md](./TEMPLATE.md)를 사용하고 current owner와 검증 명령을 반드시 기록합니다.

| 영역     | 문서                                                                                                               | 책임                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Database | [Prisma 7 seed와 generated client 경계](./database/prisma-7-seed-config-and-generated-client.md)                   | Prisma CLI seed 설정과 custom generated client 환경의 독립 실행 기준 |
| Frontend | [이메일 인증 요청 identity와 stale response](./frontend/email-verification-request-identity-and-stale-response.md) | 입력 이메일과 실제 요청 subject를 분리하고 늦은 응답을 무시하는 기준 |
| Tooling  | [TypeScript 6 `baseUrl` 제거](./tooling/typescript-6-baseurl-deprecation-and-api-tsconfig.md)                      | API NodeNext module resolution을 불필요한 alias 없이 유지하는 기준   |
| Tooling  | [Turbopack·Tailwind stale cache](./tooling/turbopack-tailwindcss-stale-cache.md)                                   | dependency 누락과 cache/root 추론 오류를 구분하는 절차               |
| Tooling  | [Vitest Proxy module mock hang](./tooling/vitest-proxy-module-mock-hang.md)                                        | catch-all Proxy mock의 thenable 충돌과 명시적 mock 규칙              |

## 유지 기준

- 현재 지원 version과 구현에서도 재현 가능해야 합니다.
- 증상, 구조적 원인, 해결, 회귀 검증이 모두 있어야 합니다.
- 제품 정책, 운영 runbook, owner README와 같은 내용을 중복 소유하지 않습니다.
- Sprint·Phase 이름, 개인 장비와 절대 경로를 장기 기준으로 남기지 않습니다.
