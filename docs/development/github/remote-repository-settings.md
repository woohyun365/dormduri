# Remote repository settings

GitHub repository setting은 tracked file과 별도의 control plane입니다. 이 문서는 secret을 저장하지 않고 기대 상태,
확인 방법, dated actual state, blocker와 다음 owner를 기록합니다. Repository code 변경 완료를 remote enforcement 완료로
간주하지 않습니다.

## 기대 상태

| Setting                     | 권장 상태                                          | 근거와 적용 경계                                    |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `actions.enabled`           | enabled                                            | Pull request와 protected branch의 canonical CI 실행 |
| `sha_pinning_required`      | enabled                                            | Mutable tag를 통한 공급망 변경 방지                 |
| `allowed_actions`           | 실제 workflow가 사용하는 publisher/action으로 제한 | `actions/*`, `pnpm/action-setup` 검증 후 적용       |
| Workflow token              | read-only, PR approval disabled                    | Job별 명시적 permission 외 기본 write 권한 차단     |
| Private fork PR             | workflow·write token·secret 전달 disabled          | 외부 기여 input과 credential 경계 분리              |
| Merge method                | merge commit 기본, squash/rebase 비활성 검토       | Lore commit의 atomic decision과 trailer 보존        |
| `delete_branch_on_merge`    | enabled                                            | 완료 branch의 lifecycle 정리                        |
| Vulnerability alerts        | enabled                                            | dependency 취약점 발견 owner                        |
| Dependabot security updates | enabled                                            | 보안 update와 정기 version update 책임 분리         |
| Required check              | `CI summary`                                       | account tier가 branch rule을 지원할 때 적용         |

Allowed-actions payload, merge-method 변경, security 기능 활성화는 외부 side effect입니다. 실제 적용 전에는 current workflow
uses와 repository owner 승인을 다시 확인합니다.

## Evidence 상태

- `VERIFIED_REMOTE`: 아래 read-only command로 현재 원격값을 확인했고 기대 상태와 일치합니다.
- `PENDING_OWNER_ACTION`: 현재값은 확인했지만 변경에는 repository owner의 명시적 승인이 필요합니다.
- `PENDING_ACCOUNT_TIER`: 현재 account tier가 설정 또는 검증을 지원하지 않습니다.
- `PENDING_EVIDENCE`: endpoint 의미나 현재값을 아직 확인하지 못했습니다.

이 문서의 command는 모두 read-only입니다. `PATCH`, `PUT`, `POST`, `DELETE` 같은 remote mutation은 이 handoff의 책임이
아니며, owner 승인을 받은 별도 release 작업에서 적용하고 같은 command로 재확인합니다.

## 현재 evidence

- checkedAt: 2026-08-13
- repository: `woohyun365/knu_roommate`
- operator: local authenticated `gh` read-only inspection

| Setting                     | Actual                                               | Status                 |
| --------------------------- | ---------------------------------------------------- | ---------------------- |
| Visibility / default branch | private / `main`                                     | `VERIFIED_REMOTE`      |
| Merge methods               | merge commit, squash, rebase 모두 enabled            | `PENDING_OWNER_ACTION` |
| Delete branch on merge      | `delete_branch_on_merge=false`                       | `PENDING_OWNER_ACTION` |
| Actions                     | enabled, `allowed_actions=all`                       | `PENDING_OWNER_ACTION` |
| Full-SHA requirement        | `sha_pinning_required=false`                         | `PENDING_OWNER_ACTION` |
| Branch protection / ruleset | private GitHub Free에서 API `403`                    | `PENDING_ACCOUNT_TIER` |
| Vulnerability alerts        | endpoint `404`; 현재 repository에서는 disabled 의미  | `PENDING_OWNER_ACTION` |
| Dependabot security updates | `enabled=false`, `paused=false`                      | `PENDING_OWNER_ACTION` |
| Workflow token              | `default_workflow_permissions=read`, PR approval off | `VERIFIED_REMOTE`      |
| Private fork PR             | workflow·write token·secret 전달 모두 disabled       | `VERIFIED_REMOTE`      |

이 표는 snapshot입니다. 미래 작업은 표의 문장을 current truth로 가정하지 않고 아래 command로 다시 조회합니다.

## Secret-free 확인 절차

```bash
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

gh api "repos/$REPO" \
  --jq '{private,default_branch,allow_merge_commit,allow_squash_merge,allow_rebase_merge,delete_branch_on_merge}'
gh api "repos/$REPO/actions/permissions"
gh api "repos/$REPO/actions/permissions/workflow"
gh api "repos/$REPO/actions/permissions/fork-pr-workflows-private-repos"
gh api "repos/$REPO/branches/main/protection"
gh api "repos/$REPO/rulesets"
gh api --include "repos/$REPO/vulnerability-alerts"
gh api "repos/$REPO/automated-security-fixes"
```

- response header의 token, credential, 개인 식별 정보는 evidence에 복사하지 않습니다.
- `403`은 기능 미구현이 아니라 account-tier blocker로 기록합니다.
- `404`는 endpoint 의미를 확인합니다. Vulnerability alerts endpoint에서는 disabled 상태를 의미할 수 있습니다.

## Future operator handoff

적용 담당자는 setting마다 다음 필드를 갱신합니다. `verification command`는 secret-free read-only command여야 하며,
`blocker`가 없으면 `none`을 기록합니다.

```text
checkedAt:
operator:
repository:
setting:
expected:
actual:
appliedAt:
blocker:
verification command:
evidence link:
```

1. repository workflow의 external action inventory를 다시 확인합니다.
2. full-SHA requirement와 allowed-actions 정책을 적용하고 PR CI를 실행합니다.
3. merge strategy와 branch auto-delete를 owner decision과 맞춥니다.
4. vulnerability alerts와 Dependabot security updates를 확인합니다.
5. account tier가 허용하면 `CI summary`를 required check로 설정합니다.
6. 실제값과 blocker를 이 문서에 갱신하되 secret이나 raw credential response는 기록하지 않습니다.

완료 조건은 각 setting이 `VERIFIED_REMOTE`가 되거나, 적용할 수 없는 이유와 다음 owner가
`PENDING_OWNER_ACTION`/`PENDING_ACCOUNT_TIER`/`PENDING_EVIDENCE`로 명시되는 것입니다. Repository code의 merge만으로
remote setting 적용 완료를 주장하지 않습니다.
