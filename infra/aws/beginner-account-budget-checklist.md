# AWS beginner account / budget checklist

이 문서는 production deploy를 시작하기 전 AWS 계정 비용과 실수 방지 경계를 준비하기 위한 checklist다.

## Account safety

- Root account MFA를 활성화한다.
- 운영자 IAM Identity Center 또는 IAM user MFA를 활성화한다.
- Access key는 필요한 경우에만 만들고, GitHub Actions production deploy 기본 경로는 OIDC role을 사용한다.
- Region은 하나로 시작하고 `AWS_REGION` GitHub environment variable과 문서에 같은 값을 둔다.

## Budget / alert

- AWS Budgets에서 월 예산을 생성한다.
- 실제 결제 임계값 50%, 80%, 100% notification을 설정한다.
- RDS, EC2/Lightsail, NAT Gateway, CloudWatch Logs, Secrets Manager, SES 사용량을 비용 검토 항목에 포함한다.
- 부하 테스트나 observability long run은 종료 시간을 정하고 resource cleanup을 확인한다.

## Production environment approval

- GitHub `production` environment를 생성한다.
- Required reviewer를 설정한다.
- Environment secrets와 variables는 repository-wide secret보다 production environment에 둔다.
- Non-dry-run production deploy는 `main` branch에서 수동 실행하도록 유지한다.

## First release evidence

첫 release 전 아래 evidence를 남긴다.

1. Budget alert screenshot 또는 설정 확인 기록.
2. RDS backup/PITR 설정 확인.
3. Secrets Manager prefix와 IAM read policy 확인.
4. SES identity/DKIM/sandbox 상태 확인.
5. GitHub OIDC trust policy 확인.
6. `API Production Deploy` workflow dry-run artifact.
7. Non-dry-run release artifact와 `/health/ready` 결과.
