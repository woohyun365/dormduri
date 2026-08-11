# Infrastructure target release readiness

## 책임

이 문서는 실제 hosting target이 결정될 때 필요한 사용자 입력과 검증 순서를 소유한다. 실제 값과
결과는 [infrastructure-target-release-evidence.md](./infrastructure-target-release-evidence.md)에 기록한다.
현재 상태는 `PENDING_TARGET`이며 실패가 아니다.

## 초기 권장 후보와 미결정 경계

Repository rehearsal은 전용 single-tenant User App 4GiB/2CPU host, managed PostgreSQL 18,
private observability stack, nginx ingress를 기준으로 한다. BackOffice 출시 시에는 8GiB 단일
host로 합치지 않고 별도 2GiB/2CPU BackOffice host를 추가한다. 선택 근거와 장기 경계는
[`production-runtime-topology.md`](../../../../docs/architecture/platform/production-runtime-topology.md)가
소유한다. 이 값은 승인된 planning input이며 실제 provider, region, instance identifier와 가격은 release
시 다시 확인한다.

### User App 4GiB resource 시작값

| Container    | CPU upper bound | Reservation |   Limit |
| ------------ | --------------: | ----------: | ------: |
| nginx        |             0.2 |       32MiB |   96MiB |
| Web          |             0.5 |      160MiB |  320MiB |
| API          |             1.5 |      512MiB | 1408MiB |
| Prometheus   |            0.35 |      128MiB |  256MiB |
| Loki         |            0.35 |      160MiB |  320MiB |
| Alloy        |            0.15 |       80MiB |  160MiB |
| Alertmanager |             0.1 |       48MiB |   96MiB |
| Grafana      |             0.2 |      112MiB |  320MiB |

Limit 합계는 2976MiB이며 4GiB host에서 OS, Docker, filesystem cache와 순간 증가를 위해 1120MiB를
남긴다. CPU upper bound 합계는 host CPU를 초과할 수 있으므로 보장값이 아니라 container burst 제한이다.
실제 host CPU, memory, latency와 disk evidence가 최종 authority다.

### BackOffice 2GiB resource 시작값

| Container      | CPU upper bound | Reservation |  Limit |
| -------------- | --------------: | ----------: | -----: |
| admin nginx    |            0.15 |       32MiB |  96MiB |
| BackOffice Web |            0.35 |      128MiB | 256MiB |
| BackOffice API |             0.5 |      256MiB | 512MiB |
| Alloy          |             0.1 |       48MiB |  96MiB |

Limit 합계는 960MiB이며 약 1088MiB headroom을 남긴다. BackOffice가 실제 구현되면 query pool,
admin audit와 관측량을 포함한 별도 rehearsal로 이 시작값을 교체한다.

### 월 비용 planning input

2026-07-27 공개 AWS 가격과 planning 환율 `1 USD = 1,400 KRW`를 사용한 현재 입력이다.

| 단계               | 구성                                                                     |     기본 월 비용 | 예비비 포함 planning budget |
| ------------------ | ------------------------------------------------------------------------ | ---------------: | --------------------------: |
| BackOffice 출시 전 | Lightsail User App 4GB $24 + RDS compute $18.25 + gp3 20~30GB $2.62~3.93 | **$44.87~46.18** |                  **$50~65** |
| BackOffice 출시 후 | 위 구성 + Lightsail BackOffice 2GB $12                                   | **$56.87~58.18** |                  **$65~80** |

원화 기준 기본 비용은 출시 전 약 6.3만~6.5만원, 출시 후 약 8.0만~8.2만원이다. 예비비 포함 범위는
각각 약 7만~9.1만원, 약 9.1만~11.2만원이다.

EC2 대안은 서울 On-Demand `t4g.medium` 4GiB $0.0416/hour와 `t4g.small` 2GiB
$0.0208/hour를 기준으로 compute 약 $45.55/month다. EBS, public IPv4와 RDS를 더한 단순 baseline은
약 $77~79/month이며 NAT Gateway, ALB, VPC endpoint, transfer, CloudWatch와 세금은 포함하지
않는다. `t4g` 선택 시 ARM64 image와 native dependency evidence가 필요하다.

