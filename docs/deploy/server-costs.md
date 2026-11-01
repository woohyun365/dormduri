# Server costs

이 문서는 [운영 환경](./production-environment.md)이 쓰는 서버·도메인·메일 비용(AWS)을 소유합니다. 항목마다 공식 가격표의 단가
근거와 실제 월 금액을 두고, 청구서를 확인하는 주기를 정합니다. 개인 구독과 개발 도구 비용은 다루지 않습니다. 이후 단계(managed
PostgreSQL, API, BackOffice)의 planning budget은
[Infrastructure target readiness](../../infra/runbooks/release/components/infrastructure-target/readiness.md)가 소유합니다.

- 마지막 확인일: 2026-10-31(공식 단가). 실제 월 금액 칸은 행마다 청구서 확인일(첫 청구서 전에는 확인 예정일)을 적습니다.
- 다시 볼 때: 월 1회 [청구서 확인](#청구서-확인), Budgets 알림, 공식 단가 변경 공지, resource 추가·삭제, 그리고
  [날짜 snapshot 재확인](../README.md#날짜-snapshot-재확인)의 월 1회 점검 때.

## 기준

- 금액은 USD이고 세금은 뺍니다. 단가는 공식 가격표 값이고 청구 금액이 아닙니다.
- 공식 단가는 위 마지막 확인일에 공식 가격 페이지와 AWS Price List API(같은 날 받은 서비스별 가격 파일)로 확인했습니다.
- 실제 월 금액은 AWS 청구서(Billing and Cost Management > Bills)가 원본입니다. 첫 청구서가 나오기 전에는 금액 대신 확인
  예정일을 둡니다.
- 2026-10월 청구서는 resource를 만든 2026-10-27~29부터 월말까지의 일부 기간입니다. 첫 전체 달은 2026-11월 사용분입니다.

## 항목

| 항목                             | 지금 쓰는 양                                                                                                | 공식 단가(2026-10-31 확인)                                                                                                                          | 근거                                                                                      | 실제 월 금액                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Lightsail instance(서울)         | Linux 4 GB bundle 하나                                                                                      | $24/월(시간 단가 $0.03225, 월 상한). 2 vCPU·80 GB SSD·4 TB 전송 포함                                                                                | [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)                            | 첫 청구서 확인 예정일 2026-11-05 |
| Lightsail static IP              | 하나(instance에 연결)                                                                                       | 연결 중에는 bundle에 포함. 연결되지 않은 static IP는 첫 1시간 뒤 $0.005/시간                                                                        | [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), AWS Price List            | 첫 청구서 확인 예정일 2026-11-05 |
| Lightsail 수동 snapshot          | 하나                                                                                                        | $0.05/GB-월                                                                                                                                         | [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)                            | 첫 청구서 확인 예정일 2026-11-05 |
| Lightsail 데이터 전송            | bundle 포함량 안                                                                                            | 포함량 초과분 $0.13/GB(서울), 들어오는 전송 무료                                                                                                    | AWS Price List(Lightsail, 서울)                                                           | 첫 청구서 확인 예정일 2026-11-05 |
| Route 53 도메인 `.com`           | `dormduri.com` 하나(자동 갱신)                                                                              | 등록·갱신 $16.00/년(2026-07-01부터)                                                                                                                 | [Route 53 pricing](https://aws.amazon.com/route53/pricing/)의 도메인 가격표               | 첫 청구서 확인 예정일 2026-11-05 |
| Route 53 hosted zone             | public hosted zone 하나                                                                                     | $0.50/월(처음 25개)                                                                                                                                 | [Route 53 pricing](https://aws.amazon.com/route53/pricing/)                               | 첫 청구서 확인 예정일 2026-11-05 |
| Route 53 DNS query               | standard query                                                                                              | $0.40/백만 건(월 첫 10억 건)                                                                                                                        | [Route 53 pricing](https://aws.amazon.com/route53/pricing/)                               | 첫 청구서 확인 예정일 2026-11-05 |
| Route 53 health check            | HTTPS health check 하나                                                                                     | Basic: AWS endpoint $0.50/월(같은 계정 AWS endpoint 50개까지 무료), 그 밖 endpoint $0.75/월. HTTPS 선택 기능: AWS endpoint $1.00/월, 그 밖 $2.00/월 | [Route 53 pricing](https://aws.amazon.com/route53/pricing/)                               | 첫 청구서 확인 예정일 2026-11-05 |
| CloudWatch alarm(`us-east-1`)    | standard resolution alarm 하나                                                                              | $0.10/alarm metric-월, 무료 등급 10개                                                                                                               | [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)                          | 첫 청구서 확인 예정일 2026-11-05 |
| SNS email 알림                   | 주제 둘: 외부 가용성 경보(`us-east-1`), SES event 알림(SES 구성 세트의 event destination). 둘 다 email 구독 | 월 첫 1,000건 무료, 이후 $2.00/100,000건. API 요청은 월 첫 100만 건 무료, 이후 $0.50/백만 건. 서울과 `us-east-1` 단가가 같음                        | AWS Price List(SNS, 서울·`us-east-1`), [SNS pricing](https://aws.amazon.com/sns/pricing/) | 첫 청구서 확인 예정일 2026-11-05 |
| ECR 비공개 repository 저장(서울) | repository 둘(image 거의 없음)                                                                              | $0.10/GB-월. 새 고객은 1년 동안 월 500 MB 무료. 같은 region의 AWS 서비스로 가는 전송은 무료                                                         | [ECR pricing](https://aws.amazon.com/ecr/pricing/)                                        | 첫 청구서 확인 예정일 2026-11-05 |
| SES(서울)                        | sandbox, Essentials plan                                                                                    | Essentials: 월 요금 없음, 보낸 메일 1,000건당 $0.16(월 1,000만 건까지). Event destination의 SNS 알림은 SNS 단가                                     | [SES pricing](https://aws.amazon.com/ses/pricing/)                                        | 첫 청구서 확인 예정일 2026-11-05 |
| Systems Manager(서울)            | hybrid managed node 하나                                                                                    | Node 등록 무료. Hybrid node의 Run Command $0.002/회, Session Manager $0.05/session(2026-09-30부터)                                                  | [Systems Manager pricing](https://aws.amazon.com/systems-manager/pricing/)                | 첫 청구서 확인 예정일 2026-11-05 |
| AWS Budgets                      | budget 하나, 알림 넷                                                                                        | Budget 감시와 알림 무료(action-enabled budget 아님)                                                                                                 | [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)    | 무료                             |

- AWS Organizations, IAM Identity Center, IAM role과 OIDC provider는 별도 요금이 없습니다.
- 가격표에 없어 첫 청구서로 확인할 것:
  - Route 53 가격표는 AWS endpoint를 "AWS 안에서 실행되는 resource(예: EC2 instance)"로만 설명하고 Lightsail을 언급하지 않습니다.
    Lightsail static IP 대상 health check가 AWS endpoint 단가인지 그 밖 단가인지 청구서의 health check 줄로 확인합니다.
  - Lightsail host가 ECR에서 image를 받는 전송이 같은 region 무료 전송인지 가격표에 문구가 없습니다. 첫 Web 배포 뒤 청구서로
    확인합니다.
  - SNS 무료 등급(email 월 1,000건)을 주제 region마다 따로 받는지 계정 전체로 합산하는지, SES event 알림 주제가 어느 region에
    청구되는지 청구서의 SNS 줄로 확인합니다.
  - 계정에 AWS Free Tier credit이 적용되면 청구 금액이 단가 합과 다를 수 있습니다. 첫 청구서의 credit 줄로 확인합니다.

## 실제 월 금액

| 청구 월             | 합계                             | 서비스별 금액                    | 확인일 |
| ------------------- | -------------------------------- | -------------------------------- | ------ |
| 2026-10(일부)       | 첫 청구서 확인 예정일 2026-11-05 | 첫 청구서 확인 예정일 2026-11-05 | —      |
| 2026-11(첫 전체 달) | 확인 예정일 2026-12-05           | 확인 예정일 2026-12-05           | —      |

## 청구서 확인

- 월 1회: 지난달 청구서가 발행된 뒤(Bills의 상태가 Issued) 서비스별 금액을 위 표에 적습니다. 진행 중인 달은 같은 화면에서
  Pending 상태의 예상 금액으로 봅니다.
- 연 1회: 도메인 자동 갱신 청구를 확인합니다(Route 53 > Registered domains의 만료일).
- Budgets 알림(실제 비용 50%·80%·100%, 예측 비용 100%)을 받으면 그 달 예상 금액과 서비스별 증가 항목을 바로 확인합니다.
- 공식 단가가 바뀌거나 resource를 추가·삭제하면 이 표와 확인일을 고칩니다.
- 확인하는 곳: Billing and Cost Management > Bills, Budgets

## 기록하지 않는 것

Card number, invoice ID, billing address, tax identifier, credential value, raw billing export는 commit하지 않습니다. 금액은
서비스별 합계로만 적고 청구서 PDF·CSV 원본을 저장소에 두지 않습니다. 계정 식별자는 [식별자 규칙](./README.md#식별자-규칙)을
따릅니다.
