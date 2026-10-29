# Remote repository settings

GitHub repository setting은 tracked file과 별도의 control plane입니다. 이 문서는 secret을 저장하지 않고 기대 상태,
확인 방법, dated actual state, blocker와 다음 owner를 기록합니다. Repository code 변경 완료를 remote enforcement 완료로
간주하지 않습니다.

## 기대 상태

| Setting                     | 권장 상태                                          | 근거와 적용 경계                                             |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `actions.enabled`           | enabled                                            | Pull request와 protected branch의 canonical CI 실행          |
| `sha_pinning_required`      | enabled                                            | Mutable tag를 통한 공급망 변경 방지                          |
| `allowed_actions`           | 실제 workflow가 사용하는 publisher/action으로 제한 | `actions/*`, `pnpm/action-setup` 검증 후 적용                |
| Workflow token              | read-only, PR approval disabled                    | Job별 명시적 permission 외 기본 write 권한 차단              |
| Private fork PR             | workflow·write token·secret 전달 disabled          | 외부 기여 input과 credential 경계 분리                       |
| Merge method                | squash merge와 merge commit enabled                | Bounded PR은 dev squash, dev→main 승격은 ancestry 보존 merge |
| `delete_branch_on_merge`    | enabled                                            | 병합된 bounded branch 자동 정리; `main`·`dev`는 ruleset 보호 |
| `dev` ruleset               | active, PR + `CI summary`, linear, squash only     | Bounded change를 한 integration commit으로 유지              |
| `main` ruleset              | active, PR + `CI summary`, merge only              | `dev` commit ancestry와 release integration point 보존       |
| Force push                  | disabled                                           | reviewed history와 remote evidence 보존                      |
| Branch deletion             | disabled                                           | integration/release branch 삭제 방지                         |
| Protection owner            | active Rulesets only                               | classic Branches rule과 중복·layering drift 방지             |
| Up-to-date requirement      | 기본 off                                           | fresh `dev` 순차 PR로 보완하고 중복 full CI 방지             |
| Required reviewer           | 0                                                  | 1인 저장소에서 자기승인/bypass 의식을 만들지 않음            |
| Vulnerability alerts        | enabled                                            | dependency 취약점 발견 owner                                 |
| Dependabot security updates | disabled                                           | 보안 PR은 Renovate가 `dev`로 연다                            |
| Allow auto-merge            | disabled                                           | Renovate 자체 merge만 사용                                   |
| Actions artifact retention  | 7일 기본, consumer별 더 짧게 검토                  | 필요한 실패/재사용 evidence만 effective allowance 안에 유지  |
| Actions cache               | 10GB 이내, thrash 없이 유지                        | build 속도 surface; artifact/Packages와 별도 측정            |
| Environment / secrets       | caller가 없으면 absent                             | 현재 CI-only 경계에서 speculative credential surface 금지    |
| Paid code/secret security   | not enabled                                        | personal private repo 비용·owner 결정 전 비도입              |

Allowed-actions payload, merge-method 변경, security 기능 활성화는 외부 side effect입니다. 실제 적용 전에는 current workflow
uses와 repository owner 승인을 다시 확인합니다.

`Require branches to be up to date`는 기본 off로 두고 fresh `dev` 순차 PR 정책으로 보완합니다. 동시 contributor나 stale
base integration failure가 실제로 발생하면 strict mode를 다시 검토합니다.

Required `CI summary`의 expected source는 GitHub Actions로 제한해 같은 이름의 외부 status가 merge gate를 대체하지 못하게
합니다.

## Rulesets와 classic Branches 책임

GitHub의 **Rulesets → Rulesets**는 현재 branch 보호의 canonical owner입니다. **Rulesets → Branches**는 기존 classic branch
protection rule을 관리하는 별도 surface이며, 비어 있어도 active ruleset이 적용된 branch는 보호됩니다. 두 방식을 함께 쓰면
적용 가능한 규칙이 layer되고 더 엄격한 조건이 적용되므로, 같은 `main`·`dev` 계약을 classic Branches에 중복하지 않습니다.

현재 effective branch-rules API는 `main`과 `dev`에 active ruleset의 삭제·non-fast-forward·PR·required status를 반환하고,
classic protection endpoint에는 별도 rule이 없습니다. 이 구조는 의도된 상태입니다. Rulesets를 retire하거나 legacy
consumer가 확인된 경우에만 classic Branches 전환을 별도 migration으로 다룹니다.

## Evidence 상태

