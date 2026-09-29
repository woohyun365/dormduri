# Troubleshooting

현재 repository에서 재현 가능한 개발·테스트 문제만 유지합니다. 새 문서는
[TEMPLATE.md](./TEMPLATE.md)를 사용하고 current owner와 검증 명령을 반드시 기록합니다.

| 영역     | 문서                                                                                                               | 책임                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| CI       | [Repository policy pnpm setup timeout](./ci/repository-policy-pnpm-setup-timeout.md)                               | pnpm bootstrap 지연과 실제 repository-policy 실패의 구분·복구                                     |
| CI       | [Web ESLint Node heap OOM](./ci/web-eslint-node-heap-oom.md)                                                       | 지원선 변경과 ESLint 회귀를 구분하고 static step heap을 제한적으로 보강                           |
| Database | [Prisma 7 seed와 generated client 경계](./database/prisma-7-seed-config-and-generated-client.md)                   | Prisma CLI seed 설정과 custom generated client 환경의 독립 실행 기준                              |
| Database | [OrbStack PostgreSQL sleep 이후 clock drift](./database/orbstack-postgresql-clock-drift-after-sleep.md)            | host·VM·DB clock owner 판별과 time-sensitive DB suite 복구                                        |
| Frontend | [이메일 인증 요청 identity와 stale response](./frontend/email-verification-request-identity-and-stale-response.md) | 입력 이메일과 실제 요청 subject를 분리하고 늦은 응답을 무시하는 기준                              |
| Tooling  | [TypeScript 6 `baseUrl` 제거](./tooling/typescript-6-baseurl-deprecation-and-api-tsconfig.md)                      | API NodeNext module resolution을 불필요한 alias 없이 유지하는 기준                                |
| Tooling  | [pnpm dependency update timeout](./tooling/pnpm-dependency-update-job-timeout.md)                                  | Provider queue·approval·root pnpm 계산 timeout의 구분과 복구                                      |
| Tooling  | [pnpm legacy deploy active checkout](./tooling/pnpm-legacy-deploy-active-checkout.md)                              | production-only deploy 검증의 격리 경계와 workspace 복구                                          |
| Tooling  | [pnpm store index와 postinstall 무결성](./tooling/pnpm-store-index-and-postinstall-integrity.md)                   | SQLite 접근·postinstall 변화·실제 store 손상의 구분                                               |
| Tooling  | [Mend Renovate pnpm 11 OOM](./tooling/renovate-pnpm11-hosted-oom.md)                                               | Hosted lockfile kernel OOM 판별, memory guard와 exact fallback                                    |
| Tooling  | [Turbopack·Tailwind stale cache](./tooling/turbopack-tailwindcss-stale-cache.md)                                   | dependency 누락과 cache/root 추론 오류를 구분하는 절차                                            |
| Tooling  | [Vitest Proxy module mock hang](./tooling/vitest-proxy-module-mock-hang.md)                                        | catch-all Proxy mock의 thenable 충돌과 명시적 mock 규칙                                           |
| Tooling  | [Subagent thread limit reached](./tooling/agent-thread-limit-reached.md)                                           | 완료/종료/슬롯 반환 구분과 Parent의 bounded cleanup·복구                                          |
| Tooling  | [Claude hook 장애와 완료 거부](./tooling/claude-native-hook-failure-and-completion-refusal.md)                     | hook 장애 시 실행은 진행되고 완료 판정만 거부되는 보장 범위                                       |
| Tooling  | [Claude native 완료 관측 누락](./tooling/claude-native-completion-observation-missing.md)                          | task 기록으로 알림 전 호출·긴 transcript·정산 실패 사유를 구분                                    |
| Tooling  | [Claude native Parent 동시 쓰기](./tooling/claude-native-parent-concurrent-write.md)                               | 등록~정산 중 write 범위 밖 변경의 `unattributable-change` 거부와 Parent 쓰기 금지                 |
| Tooling  | [Claude native 등록·리뷰 거부](./tooling/claude-native-registration-and-review-rejections.md)                      | 등록 수명·intake 분류·runner 증거 누락과 builder 연결 거부(미정산·hook 미관측·재개된 리뷰)의 해소 |
| Tooling  | [Claude 안에서 live 세션 실행](./tooling/claude-live-session-from-claude-session.md)                               | 환경 상속 없이 owner tmux로 새 auto 세션을 재현하는 절차                                          |
| Tooling  | [Claude auto classifier no verdict](./tooling/claude-auto-classifier-no-verdict.md)                                | 서버 판정 누락·설정 자가 수정 거부의 구분과 개인 allow 규칙·compact 기준                          |

## 유지 기준

- 현재 지원 version과 구현에서도 재현 가능해야 합니다.
- 증상, 구조적 원인, 해결, 회귀 검증이 모두 있어야 합니다.
- 제품 정책, 운영 runbook, owner README와 같은 내용을 중복 소유하지 않습니다.
- Sprint·Phase 이름, 개인 장비와 절대 경로를 장기 기준으로 남기지 않습니다.
