# Production environment

이 문서는 돔두리의 지금 적용한 production 운영 환경을 resource 종류와 상태로 설명합니다. Release evidence가 아니며 실행 결과,
operator, 수집 시각은 적지 않습니다. 식별자는 [식별자 규칙](./README.md#식별자-규칙)을 따르고, 기록하지 않는 값과 두 목록 밖
resource 이름은 "Owner console"로 적습니다. 비용은 [서버 비용](./server-costs.md)이 소유합니다.

## 지금 상태

- 단계: Web 단계 배포 준비. Host·도메인·TLS·메일은 준비됐고, Web CD와 첫 Web 배포는 아직 하지 않았습니다.
- Host는 점검 mode(nginx가 503 응답)입니다. Web image는 배포되지 않았고 host에 현재·이전 배포 기록이 없습니다.
- 외부 가용성 alarm은 점검 mode의 503 때문에 ALARM 상태로 켜져 있고, 첫 배포 뒤 OK가 되는지 확인합니다.
- API, managed PostgreSQL, 관측 stack(로그·지표 수집)은 없습니다. 이후 단계에서 정할 입력은 [아래 절](#이후-단계에서-정할-입력)에
  있습니다.
- 저장소에는 CI만 있습니다. Web CD workflow와 Web 단계 배포 구성은 Web CD 작업이 추가합니다.

## 지금 구성

| 영역        | 지금 구성                                                                                                                                                                                                                                                                                                  | 확인하는 곳(Owner console 메뉴)                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Region      | 서울 `ap-northeast-2`. 외부 가용성 alarm과 그 알림 SNS 주제는 health check 지표가 있는 `us-east-1`                                                                                                                                                                                                         | 각 console 오른쪽 위 Region 선택                                                      |
| 도메인·DNS  | `dormduri.com`을 Route 53에서 등록(자동 갱신, transfer lock). Public hosted zone 하나에 apex·`www` A record(host static IP), CAA, SES DKIM record. Canonical Web host는 apex이고 `www`는 apex로 redirect                                                                                                   | Route 53 > Registered domains, Hosted zones                                           |
| Host        | Lightsail instance 하나(서울, Ubuntu 24.04 LTS, Linux 4 GB bundle: 2 vCPU·80 GB SSD·4 TB 전송). Static IP 하나 연결, firewall은 80·443만 열림(22 닫힘), 수동 snapshot 하나. Instance·static IP·snapshot 이름은 Owner console                                                                               | Lightsail > Instances, Networking, Snapshots                                          |
| 배포 전달   | Host를 Systems Manager hybrid managed node로 등록하고 배포 대상 tag로 지정. Command document `dormduri-web-deploy` 하나(동작 `deploy`·`rollback`·`maintenance`, digest 파라미터, host lock). 배포는 SSH를 쓰지 않음                                                                                        | Systems Manager > Fleet Manager, Documents                                            |
| 권한        | GitHub OIDC identity provider, host용 role, GitHub publish role·deploy role. Long-lived access key 없음. 이름은 Owner console                                                                                                                                                                              | IAM > Identity providers, Roles                                                       |
| Registry    | ECR 비공개 repository `dormduri/web`·`dormduri/ingress`(서울). Rehearsal image는 지움                                                                                                                                                                                                                      | Amazon ECR > Private registry > Repositories                                          |
| TLS         | Let's Encrypt 인증서 하나(apex·`www`), certbot의 HTTP-01 webroot 갱신, CAA, HSTS                                                                                                                                                                                                                           | 공개 HTTPS 응답의 인증서 만료일                                                       |
| 외부 가용성 | Route 53 HTTPS health check 하나(apex `/`, SNI) → `us-east-1` CloudWatch alarm 하나 → SNS 주제의 email 구독. 이름과 받는 주소는 Owner console                                                                                                                                                              | Route 53 > Health checks, CloudWatch(`us-east-1`) > Alarms, SNS(`us-east-1`) > Topics |
| 메일        | SES(서울) domain identity `dormduri.com`(Easy DKIM), 구성 세트 `dormduri-production`과 SNS event destination(BOUNCE·COMPLAINT·DELIVERY_DELAY·REJECT·RENDERING_FAILURE) → SNS 주제의 email 구독. Event destination·주제 이름, 주제 region과 받는 주소는 Owner console. 계정은 sandbox, 요금 plan Essentials | Amazon SES > Identities, Configuration sets, Account dashboard, Amazon SNS > Topics   |
| GitHub      | Environment `production`(required reviewer), publish role ARN repository secret, deploy role ARN environment secret                                                                                                                                                                                        | GitHub 저장소 Settings > Environments, Secrets and variables > Actions                |

- 운영자의 host 접근은 Systems Manager Session Manager를 기본으로 씁니다. SSH는 break-glass로만 쓰고, Owner가 Lightsail browser
  SSH 허용 규칙을 잠시 켠 뒤 끝나면 지웁니다(22는 평소 닫힘).
- SES event destination에는 받는 사람 주소가 담기는 Deliveries를 넣지 않았습니다.
- Sandbox 해제(production access)는 공개 Landing URL이 생긴 뒤 요청합니다.

## 계정과 비용 알림

- AWS Organizations와 IAM Identity Center(서울 organization instance)를 씁니다. Root와 Identity Center 사용자는 MFA를 켭니다.
- 사람과 agent는 Identity Center의 단기 credential만 씁니다. Agent는 읽기 전용 permission set을 씁니다. Long-lived access key를
  만들지 않고, GitHub workflow가 AWS를 쓸 때는 OIDC로 받은 단기 role credential(publish role·deploy role)만 씁니다.
- AWS Budgets에 월 $60 budget 하나와 알림 넷(실제 비용 50%·80%·100%, 예측 비용 100%)을 둡니다. 알림을 받으면
  [서버 비용](./server-costs.md#청구서-확인)의 확인 절차를 따릅니다.
- 비용이 드는 resource 생성·구매·삭제와 권한 부여는 Owner가 console에서 하거나 행동마다 Owner 승인을 받습니다. 부하 test나 관측
  long run처럼 일시적인 resource는 종료 시간을 정하고 정리를 확인합니다.
- 확인하는 곳: AWS Organizations, IAM Identity Center > Users, Billing and Cost Management > Budgets

## 이후 단계에서 정할 입력

지금 Web 단계에서 정하지 않은 입력입니다. 각 단계의 준비 작업이 정하고, 정해지면 이 문서의 지금 구성 표로 옮깁니다.

| 입력                 | 정할 내용                                                                                                                                                                                | 관련 문서                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| DB change ownership  | migration principal과 실행 위치, app rollout보다 먼저 migration·role grant를 적용하는 주체, backup/PITR 확인과 restore 승인 owner, schema change 실패 때 write 차단과 복구 의사결정 절차 | [RDS setup checklist](../../infra/aws/rds-setup-checklist.md), [DB operator scripts](../../infra/db/README.md) |
| API public host      | API를 공개할 host, CORS·realtime origin·cookie 범위 최종값, health·readiness·metrics의 공개·비공개 경계                                                                                  | [Production release readiness](../../infra/runbooks/release/production-release-readiness.md)                   |
| Network와 principal  | public ingress, private runtime, managed PostgreSQL 사이 network 경계, deployment principal과 runtime principal의 권한 분리                                                              | [Infrastructure target readiness](../../infra/runbooks/release/components/infrastructure-target/readiness.md)  |
| Secret 전달          | API·DB secret의 origin, runtime 전달 방식과 rotation 절차                                                                                                                                | [Secrets Manager checklist](../../infra/aws/secrets-manager-checklist.md)                                      |
| 관측 stack           | 로그·지표 수집 stack의 위치와 접근 경로, 경보 채널, Web Sentry 사용 여부                                                                                                                 | [Observability topology](../architecture/platform/observability-topology.md)                                   |
| API release·rollback | API 단계의 rollout 방식, readiness 실패 때 중단 기준, release·rollback SLO와 evidence 보존 기간                                                                                          | [Release rollback](../../infra/runbooks/incidents/release-rollback.md)                                         |
| BackOffice           | 사용자 제품과 분리된 host·배포·권한 경계                                                                                                                                                 | [Production runtime topology](../architecture/platform/production-runtime-topology.md)                         |

## 이 문서를 고치는 때

- Resource를 만들거나 지우거나 상태를 바꾸는 작업은 같은 PR이나 바로 뒤 문서 PR에서 이 문서를 고칩니다. 비용 항목이 바뀌면
  [서버 비용](./server-costs.md)도 함께 고칩니다.
- 배포·rollback·점검 mode 절차는 이 문서에 쓰지 않고 [`infra/runbooks/`](../../infra/runbooks/README.md)에 둡니다.
