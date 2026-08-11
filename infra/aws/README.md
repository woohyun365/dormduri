# AWS target checklists

`infra/aws`는 AWS를 실제 배포 provider로 선택하는 시점에 운영자와 release 담당 세션이 확인할
**release-gated 입력 목록**을 소유한다. 현재 resource를 생성하거나 AWS SDK/CLI를 실행하는 IaC
디렉터리가 아니다.

- `beginner-account-budget-checklist.md`: 계정, 비용 알림, 기본 예산 경계
- `rds-setup-checklist.md`: PostgreSQL 18, private network, backup/PITR, SSL, connection budget
- `secrets-manager-checklist.md`: runtime·migration secret 분리와 rotation 입력
- `ses-setup-checklist.md`: region, verified identity, sandbox 해제, mail smoke 입력

체크박스는 준비 항목이며 **실제 target evidence가 아니다**. 실제 provider, resource identifier,
operator, 수집 시각과 결과는
[`infra/runbooks/release/components/infrastructure-target/evidence.md`](../runbooks/release/components/infrastructure-target/evidence.md)에만 기록한다.
