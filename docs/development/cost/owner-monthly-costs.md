# Owner monthly costs

## 책임

이 문서는 KNU Roommate를 개발·운영하는 1인 owner의 알려진 월별 비용과 미래 비용 분류를 유지합니다. 전체 현금 지출을
모두 프로젝트 비용으로 과장하지 않고, 프로젝트가 없더라도 지불했을 personal baseline을 제외한 증분을
`Project-attributable`로 표시합니다.

## Current monthly summary

| Metric                               | USD/month | 의미                                                   |
| ------------------------------------ | --------: | ------------------------------------------------------ |
| Known recurring gross cash           |  **$104** | GitHub Pro $4 + ChatGPT Pro $100                       |
| Personal baseline                    |   **$20** | 프로젝트 전부터 생활용으로 사용하던 ChatGPT Plus 비용  |
| Project-attributable recurring delta |   **$84** | GitHub Pro $4 + ChatGPT upgrade delta $80              |
| Current usage-based net              |    **$0** | 2026-08 GitHub Actions included-use discount 적용 결과 |

USD/KRW 환산은 결제일 환율·세금 evidence가 없으면 기록하지 않습니다.

## Cost ledger

| Effective / period       | Lifecycle | Category            | Provider / product               | Billing model       |                Gross | Personal baseline | Project-attributable | Usage / discount / net                                                 | Currency | Evidence                                                               | ReviewedAt |
| ------------------------ | --------- | ------------------- | -------------------------------- | ------------------- | -------------------: | ----------------: | -------------------: | ---------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- | ---------- |
| 2026-08-20               | current   | Repository / CI     | GitHub Pro                       | fixed monthly       |                   $4 |                $0 |                   $4 | Actions included 3,000 min; owner UI effective shared storage 2GB      | USD      | GitHub Billing UI, Pro plan                                            | 2026-08-20 |
| 2026-07-31               | current   | AI development tool | ChatGPT Pro                      | fixed monthly       |                 $100 |               $20 |                  $80 | 기존 ChatGPT Plus $20은 생활용 baseline으로 제외                       | USD      | Owner subscription UI                                                  | 2026-08-20 |
| 2026-08                  | current   | CI usage            | GitHub Actions                   | usage-based         | $14.08 service value |                $0 |               $0 net | Gross $14.08 / included discount $14.08 / net $0 / Free 2,000 min used | USD      | GitHub Billing UI                                                      | 2026-08-20 |
| Release target 결정 시   | future    | User runtime        | Lightsail user application       | fixed + transfer    |                  TBD |                $0 |                  TBD | User Web/API/observability 4GB target evidence 이후 확정               | USD      | `docs/architecture/platform/production-runtime-topology.md`            | 2026-08-20 |
| Release target 결정 시   | future    | Database            | AWS RDS PostgreSQL               | fixed + storage/I/O |                  TBD |                $0 |                  TBD | 실제 region, instance, storage, backup retention 이후 확정             | USD      | `infra/runbooks/release/components/infrastructure-target/readiness.md` | 2026-08-20 |
| BackOffice 출시 시       | future    | BackOffice runtime  | Lightsail BackOffice             | fixed + transfer    |                  TBD |                $0 |                  TBD | User product와 분리된 2GB target 이후 확정                             | USD      | `infra/runbooks/release/components/backoffice/readiness.md`            | 2026-08-20 |
| Release target 결정 시   | future    | Domain / email      | Domain, DNS, transactional email | fixed + usage       |                  TBD |                $0 |                  TBD | canonical host와 provider 승인 이후 확정                               | USD      | `docs/development/future-production-deployment-inputs.md`              | 2026-08-20 |
| Provider 도입 시         | optional  | Error monitoring    | Sentry managed provider          | fixed + usage       |                  TBD |                $0 |                  TBD | account region, retention, sampling, quota 승인 이후 확정              | USD      | `infra/runbooks/release/components/web-sentry/readiness.md`            | 2026-08-20 |
| Included minutes 초과 시 | optional  | CI overage          | GitHub Actions Linux             | usage-based         |                  TBD |                $0 |                  TBD | Gross/discount/net과 billed minutes를 월별 API/UI evidence로 갱신      | USD      | GitHub Billing UI/API                                                  | 2026-08-20 |
| Allowance 초과 시        | optional  | CI storage          | Actions artifacts / cache        | usage-based         |                  TBD |                $0 |                  TBD | Artifact/shared allowance와 10GB cache를 분리해 측정                   | USD      | GitHub Actions usage API                                               | 2026-08-20 |

`Gross`가 service value인 usage row는 실제 cash와 다를 수 있습니다. 예를 들어 2026-08 Actions `$14.08`은 같은 금액의
included-use discount가 적용되어 net `$0`이며, 실제 recurring cash `$104`에 더하지 않습니다.

## CI list-price measurement

2026-08-26 기준 CI performance collector는 [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)의
표준 Linux 2-core rate `$0.006/min`을 job별 rounded minutes에 적용해 **할인 전 gross estimate**를 계산합니다.
Frozen-input full PR 두 개의 추정 gross는 각각 `$0.150`, `$0.180`입니다.
이 값은 월별 Billing UI의 discount/net evidence가 아니므로 위 monthly summary에 실제 지출로 합산하지 않습니다.

현재 GitHub Pro artifact allowance는 owner UI의 effective 2GB evidence와 공식 문서의 1GB reference가 다릅니다. 현재 active
artifact는 약 7.4MiB이고 cache는 별도 10GiB 중 약 69.6%이므로 즉시 과금 근거는 없지만, 다음 Billing UI review에서 effective
allowance를 다시 확인합니다. 현재 `gh` credential에는 Plan-read와 `read:packages`가 없으므로 credential을 자동 확대하거나
Packages 사용량을 0으로 추측하지 않습니다.

## Monthly update procedure

1. GitHub/AI/provider Billing UI에서 current plan, gross, discount, net, usage period를 확인합니다.
2. Personal billing API를 사용할 때는 별도 fine-grained `Plan: read` credential만 사용하고 기존 broad `gh` token을 자동
   확장하지 않습니다. 권한이 없으면 UI 또는 redacted export를 evidence로 사용합니다.
3. Fixed subscription의 시작·종료·upgrade/downgrade 날짜와 project-attributable baseline을 갱신합니다.
4. Actions는 workflow wall이 아니라 job별 billed minutes와 gross/discount/net을 기록합니다.
5. Future 항목은 provider·region·instance·retention이 승인되기 전까지 `TBD`로 둡니다.
6. 월별 합계는 gross cash, personal baseline, project-attributable delta, usage-based net을 각각 계산합니다.
7. Card number, invoice ID, billing address, tax identifier, credential value, raw billing export는 commit하지 않습니다.

## Revisit triggers

- GitHub/ChatGPT plan 또는 가격 변경
- GitHub Actions included minutes, artifact/shared storage, cache 정책 변경
- 실제 production provider·instance·region 결정
- BackOffice 출시 또는 user/backoffice topology 변경
- Sentry/domain/email 같은 optional provider 활성화
- KRW 환산과 세금 포함 총액이 실제 운영 예산에 필요해짐
