# API Secrets Manager release evidence

```yaml
schema_version: 1
state: PENDING_TARGET
component_result: PENDING
release_commit_sha:
operator:
collected_at:
evidence_id:
aws_account_id:
aws_region:
oidc_role_arn:
iam_policy_sha256:
trust_policy_sha256:
secret_prefix_identifier:
kms_key_identifier:
cloudtrail_event_identifier:
rotation_owner:
next_rotation_at:
redaction_confirmed: false
```

Secret value, connection string, token, GitHub assertion과 raw AWS provider payload는 기록하지 않는다.
