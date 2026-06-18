# GitHub Actions AWS OIDC checklist

이 문서는 GitHub Actions production deploy workflow가 long-lived AWS access key 없이 AWS에 접근하도록 OIDC role을 준비하는 운영 checklist다. Secret 원문은 GitHub workflow log, issue, report, 이 문서에 남기지 않는다.

## Repository / environment boundary

- Production deploy workflow는 `.github/workflows/api-deploy-production.yml`이다.
- Workflow trigger는 `workflow_dispatch`이며, GitHub `production` environment approval을 통과한 뒤에만 non-dry-run deploy를 실행한다.
- PR/push CI workflow `.github/workflows/api-ci.yml`에는 `id-token: write` permission을 두지 않는다.
- Non-dry-run production deploy는 `main` branch에서만 실행한다.

## GitHub environment variables

`production` environment에 아래 **Variables**를 둔다.

| Variable             | 용도                                                      |
| -------------------- | --------------------------------------------------------- |
| `AWS_REGION`         | OIDC assume role과 SSM deploy를 실행할 AWS region         |
| `AWS_ROLE_TO_ASSUME` | GitHub Actions가 assume할 production deploy IAM role ARN  |
| `API_BASE_URL`       | release smoke가 호출할 public 또는 private API base URL   |
| `DEPLOY_TRANSPORT`   | `ssm` 또는 `local`. 기본 production 후보는 `ssm`          |
| `DEPLOY_INSTANCE_ID` | `DEPLOY_TRANSPORT=ssm`에서 target EC2/Lightsail instance  |
| `DEPLOY_WORKDIR`     | target host의 repo/deploy working directory               |
| `DB_GRANT_SCHEMA`    | DB grant schema override. 기본값은 script의 `public`      |
| `DB_*_ROLE`          | DB role grant override. 운영 role 이름이 기본값과 다를 때 |

Role ARN 자체는 secret value가 아니지만 environment variable로 두어 PR CI와 분리한다.

## GitHub environment secrets

`production` environment에 아래 **Secrets**를 둔다.

| Secret                              | 용도                                     |
| ----------------------------------- | ---------------------------------------- |
| `MIGRATION_DATABASE_URL`            | Prisma migrate deploy와 role grant apply |
| `DATABASE_URL`                      | runtime credential smoke                 |
| `RETENTION_WORKER_DATABASE_URL`     | retention worker credential smoke        |
| `RETENTION_DISCLOSURE_DATABASE_URL` | disclosure credential smoke              |
| `METRICS_BEARER_TOKEN`              | `/internal/metrics` authorized smoke     |

Secret value는 workflow에서 출력하지 않는다. Script는 누락된 env key name만 출력한다.

## AWS IAM OIDC provider

AWS IAM identity provider를 아래 기준으로 준비한다.

```txt
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

Trust policy는 repository와 production environment subject를 좁힌다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:<owner>/<repo>:environment:production"
        }
      }
    }
  ]
}
```

`<owner>/<repo>`와 `<account-id>`는 실제 운영 값으로 바꾼다. Environment subject를 쓰면 repository 전체 push 권한과 production deploy 권한을 분리할 수 있다.

## Least privilege policy shape

Production deploy role은 처음에는 필요한 동작만 허용한다.

- `ssm:SendCommand`, `ssm:GetCommandInvocation` 또는 운영에서 선택한 remote command 권한
- target instance/tag에 한정된 `ec2:DescribeInstances` 등 조회 권한
- ECR을 쓰는 경우 필요한 image pull/push 권한
- Secrets Manager materializer를 GitHub runner에서 실행할 경우 필요한 prefix의 `secretsmanager:GetSecretValue`

DB URL, API secret, metrics token은 GitHub environment secrets 또는 target host secret materialization 경로가 소유한다. OIDC role 자체가 모든 production secret을 무제한 읽도록 만들지 않는다.

## Dry-run verification

Production credential 없이도 workflow에서 `dry_run=true`를 선택하면 아래를 확인한다.

1. install/build/test/compose config가 통과한다.
2. migration/role grant/DB smoke script가 dry-run으로 command boundary를 출력한다.
3. API/nginx rollout과 health/metrics smoke script가 dry-run으로 required path를 출력한다.
4. release evidence artifact가 생성된다.

## Non-dry-run release checklist

1. `main` branch commit SHA와 image tag를 확인한다.
2. GitHub Actions에서 `API Production Deploy` workflow를 수동 실행한다.
3. `dry_run=false`를 선택한다.
4. `production` environment reviewer가 승인한다.
5. Workflow가 OIDC로 AWS role을 assume한다.
6. migration deploy → role grant apply → DB smoke → API/nginx rollout → health/metrics smoke 순서로 통과한다.
7. Evidence artifact와 CloudWatch/app logs를 확인한다.

## Fallback

OIDC 설정 전에는 수동 deploy 또는 SSM/SSH fallback을 사용할 수 있다. 이 경우에도 GitHub environment approval, credential rotation, secret value log 금지 원칙은 유지한다. Long-lived AWS access key를 repository secret의 기본 전략으로 두지 않는다.