가격 근거:

- Lightsail bundle: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html
- Lightsail CPU baseline: https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html
- RDS PostgreSQL: https://aws.amazon.com/rds/postgresql/pricing/
- EC2 Seoul Price List: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-northeast-2/index.json
- RDS Seoul Price List: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-northeast-2/index.json

가격, 환율, backup, CPU credit와 provider 부가비용은 고정 정책이 아니다. Release 담당자는 AWS
Pricing Calculator와 실제 billing 조건으로 갱신하고 evidence에 계산 시점과 owner를 기록한다.

### Capacity evidence 입력

- Argon2id 19MiB와 auth admission 기준은
  `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`의 완료 evidence를 입력으로 사용한다.
- Full-stack resource와 장애 격리는
  [`full-stack-local-infrastructure.md`](../../rehearsal/full-stack-local-infrastructure.md)를 재실행한다.
- Local 결과는 managed PostgreSQL latency, provider network와 실제 CPU credit을 증명하지 않는다.
- Release target에서 API/Web RSS, latency, disk, RDS connection과 burst credit을 다시 확인한다.

## 사용자 준비물

### Hosting과 network

- provider, region, availability 요구, 월 예산
- User App Web/API/nginx/observability의 4GiB 배치와 resource budget
- BackOffice가 출시 범위이면 별도 2GiB host, admin ingress, Web/API resource budget
- SSH/operator 접근 경계, firewall/security group, private network
- managed PostgreSQL 18 endpoint, subnet, TLS, backup/PITR, connection budget

### Registry와 artifact

- image registry와 retention
- publish principal, runtime pull principal, 최소 권한과 rotation owner
- release SHA에 연결된 immutable image digest
- SBOM와 provenance/attestation 생성·검증 위치

### DNS, TLS, ingress

- canonical Web/API host와 DNS owner
- certificate 발급, 자동 갱신, 만료 alert owner
- nginx 또는 선택한 reverse proxy topology
- trusted proxy hop, forwarded header, secure cookie, CORS, realtime origin 경계

### Observability durability

- Grafana operator 접근 경로와 public port 차단
- Prometheus/Loki/Alertmanager/Grafana volume identifier와 disk budget
- volume별 backup·restore 또는 허용 손실 결정
- RPO/RTO, retention, disk/inode alert owner와 route

## 검증 순서

1. `pnpm infra:check`와 image inventory 검증을 같은 release SHA에서 통과시킨다.
2. Registry에 publish한 digest가 CI provenance와 일치하고 target이 digest로 pull하는지 확인한다.
3. Private DB/network와 최소 ingress만 열고 관측 port는 public internet에 노출하지 않는다.
4. TLS chain, 갱신 경로, trusted proxy, cookie, CORS, realtime origin을 실제 host에서 smoke한다.
5. Migration, role grant, DB credential, backup/restore drill을 app rollout 전에 실행한다.
6. API/Web/nginx/observability를 resource budget 안에서 구동하고 health, metrics guard, logs, alert를 확인한다.
7. Previous safe digest와 rollback 절차를 target에서 rehearsal한다.
8. 결과를 target evidence에 기록하고 aggregate evidence에 링크한다.

BackOffice가 출시 범위이면
[`backoffice-deployment-readiness.md`](./backoffice-deployment-readiness.md)를 추가로 완료하고 User
App과 독립적으로 rollout·rollback·장애 격리를 rehearsal한다.

## 중단 조건

- provider/region/network owner 또는 월 예산이 정해지지 않았다면 `PENDING_TARGET`로 멈춘다.
- mutable tag만 있고 digest/attestation 연결을 확인할 수 없으면 `FAIL`이다.
- DB 또는 관측 port가 public internet에 직접 노출되면 `FAIL`이다.
- TLS 갱신, backup/restore, rollback owner가 없으면 release 실행을 멈춘다.
- Secret 값을 evidence나 artifact에 복사해야만 검증할 수 있는 절차는 채택하지 않는다.