- `VERIFIED_REMOTE`: 아래 read-only command로 현재 원격값을 확인했고 기대 상태와 일치합니다.
- `VERIFIED_OWNER_UI`: 공개된 read endpoint가 없는 설정을 repository owner가 GitHub UI에서 직접 확인했습니다.
- `PENDING_OWNER_ACTION`: 현재값은 확인했지만 변경에는 repository owner의 명시적 승인이 필요합니다.
- `PENDING_ACCOUNT_TIER`: 현재 account tier가 설정 또는 검증을 지원하지 않습니다.
- `PENDING_EVIDENCE`: endpoint 의미나 현재값을 아직 확인하지 못했습니다.

이 문서의 command는 모두 read-only입니다. `PATCH`, `PUT`, `POST`, `DELETE` 같은 remote mutation은 이 handoff의 책임이
아니며, owner 승인을 받은 별도 release 작업에서 적용하고 같은 command로 재확인합니다.

## 현재 evidence

- checkedAt: 2026-08-27
- repository: `woohyun365/dormduri`
- operator: local authenticated `gh` read-only inspection

| Setting                     | Actual                                                                               | Status                 |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| Plan / visibility           | GitHub Pro / private                                                                 | `VERIFIED_REMOTE`      |
| Default branch              | `main`                                                                               | `VERIFIED_REMOTE`      |
| Repository features         | Issues on; Wiki, Projects, Discussions, template off                                 | `VERIFIED_REMOTE`      |
| Merge methods               | merge commit + squash enabled, rebase off; PR title + PR body; auto-merge off        | `VERIFIED_REMOTE`      |
| Delete branch on merge      | `delete_branch_on_merge=true`; merged bounded head 자동 정리                         | `VERIFIED_REMOTE`      |
| Actions                     | selected; GitHub-owned true, verified creators false, `pnpm/action-setup@*` only     | `VERIFIED_REMOTE`      |
| Full-SHA requirement        | `sha_pinning_required=true`                                                          | `VERIFIED_REMOTE`      |
| `dev` ruleset               | `dev-integration-gate` active on exact `dev`; linear history, squash only, no bypass | `VERIFIED_REMOTE`      |
| `main` ruleset              | `main-release-gate` active on default branch; no linear rule, merge only, no bypass  | `VERIFIED_REMOTE`      |
| PR rule                     | both zero approvals and conversation resolution; target-specific merge method        | `VERIFIED_REMOTE`      |
| Required status             | both require `CI summary`, GitHub Actions app `15368`, strict up-to-date off         | `VERIFIED_REMOTE`      |
| Force push / deletion       | non-fast-forward and deletion blocked                                                | `VERIFIED_REMOTE`      |
| Vulnerability alerts        | endpoint `204`                                                                       | `VERIFIED_REMOTE`      |
| Dependabot malware alerts   | enabled                                                                              | `VERIFIED_OWNER_UI`    |
| Dependabot security updates | 목표 disabled; 마지막 확인 `enabled=true`, `paused=false`                            | `PENDING_OWNER_ACTION` |
| Workflow token              | `default_workflow_permissions=read`, PR approval off                                 | `VERIFIED_REMOTE`      |
| Private fork PR             | workflow/write token disabled; fork workflow execution disabled                      | `VERIFIED_REMOTE`      |
| Artifact/log retention      | owner UI 7 days                                                                      | `VERIFIED_OWNER_UI`    |
| Actions cache policy        | owner UI 7-day retention / 10GiB eviction; API 7,475,286,431 bytes, 29 entries       | `VERIFIED_REMOTE`      |
| Actions artifacts           | 104 active, 8,178,655 bytes; observed retention 7 days (2026-08-27)                  | `VERIFIED_REMOTE`      |
| Effective shared storage    | owner Billing UI와 Packages billing contract 기준 Pro shared storage 2GB             | `VERIFIED_OWNER_UI`    |
| GitHub Packages             | owner UI에서 package 0개 확인; 별도 Packages credential 없음                         | `VERIFIED_OWNER_UI`    |
| Installed GitHub Apps       | owner UI: ChatGPT Codex Connector selected repo only, Renovate                       | `VERIFIED_OWNER_UI`    |
| Classic branch protection   | `main`·`dev` 모두 없음; active Rulesets가 effective protection owner                 | `VERIFIED_REMOTE`      |
| Remote branch inventory     | protected `main`, `dev`만 존재; 기존 merged head 23개 owner-approved cleanup 완료    | `VERIFIED_REMOTE`      |
| Environments                | 0; unused legacy `copilot` environment 삭제                                          | `VERIFIED_REMOTE`      |
| Webhooks / deploy keys      | 각각 0                                                                               | `VERIFIED_REMOTE`      |
| Repository secrets/vars     | Actions·Dependabot·Codespaces·legacy environment 모두 0                              | `VERIFIED_REMOTE`      |
| Pages                       | disabled                                                                             | `VERIFIED_REMOTE`      |
| Code/Secret paid products   | Code Scanning disabled; personal private repo에서 별도 paid owner decision까지 보류  | `VERIFIED_REMOTE`      |

