# API Secrets Manager release evidence

[실제 값의 기록 위치](../../production-release-evidence.md#실제-값의-기록-위치)에 이 형식으로 남긴다. 이 YAML은
template이며 실제 값을 채우지 않는다.

```yaml
schema_version: 1
state: PENDING_TARGET
component_result: PENDING
release_commit_sha:
operator:
collected_at:
evidence_id:
aws_region:
# 식별자(account, secret ARN, IAM role, KMS key, CloudTrail event)는 값을 적지 않는다.
# location에 Owner console 화면 위치를, checked에 확인 여부(yes|no)를 적는다.
console_checks:
  secret_bundles:
    location:
    checked: PENDING
  host_role_secret_read_policy:
    location:
    checked: PENDING
  github_roles_without_secret_read:
    location:
    checked: PENDING
  kms_key:
    location:
    checked: PENDING
  cloudtrail_get_secret_value:
    location:
    checked: PENDING
secret_names_and_keys_match_checklist: PENDING
host_role_policy_sha256:
rotation_owner:
next_rotation_at:
redaction_confirmed: false
```

`secret_names_and_keys_match_checklist`는 묶음 이름과 key 목록이 `infra/aws/secrets-manager-checklist.md`와 같은지,
`host_role_policy_sha256`은 host role의 secret 읽기 정책이 `infra/aws/iam/host-role.secrets-read.json`과 같은지 대조한
결과다. Secret value, connection string, token, GitHub assertion과 raw AWS provider payload는 기록하지 않는다.
