# AWS Secrets Manager checklist

이 문서는 API production secret을 AWS Secrets Manager에 저장하고, 배포 시점에 `.env.api` 또는 process env로 materialize하기 위한 운영 checklist다. 실제 secret 원문은 이 문서, Git commit, issue, CI log, `artifacts/local/`에 남기지 않는다.

## Source boundary

- 기본 local/test/docker path는 `SECRET_SOURCE=env`다. Private `.env.api` 또는 GitHub environment secrets가 값을 직접 주입한다.
- AWS 경로는 `SECRET_SOURCE=aws-secrets-manager`와 `SECRET_NAME_PREFIX`를 함께 사용한다.
- Secret value convention은 **env key별 plain string**이다. JSON object bundle secret은 Phase 2 boundary에 포함하지 않는다.
- App-level retention/RRPD/vault payload 암호화 key rotation은 deployment secret storage와 다른 경계다.

## Secret name convention

기본 convention:

```txt
/knu-roommate/<environment>/api/<ENV_KEY>
```

Production 예시:

```txt
SECRET_NAME_PREFIX=/knu-roommate/production/api
/knu-roommate/production/api/DATABASE_URL
/knu-roommate/production/api/VERIFICATION_CODE_HMAC_SECRET
/knu-roommate/production/api/AUTH_PERSISTENCE_HMAC_SECRET
/knu-roommate/production/api/AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64
```

`apps/api/src/config/env-keys`에서 `secret: true`로 등록된 key가 inventory source of truth다. `SECRET_SOURCE=aws-secrets-manager`를 production에서 선택하면 `SECRET_NAME_PREFIX`는 필수다.

## KMS policy

- 초기 production 기본값은 Secrets Manager의 AWS managed key `aws/secretsmanager`다.
- Customer-managed CMK는 key policy, rotation, 비용, break-glass 운영 절차가 준비된 뒤 별도 변경으로 도입한다.
- Secret 생성 시 KMS key를 별도로 지정하지 않으면 AWS managed key 경로를 사용한다.

## IAM minimum policy shape

App instance 또는 deploy materializer role은 필요한 prefix에만 접근한다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:/knu-roommate/production/api/*"
    }
  ]
}
```

Customer-managed CMK를 쓰면 같은 role에 해당 key의 `kms:Decrypt` permission도 필요하다. AWS managed key 경로에서는 별도 CMK policy를 작성하지 않는다.

## Manual create / update commands

값은 shell history에 남을 수 있으므로 실제 운영에서는 보안 승인된 terminal/session manager를 사용하고 history 저장을 끈다. 아래 명령의 값은 placeholder다.

```bash
export AWS_REGION=ap-northeast-2
export SECRET_NAME_PREFIX=/knu-roommate/production/api

aws secretsmanager create-secret \
  --region "$AWS_REGION" \
  --name "$SECRET_NAME_PREFIX/DATABASE_URL" \
  --secret-string 'postgresql://app_user:REPLACE_WITH_PASSWORD@rds-private-endpoint:5432/knu_roommate?schema=public'

aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_NAME_PREFIX/DATABASE_URL" \
  --secret-string 'postgresql://app_user:REPLACE_WITH_ROTATED_PASSWORD@rds-private-endpoint:5432/knu_roommate?schema=public'
```

반복 생성 대상은 코드 registry의 `secretEnvKeys`와 동일해야 한다.

## Dry-run / smoke

Secret inventory dry-run은 값을 읽거나 출력하지 않고, 코드 registry 기준 env key와 Secrets Manager name mapping만 확인한다.

```bash
SECRET_SOURCE=aws-secrets-manager \
NODE_ENV=production \
SECRET_NAME_PREFIX=/knu-roommate/production/api \
pnpm --dir apps/api secrets:inventory
```

1. `.env.api`에는 `SECRET_SOURCE=aws-secrets-manager`, `SECRET_NAME_PREFIX=/knu-roommate/production/api`, AWS credential/role binding만 둔다.
2. Materializer 또는 deploy script가 각 secret을 읽어 env key 이름으로만 report한다. 값은 출력하지 않는다.
3. `env.validation.ts`가 production required secret과 placeholder/local default를 fail-fast하는지 확인한다.
4. API container boot log에 secret value, DB URL password, token 원문이 없는지 확인한다.
5. `/health/ready`가 통과하면 secret materialization smoke를 완료한다.

## Rotation / rollback

- Rotation은 secret별 `put-secret-value` 후 staging deployment smoke를 먼저 수행한다.
- Database credential rotation은 RDS role password 변경, Secrets Manager value 갱신, API/nginx rollout 순서를 같은 change window에 묶는다.
- Rollback은 이전 secret version 또는 이전 image tag 중 어느 쪽이 원인인지 분리한다.
- Secret value rollback을 수행해도 Git history나 report에 원문을 남기지 않는다.

## Failure taxonomy

API code는 AWS error를 bounded category로만 노출한다.

| Category             | 의미                                | 운영 대응                                   |
| -------------------- | ----------------------------------- | ------------------------------------------- |
| `MISSING`            | secret name이 없거나 값이 비어 있음 | name prefix와 secret inventory 확인         |
| `ACCESS_DENIED`      | IAM/role/region/account 불일치      | role policy, task/instance profile 확인     |
| `DECRYPTION_FAILURE` | KMS decrypt 실패                    | KMS key policy와 secret encryption key 확인 |
| `THROTTLED`          | Secrets Manager API rate 제한       | retry/backoff, deploy fanout 축소           |
| `TRANSIENT`          | AWS internal/timeout 계열           | retry, AWS status 확인                      |
| `UNSUPPORTED_BINARY` | SecretBinary 사용                   | plain `SecretString`으로 재저장             |
| `UNKNOWN`            | 분류되지 않은 오류                  | raw value 없이 bounded 로그로 조사          |
