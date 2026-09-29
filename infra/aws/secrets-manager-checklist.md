# AWS Secrets Manager checklist

이 문서는 API production secret을 AWS Secrets Manager에 저장하고 Lightsail release plane에서
read-only file bundle로 materialize하기 위한 운영 checklist다. 실제 secret 원문은 이 문서, Git commit,
issue, CI log, `.artifacts/`에 남기지 않는다.

## 책임 용어

- **Secret origin**: 원본과 version을 소유하는 AWS Secrets Manager.
- **Release principal**: GitHub protected environment가 OIDC로 획득하는 짧은 수명의 AWS IAM role.
- **Application read source**: Lightsail API container에 read-only로 mount되는 versioned secret files.

Lightsail instance는 EC2 instance profile과 같은 workload service role을 제공하지 않는다. 따라서 host나
container에 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 같은 장기 credential을 저장하지 않는다.

## Source boundary

- 기본 local/test/docker path는 `SECRET_SOURCE=env`다. Private `.env.api`가 값을 직접 주입한다.
- Lightsail production path는 `SECRET_SOURCE=mounted-files`와 `SECRET_MOUNT_DIRECTORY`를 사용한다.
- `SECRET_SOURCE=aws-secrets-manager`는 EC2/ECS처럼 credential-provider chain을 안전하게 제공하는
  runtime adapter 호환성을 위한 경로이며 Lightsail production 기본값이 아니다.
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

owner-local env definition을 조합하는
`apps/api/src/config/composition/api-config.registry.ts`에서 `secret: true`로 등록된 key가 inventory
source of truth다. `SECRET_SOURCE=aws-secrets-manager`를 production에서 선택하면
`SECRET_NAME_PREFIX`는 필수다.

## KMS policy

- 초기 production 기본값은 Secrets Manager의 AWS managed key `aws/secretsmanager`다.
- Customer-managed CMK는 key policy, rotation, 비용, break-glass 운영 절차가 준비된 뒤 별도 변경으로 도입한다.
- Secret 생성 시 KMS key를 별도로 지정하지 않으면 AWS managed key 경로를 사용한다.

## IAM minimum policy shape

GitHub OIDC release materializer role은 필요한 prefix에만 접근한다.

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

## Account-free dry-run / smoke

Secret inventory dry-run은 값을 읽거나 출력하지 않고, 코드 registry 기준 env key와 Secrets Manager name mapping만 확인한다.

```bash
SECRET_SOURCE=mounted-files \
NODE_ENV=production \
SECRET_MOUNT_DIRECTORY=/run/secrets/knu-roommate-api \
pnpm --dir apps/api secrets:inventory
```

1. `.env.api.lightsail`에는 `SECRET_SOURCE=mounted-files`, `SECRET_MOUNT_DIRECTORY`, non-secret runtime
   key만 둔다. AWS credential은 두지 않는다.
2. GitHub OIDC release job이 Secrets Manager 값을 runner temporary directory에서 materialize하고,
   candidate bundle을 Lightsail versioned directory로 전송한다.
3. Candidate 검증 성공 후에만 host `current` pointer를 atomic하게 전환한다.
4. API bootstrap이 Nest `AppModule`을 import하기 전에 mounted required secret을 읽어 process env에
   적용한다. Container entrypoint는 값이 아니라 mount directory와 file contract만 확인한다.
5. Bootstrap failure는 bounded code만 stderr에 기록하며 secret name/value나 raw provider payload를
   출력하지 않는다.
6. Config registry validation이 materialization 이후 production required secret과 placeholder/local
   default를 fail-fast하는지 확인한다.
7. API container boot log에 secret value, DB URL password, token 원문이 없는지 확인한다.
8. Candidate `/health/ready`가 통과하면 activation을 허용한다.

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
| `INVALID_PATH`       | mount root 밖 경로 또는 잘못된 이름 | bundle generator와 contract 확인            |
| `UNSAFE_FILE`        | symlink 또는 regular file 아님      | host 설치 mode와 bundle 교체                |
| `TOO_LARGE`          | file size 상한 초과                 | 잘못된 bundle 제거 후 재materialize         |
| `UNKNOWN`            | 분류되지 않은 오류                  | raw value 없이 bounded 로그로 조사          |
