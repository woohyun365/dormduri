# GitHub authentication and operator access

## 책임

이 문서는 개발자 workstation의 Git credential, GitHub CLI(`gh`) 인증, GitHub connector, GitHub Actions token과 임시
operator credential의 책임을 분리합니다. 실제 token·OAuth code·cookie·authorization header·credential-store 내용은
저장하지 않고, 최소 권한과 확인·회수 절차만 추적합니다.

Repository control-plane의 기대값과 실제 적용 상태는
[Remote repository settings](./remote-repository-settings.md)가 소유합니다. 이 문서는 그 설정을 변경할 수 있는
workstation/app 인증 경계를 소유하며, repository 설정 자체의 현재값을 중복 기록하지 않습니다.

- 마지막 확인일: 2026-11-01([Current repository operator evidence](#current-repository-operator-evidence)). Owner UI로만 볼 수
  있는 줄은 그 줄에 적은 날짜가 확인일입니다.
- 다시 볼 때: gh scope나 Connector 설치 범위를 바꿀 때, billing token을 새로 만들 때와 그 만료일, 저장소 공개 상태를 바꾸기 전,
  그리고 [날짜 snapshot 재확인](../../README.md#날짜-snapshot-재확인)의 월 1회 점검 때.

## 인증 계층

| 계층                          | Owner와 용도                                        | 권한 경계                                                         | 저장·수명                                                                                                                  |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Git credential                | HTTPS `fetch`·`push`                                | 선택한 GitHub account의 repository 접근                           | `gh auth setup-git`을 통한 OS credential store                                                                             |
| gh browser OAuth              | PR·Issue·Actions·API와 Git credential의 daily owner | 기본 `repo`, `read:org`, `gist`; workflow 파일 작업 시 `workflow` | OS credential store, logout/re-auth로 회수                                                                                 |
| GitHub connector              | ChatGPT/Codex plugin의 PR·Issue·repository action   | GitHub App 설치 시 허용한 repository와 app action만               | provider OAuth/App installation                                                                                            |
| GitHub Actions `GITHUB_TOKEN` | 한 workflow run 내부 checkout·artifact·API          | workflow/job의 `permissions`에 명시된 범위                        | GitHub가 run별 발급·만료                                                                                                   |
| Billing fine-grained PAT      | 개인 billing usage의 bounded read automation        | account permission `Plan: Read`만; repository access 없음         | 쓸 때 새로 만들어 Apple Passwords 보관, 실행 shell에만 일시 주입. 마지막 token은 2026-09-25에 만료, 지금 유효한 token 없음 |
| Repository admin credential   | ruleset·Actions policy·security setting 변경        | owner UI를 기본으로 사용; 자동화 시 selected-repository 최소 권한 | 일상 credential로 만들지 않음                                                                                              |

Git commit의 author name/email은 commit metadata이며 GitHub 인증 계정과 동일한 개념이 아닙니다. GitHub는 verified email
등을 통해 commit을 account와 연결하지만, fetch/push 권한은 Git credential이 결정합니다.

## Daily gh와 Git 설정

한 명의 GitHub account를 사용하는 기본 workstation에서는 Git HTTPS와 gh browser OAuth를 하나의 credential owner로
통합합니다.

다음은 최초 연결 또는 확인된 인증 장애의 복구 절차입니다. 새 세션이나 명령 실패만을 이유로 유효한 로그인을 교체하지 않습니다.
`gh auth logout -h github.com -u <github-user>`는 실제 invalid credential의 교체가 필요한 경우에만 사용합니다.

```bash
gh auth login -h github.com --web --git-protocol https
gh auth refresh -h github.com -s workflow
gh auth setup-git -h github.com
```

기대 scope는 `repo`, `read:org`, `gist`, `workflow`입니다.

- `repo`: repository의 PR·Issue·Actions·contents 작업(public·private 모두)
- `read:org`: organization membership과 repository discovery read
- `gist`: GitHub CLI browser flow의 기본 최소 scope
- `workflow`: workflow 파일을 다루고 Actions-oriented gh workflow를 사용할 때 명시적으로 추가

`gh auth setup-git`은 현재 repository만이 아니라 `github.com` host의 Git credential helper 선택에 영향을 줄 수
있습니다. multiple account 또는 organization SSO가 추가되면 account별 SSH host alias나 명시적인 credential context로
전환하고, 한 account의 token을 다른 account repository에 재사용하지 않습니다.

### Current repository operator evidence

- checkedAt: 2026-11-01
- GitHub account: `woohyun365`
- gh storage/protocol: OS keyring / HTTPS
- daily scope class: `gist`, `read:org`, `repo`, `workflow`
- Git credential owner: `gh auth git-credential`
- repository read: public `woohyun365/dormduri`(release version부터 private으로 운영할 목표), default branch `main`
- Actions read: verified
- Connector installation: `Only select repositories`, this repository only(Owner UI 2026-08-27)
- Connector permission: `Allow read actions`(Owner UI 2026-08-27)
- Billing credential: separate `Plan: Read` fine-grained token, repository access 없음. 마지막 token은 2026-09-25에 만료, 지금 유효한
  token 없음
- Repository administration: owner GitHub UI, no admin PAT

이 snapshot은 token 자체나 credential 만료를 보증하지 않습니다. 새 작업은 아래 secret-free command로 current state를
다시 확인합니다.

### Secret-free 확인

```bash
gh auth status -h github.com
gh api user --jq .login
gh repo view <owner/repository>
gh pr list -R <owner/repository>
gh run list -R <owner/repository> --limit 1
git ls-remote origin HEAD
```

`gh auth status --show-token`은 금지합니다. `gh auth token`, shell tracing, process argument, clipboard transcript를
credential evidence로 남기지 않습니다.

## GitHub control-plane 선택

Git credential, `gh` OAuth, Connector OAuth는 합칠 대상이 아니라 서로 다른 인증 계층입니다. 일관성은 credential을
복사해서 만드는 것이 아니라, session surface에 따라 **primary control plane과 fallback을 한 번 선택**해서 만듭니다.

| Session surface                  | Primary control plane                           | Git transport                          | Fallback                                          |
| -------------------------------- | ----------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Shell-capable local Codex/Claude | `gh` CLI-first for PR·Issue·Actions·API         | Git credential via `gh auth setup-git` | Connector는 read 또는 이미 승인된 단발 mutation   |
| ChatGPT Web (지원된 Connector)   | GitHub Connector-first                          | local Git transport 없음               | 지원하지 않는 작업은 owner/CLI handoff            |
| CI workflow                      | checked-in workflow와 run-scoped `GITHUB_TOKEN` | checkout 설정이 명시한 경계            | local `gh`나 Connector credential을 주입하지 않음 |

다른 no-shell host는 실제 지원·승인된 Connector가 있을 때만 사용합니다. 미지원이면 권한 있는 실행자에게
최소 handoff를 남기며 Codex/ChatGPT의 connector가 존재한다고 가정하지 않습니다.

### Local session flow

한 remote lifecycle의 첫 작업에서만 secret-free preflight를 실행합니다.
이 preflight가 실패해도 원인 분류 전에는 invalid credential로 단정하지 않습니다. 업무 승인과 host/provider 권한은
[Execution authority](../agent-workflows/agent-execution-contract.md#execution-authority)를 따릅니다. `gh api` prefix 허용은
read-only나 특정 repo 제한이 아니며, 도구가 merge를 지원한다는 이유로 PR 생성 요청을 merge까지 확대하지 않습니다.

```text
gh auth status
  ├─ valid   → PR·Issue·Actions lifecycle을 gh로 계속 수행
  └─ invalid → read-only lookup은 Connector fallback 가능
               ├─ 후속 write가 여러 개 남음 → gh browser OAuth 복구
               └─ 이미 승인된 단발 write만 남음 → Connector로 1회 수행하고 명시

git fetch/push
  └─ Git credential 경계이며 gh API 성공 여부와 별도로 검증
```

다음 규칙을 지킵니다.

1. PR 생성부터 check 조회·merge까지 같은 lifecycle에서는 하나의 primary control plane을 유지합니다.
2. Mutation 전에 branch, open PR, Issue comment 또는 workflow run의 기존 상태를 조회해 duplicate 요청을 막습니다.
3. Mutation 뒤에는 같은 surface로 number, target branch, head SHA, state 또는 run ID를 read back하는 same-surface
   readback을 수행합니다. 다른 surface는 필요할 때만 교차 검증에 사용하며, 교차 검증이 mutation authority를 새로
   만들지는 않습니다.
4. Local fallback을 사용했다면 `gh` 실패 원인, Connector 사용 범위와 readback 결과를 진행 보고에 남깁니다. Silent
   fallback이나 임의적인 tool switching을 하지 않습니다.
5. 반복 write가 남아 있는데 invalid `gh`를 Connector로 계속 우회하지 않습니다. Browser OAuth를 복구하고
   `gh auth setup-git`을 재확인합니다.
6. Local token을 Connector에 전달하거나 Connector credential을 shell로 추출하지 않습니다. 두 계층의 repository scope와
   revoke lifecycle은 독립적으로 유지합니다.
7. 사용자가 Connector 기반 skill/workflow를 명시적으로 호출하면 그 workflow의 documented primary surface를 intentional
   override로 사용합니다. 이는 장애 fallback이 아니며, 시작 전에 기존 remote state를 읽고 lifecycle 전체에서 같은
   surface를 유지합니다.

이 선택은 도구 선호가 아니라 재현성, idempotency, credential 최소 권한을 위한 운영 계약입니다. Connector가 더 빠른
read surface를 제공하더라도 local CLI workflow의 primary owner가 자동으로 바뀌지는 않습니다.

### Failure classification before authentication recovery

실제 실패 결과와 같은 실행 환경의 secret-free 확인을 사용합니다. HTTP 응답을 받지 못한 경우와 서버가 권한을 거절한
경우를 구분하며, 아래 관측 하나만으로 token 만료 시점이나 근본 원인을 발명하지 않습니다.

| 관측                            | 우선 확인·다음 행동                                                                      | 하지 않을 일                                |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| sandbox 경로 거절·DNS/연결 실패 | 실제 host/network 제한과 endpoint 확인; 정책이 허용하는 escalation 절차 사용             | 곧바로 logout/login, 무단 sandbox 해제      |
| HTTP 401 또는 invalid 인증 표시 | 정상 통신 가능한 환경에서 account·선택된 credential의 상태 확인; 확인된 장애만 인증 복구 | token 출력·다른 도구에서 credential 추출    |
| HTTP 403/404                    | 요청 repo·operation·account scope, endpoint 지원·rate limit·provider 정책 확인           | 만료로 단정, 일괄 권한 확대 또는 반복 write |
| gh read 성공, Git push 거절     | Git credential·remote·branch protection 확인; 확인된 해당 경계만 복구                    | admin scope 추가·force push로 우회          |

허용된 재시도 전에는 remote state를 읽어 이전 write가 이미 성공했는지 확인합니다. 명시적인 host 거절은 일반 연결 오류와
다르며 같은 행동을 Connector나 다른 shell로 우회하지 않습니다. 기존 control-plane fallback 계약도 실행 권한을 추가하지
않습니다. 일상 credential에 billing/admin 권한을 합쳐 해결하지 않습니다.

## GitHub connector와 Codex/OMX GitHub workflow

GitHub connector는 local gh token을 사용하지 않습니다. ChatGPT/Codex의 app OAuth와 GitHub App installation이 별도로
결정하며, local gh login이 connector access를 넓히거나 복구하지 않습니다.

기본 경계:

- GitHub App installation은 `Only select repositories`로 제한합니다.
- 이 프로젝트에는 `woohyun365/dormduri`만 허용합니다.
- Current Plugin detail은 **Permissions**, **Skills**, **Read actions**, **Information**을 분리합니다.
  - Permissions: `Always ask`, `Allow read actions`, `Allow low-risk actions`, `Allow all actions` 중 **Allow read actions**를
    선택합니다. Read는 자동 허용하되 write/change action은 사용자 승인을 요구하는 경계입니다.
  - Skills: workflow instruction 목록이며 GitHub source permission이나 OAuth scope를 추가하지 않습니다.
  - Read actions: connector가 현재 선언한 read capability inventory입니다. 이 섹션만 보이면 connector를 read-only로
    취급합니다.
  - Information: provider, terms, privacy와 plugin metadata를 확인하는 정보 경계입니다.
- PR·comment 같은 write action은 UI에 write capability와 approval control이 실제로 노출되거나, 추후 명시적 실행에서
  approval card가 확인될 때만 connector 책임으로 간주합니다.
- Connector가 지원하지 않는 작업을 broad token으로 우회하지 않고 아래 owner에게 넘깁니다.

| Workflow/skill               | Primary surface                                    | 추가로 필요한 local 권한                                     |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `github:github`              | connector 기반 PR·Issue triage                     | current branch와 local repository를 연결할 때 Git read       |
| `github:yeet`                | local Git commit/push + connector PR 생성          | Git HTTPS write; connector 실패 시 authenticated gh fallback |
| `github:gh-fix-ci`           | gh Actions checks·logs·rerun                       | `repo` scope; rerun에는 Actions write capability             |
| `github:gh-address-comments` | connector summary + `gh api graphql` review thread | `repo` scope; unresolved/resolved thread read                |
| OMX orchestration            | local/team workflow                                | GitHub 기능을 호출하지 않으면 GitHub token 불필요            |

ChatGPT/Codex app access는 GitHub의 source permission을 넘을 수 없습니다. Connector access 문제는 ChatGPT Apps와 GitHub
installation을 확인하고, gh 문제는 local CLI auth를 확인합니다.

### GitHub App installation token 형식

GitHub-managed Actions와 installed App이 사용하는 `ghs_` installation token은 opaque credential로 취급합니다. GitHub의
stateless rollout은 기존 짧은 opaque token과 함께 `ghs_APPID_JWT` 형태의 약 520자 가변 token을 발급할 수 있으며 `.`,
`_`, `-`가 포함될 수 있습니다. Token 내부 JWT claim을 해석하거나 권한 판단에 사용하지 않습니다.

이 repository는 installation token을 직접 mint·저장하지 않습니다. `scripts/github/account-evidence.mjs`의 credential
detector는 evidence persistence를 차단하기 위한 reject-only guard이며, classic token과 신규 stateless token 전체 형식을
모두 탐지합니다. 실제 token, match substring 또는 authorization header는 오류와 artifact에 포함하지 않습니다.

미래 integration이 installation token을 저장하거나 전달해야 한다면 다음을 먼저 검증합니다.

- 고정 36/40자 길이 또는 `[A-Za-z0-9]` 전용 validation을 사용하지 않음
- 최소 520자를 보존하는 storage/header boundary
- `ghs_[A-Za-z0-9.\-_]{36,}`와 동등한 secret detection
- token을 decode하지 않고 provider에 그대로 전달

근거: [GitHub token format notice](https://github.blog/changelog/2026-04-24-notice-about-upcoming-new-format-for-github-app-installation-tokens/),
[per-request compatibility test guidance](https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/).

## Billing과 임시 권한

Billing API는 daily gh와 분리한 account permission `Plan: Read` 전용 fine-grained token으로만 조회합니다. 이 token은
repository access와 repository permission이 없고 Apple Passwords에 보관합니다. daily gh credential에는 billing/admin 권한을
추가하지 않습니다.

마지막 billing token은 2026-09-25에 만료됐고 지금 유효한 billing token은 없습니다. `pnpm github:account:evidence`를 쓸 때 새로
만들고, 그 만료일을 이 문서와 policy fixture(`scripts/github/fixtures/account-evidence-policy.json`)의 `expiresOn`에 같은 PR로
적습니다. Fixture의 만료일이 지난 날에는 수집기가 token을 읽기 전에 실패하고 evidence를 만들지 않습니다.

사용 형태:

```bash
read -s KNU_GITHUB_PLAN_READ_TOKEN
export KNU_GITHUB_PLAN_READ_TOKEN
pnpm github:account:evidence -- --repo=<owner/repository> --year=<yyyy> --month=<m>
unset KNU_GITHUB_PLAN_READ_TOKEN
```

수집기는 billing child process에만 token을 전달하고 allowlist로 축약한 값을 `.artifacts/tools/github/`에 기록합니다.
fine-grained token을 daily `gh auth login --with-token` credential이나 shell profile에 저장하지 않습니다. Repository
administration은 GitHub UI가 기본 owner이며, API 자동화가 반복적으로 필요하다는 근거가 생길 때만 별도
selected-repository credential을 설계합니다.

### Current account-security evidence

- verified email 2개
- passkey와 TOTP 각각 실제 로그인 검증 완료; GitHub Mobile 유지, SMS fallback 제거
- recovery code는 owner-controlled local secure storage에 보관
- push protection enabled
- active session, expired token, stale OAuth/App authorization 정리 완료
- Installed GitHub Apps: ChatGPT Codex Connector, Renovate
- Authorized GitHub Apps: ChatGPT Codex, Copilot Chat App, Renovate
- Authorized OAuth Apps: GitHub CLI, GitHub iOS, Visual Studio Code

이 목록은 boolean/count-category readiness만 기록합니다. device 이름, session 위치/IP, recovery code, token 식별자와 값은
추적하지 않습니다.

## 금지 경계

- token, OAuth code, cookie, bearer header, credential-store dump를 commit하거나 artifact에 저장하지 않습니다.
- `.env`, plan, issue, PR body, log, screenshot에 credential 값을 넣지 않습니다.
- daily credential에 delete-repository, organization admin, repository hook admin, billing 또는 broad security-write 권한을
  추가하지 않습니다.
- `GH_TOKEN`을 shell profile이나 tracked script에 영구 저장하지 않습니다.
- GitHub connector가 연결되었다는 이유로 local Git/gh 인증도 정상이라고 가정하지 않습니다.
- Git fetch가 성공했다는 이유로 gh Actions/GraphQL 권한도 정상이라고 가정하지 않습니다.

## Recovery matrix

| 증상                                        | 우선 확인                                                                    | 복구                                                               | 금지                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Git fetch는 성공하지만 gh가 실패            | `gh auth status -h github.com`                                               | invalid gh logout → browser login → scope refresh                  | Git credential 값을 gh에 복사               |
| gh는 성공하지만 Git push가 실패             | remote URL, Git credential helper, repository write access·branch protection | helper 설정 문제로 확인된 경우만 setup-git 복구 후 `git ls-remote` | force push 또는 admin scope 추가            |
| Connector에서 repository가 보이지 않음      | ChatGPT Settings → Plugins → GitHub, GitHub installation scope               | selected repository 재확인 후 index 지연 확인                      | All repositories로 무조건 확장              |
| Connector read는 되지만 write action이 없음 | Permissions가 `Allow read actions`인지와 action catalog                      | supported connector action인지 확인하고 gh fallback contract 사용  | local token을 Connector에 전달              |
| Actions log는 보이나 rerun이 실패           | gh account와 `repo` scope, Actions permission                                | daily OAuth refresh 또는 owner authority 확인                      | source를 바꿔 새 run을 반복 생성            |
| Billing endpoint가 404/403                  | enhanced billing availability와 Plan-read token 상태·permission              | 전용 token 재발급 또는 Billing UI/CSV sanitized fallback           | daily repo token에 admin/billing scope 추가 |
| multiple account가 필요                     | active gh account, Git remote owner, SSO                                     | `gh auth switch` 또는 account별 SSH host strategy                  | 한 host credential을 암묵적으로 공유        |

## Rotation과 철회

1. Credential 의심·만료 시 `gh auth status`로 상태만 확인하고 token을 출력하지 않습니다.
2. Daily OAuth의 교체가 필요한 것으로 확인됐을 때만 `gh auth logout` 후 browser login으로 교체합니다.
3. Connector는 ChatGPT Settings → Plugins와 GitHub Installed Apps 양쪽에서 repository access를 회수할 수 있습니다.
4. Billing fine-grained token은 목적 종료·policy fixture `expiresOn`의 만료·권한 변경 시 GitHub Developer settings에서 revoke합니다.
5. 회수 뒤 `gh api user`, repository read, Git fetch, connector read가 기대 경계대로 성공/실패하는지 확인합니다.
6. Durable evidence에는 checkedAt, account login, repository, permission class, result, blocker만 기록하고 credential material은
   기록하지 않습니다.

## Revisit triggers

- 두 번째 GitHub account 또는 organization SSO 도입
- Connector action catalog나 write-confirmation 정책 변경
- GitHub CLI 기본 OAuth scope 변경
- Billing API contract, credential expiry 또는 owner 비용 검토 주기 변경
- repository settings를 UI가 아닌 반복 가능한 IaC/API로 관리할 필요 발생
- self-hosted runner, GitHub App automation 또는 OIDC workload identity 도입
