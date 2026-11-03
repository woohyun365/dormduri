# AWS target checklists

`infra/aws`는 배포 target으로 고른 AWS에서 운영자와 release 담당 세션이 확인할 **release-gated 입력 목록**과
setup checklist를 소유한다. 지금 적용한 구성과 계정·비용 알림은
[`docs/deploy/production-environment.md`](../../docs/deploy/production-environment.md)가 설명한다. 현재 resource를 생성하거나
AWS SDK/CLI를 실행하는 IaC 디렉터리가 아니다.

Web 단계 CD가 쓰는 계정 resource의 정책 원본도 여기 둔다. Account·repository ID 같은 값은 `<ACCOUNT_ID>`,
`<GITHUB_OWNER_ID>`, `<GITHUB_REPO_ID>` placeholder로 두고 Owner가 console에서 채운다(파일에 실제 값을 쓰지 않는다).

- `iam/host-role.trust.json`·`iam/host-role.ecr-pull.json`: Lightsail host를 SSM hybrid managed node로 등록하는 service
  role(trust `ssm.amazonaws.com`)과 그 role이 두 ECR repository에서 image를 받는 권한
- `iam/publish-role.trust.json`·`iam/publish-role.permissions.json`: GitHub Actions가 image를 ECR에 올리는 OIDC role
- `iam/deploy-role.trust.json`·`iam/deploy-role.permissions.json`: GitHub Actions가 SSM document를 부르는 OIDC role(provenance
  검증과 SBOM 확인을 위한 두 repository의 manifest 읽기 포함)
- `iam/github-oidc-sub-template.json`: 저장소의 GitHub OIDC `sub` claim 설정. 두 OIDC role trust가 이 형식으로 대조한다
- `ecr/lifecycle-policy.json`: `dormduri/web`·`dormduri/ingress` repository의 image 보존 규칙

- `rds-setup-checklist.md`: PostgreSQL 18, private network, backup/PITR, SSL, connection budget
- `secrets-manager-checklist.md`: Secrets Manager origin, GitHub OIDC release principal, mounted-file
  application read source와 rotation 입력

API secret과 Lightsail host 준비 상태는 각각
[`api-secrets-manager/readiness.md`](../runbooks/release/components/api-secrets-manager/readiness.md),
[`lightsail-runtime/readiness.md`](../runbooks/release/components/lightsail-runtime/readiness.md)에서 닫는다.

- `ses-setup-checklist.md`: region, verified identity, sandbox 해제, mail smoke 입력

체크박스는 준비 항목이며 **실제 target evidence가 아니다**. 실제 provider, operator, 수집 시각과 결과는
[`infra/runbooks/release/components/infrastructure-target/evidence.md`](../runbooks/release/components/infrastructure-target/evidence.md)의
형식으로 [실제 값의 기록 위치](../runbooks/release/production-release-evidence.md#실제-값의-기록-위치)에 남긴다. Resource
identifier 같은 식별자는 [식별자 규칙](../../docs/deploy/README.md#식별자-규칙)을 따른다.
