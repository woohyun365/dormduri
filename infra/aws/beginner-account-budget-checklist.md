# AWS beginner account / budget checklist

이 문서는 향후 production provider로 AWS를 선택한 경우 계정 비용과 실수 방지 경계를 검토하기 위한 참고 checklist다. 현재 repository의 지원되는 CD 경로나 확정된 provider를 의미하지 않는다.

## Account safety

- Root account MFA를 활성화한다.
- 운영자 IAM Identity Center 또는 IAM user MFA를 활성화한다.
- Access key는 필요한 경우에만 만들고, 자동화 credential은 선택한 CI/CD 경계에서 short-lived identity를 우선 검토한다.
- Region은 운영 latency, 데이터 위치, 비용을 근거로 결정한다.

## Budget / alert

- AWS Budgets에서 월 예산을 생성한다.
- 실제 결제 임계값 50%, 80%, 100% notification을 설정한다.
- RDS, EC2/Lightsail, NAT Gateway, CloudWatch Logs, Secrets Manager, SES 사용량을 비용 검토 항목에 포함한다.
- 부하 테스트나 observability long run은 종료 시간을 정하고 resource cleanup을 확인한다.

## Deployment approval input

- Approval owner와 최소 reviewer 수를 결정한다.
- Deployment secret/variable scope를 repository-wide 값과 분리한다.
- 자동 release와 수동 release 중 어떤 경로를 허용할지 결정한다.
- Non-dry-run 변경의 branch/tag provenance 규칙을 결정한다.

## First release evidence

첫 release 전 아래 evidence를 남긴다.

1. Budget alert screenshot 또는 설정 확인 기록.
2. RDS backup/PITR 설정 확인.
3. Secrets Manager prefix와 IAM read policy 확인.
4. SES identity/DKIM/sandbox 상태 확인.
5. Deployment/runtime principal의 최소 권한 검토.
6. 선택한 target의 dry-run 또는 staging rehearsal evidence.
7. Release artifact provenance와 `/health/ready` 결과.
