# Lightsail runtime release evidence

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
bundle_and_region:
# 식별자(instance, managed node, IP, snapshot)는 값을 적지 않는다.
# location에 Owner console 화면 위치를, checked에 확인 여부(yes|no)를 적는다.
console_checks:
  instance:
    location:
    checked: PENDING
  manual_snapshot_before_change:
    location:
    checked: PENDING
  firewall:
    location:
    checked: PENDING
firewall_policy_sha256:
secret_release_id:
secret_inventory_sha256:
file_permission_result: PENDING
read_only_mount_result: PENDING
candidate_readiness_result: PENDING
rollback_result: PENDING
previous_release_id:
disk_headroom_result: PENDING
redaction_confirmed: false
```

`manual_snapshot_before_change`는 위험한 변경(첫 API 배포 등) 직전에 찍은 수동 snapshot이 있는지다. 자동 snapshot은 끈
채 두고, host는 새 instance와 CD 재배포로 복구한다(`docs/deploy/production-environment.md`). `secret_release_id`는 host
release 이름(`api-<UTC 시각>-<digest 앞 12자>-<pid>`)이다. Secret value, raw file content, connection string, token, SSH
private key는 기록하지 않는다.