이 표는 snapshot입니다. 미래 작업은 표의 문장을 current truth로 가정하지 않고 아래 command로 다시 조회합니다.

현재 cache는 29개 entry / 약 6.96GiB로 10GiB eviction 경계의 약 69.6%입니다. pnpm family는 15개 / 약 4.42GiB, Next
family는 14개 / 약 2.54GiB이며 80%부터 key 폭증과 eviction thrash를 검토합니다. Active artifact는 104개 / 약 7.8MiB이고
owner UI의 artifact/log retention은 7일입니다. Owner Billing UI와 Packages billing contract가 제시하는 Pro shared storage
2GB를 effective account boundary로 사용합니다. Actions 문서의 Pro artifact 1GB 표기는 provider 문서 간 차이로 별도
reference를 보존하되, account allowance를 1GB로 축소하지 않습니다. 어느 경우에도 artifact/Packages shared storage와 별도
10GiB cache를 합산하지 않습니다. Packages는 owner UI에서 0개를 확인했으므로 이를 dated evidence로 사용하며, 단지 자동
확인을 위해 `read:packages` credential을 만들지 않습니다.

## Secret-free 확인 절차

```bash
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

gh api "repos/$REPO" \
  --jq '{private,default_branch,allow_merge_commit,allow_squash_merge,allow_rebase_merge,delete_branch_on_merge}'
gh api "repos/$REPO/actions/permissions"
gh api "repos/$REPO/actions/permissions/workflow"
gh api "repos/$REPO/actions/permissions/fork-pr-workflows-private-repos"
gh api "repos/$REPO/rulesets"
for id in $(gh api "repos/$REPO/rulesets" --jq '.[].id'); do
  gh api "repos/$REPO/rulesets/$id" \
    --jq '{name,enforcement,conditions,rules,bypass_actors}'
done
gh api "repos/$REPO/rules/branches/main"
gh api "repos/$REPO/rules/branches/dev"
gh api --include "repos/$REPO/vulnerability-alerts"
gh api "repos/$REPO/automated-security-fixes"
gh api "repos/$REPO/actions/cache/usage"
gh api --paginate "repos/$REPO/actions/artifacts?per_page=100"
gh api "repos/$REPO/environments"
gh api "repos/$REPO/hooks"
gh api "repos/$REPO/keys"
```

- response header의 token, credential, 개인 식별 정보는 evidence에 복사하지 않습니다.
- `403`은 기능 미구현으로 단정하지 않고 token/account-tier/endpoint authority를 구분합니다.
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
3. bounded PR→`dev`는 squash, `dev`→`main`은 merge commit인지 확인하고 merged head auto-delete와 protected
   `main`·`dev` retention이 함께 유지되는지 확인합니다.
4. vulnerability alerts가 켜져 있고 Dependabot security updates와 Allow auto-merge가 꺼져 있는지 확인합니다. 보안 PR은
   Renovate가 `dev`로 엽니다.
5. GitHub Pro ruleset 또는 branch protection으로 `CI summary`를 required check로 설정하고 strict up-to-date는 기본 off로
   둡니다.
6. 실제값과 blocker를 이 문서에 갱신하되 secret이나 raw credential response는 기록하지 않습니다.

완료 조건은 각 setting이 `VERIFIED_REMOTE`가 되거나, 적용할 수 없는 이유와 다음 owner가
`PENDING_OWNER_ACTION`/`PENDING_ACCOUNT_TIER`/`PENDING_EVIDENCE`로 명시되는 것입니다. Repository code의 merge만으로
remote setting 적용 완료를 주장하지 않습니다.

## Integration promotion contract

GitHub repository merge toggle은 branch별 선택을 직접 제한하지 않으므로 ruleset이 실제 경계를 소유합니다.

```text
feature/fix/chore PR -> dev
  dev-integration-gate
  -> required linear history
  -> squash only

dev -> main integration PR
  main-release-gate
  -> no linear-history rule
  -> merge commit only
```

`main` 승격에서 squash를 사용하면 파일 내용은 반영되어도 `main`이 `dev` commit을 ancestor로 보존하지 않아 후속 승격이
충돌할 수 있습니다. 반대로 모든 branch에 merge commit을 허용하면 bounded feature history가 `dev`를 불필요하게
복잡하게 만듭니다. 따라서 repository-level에서는 두 방식을 허용하고 active split ruleset으로 target별 방식을 제한합니다.
