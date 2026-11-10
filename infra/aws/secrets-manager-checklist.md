# AWS Secrets Manager checklist

이 문서는 API production secret을 AWS Secrets Manager에 묶음으로 저장하고, Lightsail user host의 API 배포 document가
host credential로 꺼내 read-only 파일로 설치하는 운영 checklist다. 실제 secret 원문은 이 문서, Git commit, issue, CI log,
`.artifacts/`에 남기지 않는다.

## 책임 용어

- **Secret origin**: 원본과 version을 소유하는 AWS Secrets Manager(아래 묶음 셋과 RDS가 관리하는 master secret).
- **Secret reader**: user host의 host role. SSM이 hybrid managed node에 주는 1시간 임시 credential이며, release plane 안의
  API 배포 document(`dormduri-api-deploy`)와 관측 배포가 묶음을 꺼낼 때만 쓴다.
- **Release principal**: GitHub protected environment가 OIDC로 받는 짧은 수명의 AWS IAM role. SSM document를 부를 뿐 secret을
  읽지 않는다.
- **Application read source**: API container에 read-only로 mount되는 release별 secret 파일.

Lightsail instance는 EC2 instance profile과 같은 workload service role을 제공하지 않는다. Host role credential은 SSM Agent가
받아 쓰는 임시 credential이고, host나 container에 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 같은 장기 credential을 저장하지
않는다.

## Source boundary

- 기본 local/test/docker path는 `SECRET_SOURCE=env`다. Private `.env.api`가 값을 직접 주입한다.
- Lightsail production path는 `SECRET_SOURCE=mounted-files`와 `SECRET_MOUNT_DIRECTORY`를 사용한다. 배포 document가 JSON 묶음을
  key별 파일로 풀어 둔다.
- `SECRET_SOURCE=aws-secrets-manager`는 EC2/ECS처럼 credential-provider chain을 안전하게 제공하는 runtime adapter 호환성을 위한
  경로이며 Lightsail production 기본값이 아니다. 이 adapter만 env key별 plain string(`SECRET_NAME_PREFIX/<ENV_KEY>`)을 읽는다.
- App-level retention/RRPD/vault payload 암호화 key rotation은 deployment secret storage와 다른 경계다.

## Secret 묶음

| Secret 이름                          | Key                                                                  | 읽는 주체                    |
| ------------------------------------ | -------------------------------------------------------------------- | ---------------------------- |
| `/dormduri/production/api/runtime`   | `infra/deploy/api/secret-mount.contract.json`의 `requiredFiles` 13개 | host role(API 배포 document) |
| `/dormduri/production/api/migration` | `MIGRATION_DATABASE_URL`                                             | host role(migrate one-off)   |
| `/dormduri/production/observability` | `SLACK_ALERT_WEBHOOK_URL`, `GRAFANA_ADMIN_PASSWORD`                  | host role(관측 배포)         |
| RDS 관리 master secret(이름은 RDS)   | master user                                                          | 사람(break-glass)만          |

- 각 묶음의 `SecretString`은 key를 이름으로 갖는 JSON object다. 값은 비어 있지 않은 문자열이다.
- runtime 묶음의 key 목록은 contract가 원본이고, contract는 `apps/api/src/config/composition/api-config.registry.ts`의 production
  required secret과 같다(`apps/api/test/operations/platform/lightsail-secret-delivery.spec.ts`).
- DB URL 형식: runtime 셋은 `sslmode=verify-full&sslrootcert=/etc/dormduri/rds-ca/root.pem`, migration은
  `sslmode=require&sslcert=/etc/dormduri/rds-ca/root.pem&sslaccept=strict`(`infra/db/README.md` RDS SSL / CA bundle).
- Prometheus scrape token은 runtime 묶음의 `METRICS_BEARER_TOKEN` 값을 같이 쓴다.
- KMS: Secrets Manager의 AWS managed key `aws/secretsmanager`를 쓴다. Customer-managed CMK는 key policy, rotation, 비용,
  break-glass 운영 절차가 준비된 뒤 별도 변경으로 도입하고, 그때 host role에 그 key의 `kms:Decrypt`를 더한다.

## Host 전달

API 배포 document(`infra/deploy/user/api/ssm/deploy-api.sh`)가 rollout 전에 다음을 한다.

1. Host role로 `get-secret-value`를 부르고 받은 JSON은 pipe로만 넘긴다. SSM 출력과 host log에 값이 남지 않는다.
2. `secret_bundle.py`(host의 `python3`, contract를 읽음)가 `/opt/dormduri/secrets/api/releases/<release>`에 key별 파일을 쓴다.
   파일 0400, 디렉터리 0500, 소유 10001:10001이다. 이름·mode·크기·symlink·빠진 key·여분 key를 검사하고, 그 판정은 Node 구현
   (`infra/deploy/scripts/*-api-secret-bundle.sh`, rehearsal·fixture 경로)과 같다
   (`apps/api/test/operations/platform/secret-bundle-parity.spec.ts`).
3. 새 API container에 그 release를 read-only로 mount한다(`/run/secrets/dormduri-api`). Readiness와 host 안 smoke가 통과한 뒤에만
   `current` link를 그 release로 바꾼다.
4. 남기는 release는 `current`와 그 직전 성공 release 둘이다(contract `minimumRetainedReleases`). Readiness까지 가지 못한 release는
   그 실패 처리에서 지운다. 그래서 실패가 이어져도 돌고 있는 release는 지워지지 않는다.
5. Migration 묶음은 release 디렉터리에 두지 않는다. migrate one-off 직전에 root 전용 임시 디렉터리(0700)에
   `MIGRATION_DATABASE_URL`과 role smoke가 쓰는 runtime DB URL 셋을 0400·10001 파일로 쓰고, migrate container에만 파일 단위
   read-only로 mount한 뒤 그 단계가 끝나면 성공·실패와 관계없이 지운다. API container에는 mount하지 않는다.
6. API bootstrap이 Nest `AppModule`을 import하기 전에 mount된 required secret을 읽어 process env에 적용한다. Bootstrap failure는
   bounded code만 stderr에 남기고 secret name/value나 raw provider payload를 출력하지 않는다. Config registry validation이
   placeholder/local default를 fail-fast한다.

## IAM

- Host role: `infra/aws/iam/host-role.secrets-read.json`. 위 묶음 셋의 `secretsmanager:GetSecretValue`만 허용한다(resource는 이름
  뒤에 Secrets Manager가 붙이는 6자 suffix를 받는 `-??????`). RDS 관리 master secret과 다른 secret은 읽지 못한다.
- GitHub OIDC role(web·api의 publish·deploy): secret 읽기 권한이 없다. `scripts/infra/aws/policy-templates.mjs`가 정책 원본을
  대조한다.

## 만들기·값 바꾸기

값이 shell history나 process 목록에 남지 않게 0600 임시 파일을 `file://`로 넘기고 바로 지운다. 실제 운영에서는 보안 승인된
terminal을 사용한다.

```bash
umask 077
"${EDITOR:-vi}" bundle.json   # {"KEY": "value", ...} 형식으로 쓴다
aws secretsmanager put-secret-value --region ap-northeast-2 \
  --secret-id /dormduri/production/api/runtime --secret-string file://bundle.json
rm -f bundle.json
```

처음 만들 때는 같은 형식으로 `create-secret --name <secret 이름> --secret-string file://bundle.json`을 쓴다.

## Account-free dry-run

Secret inventory dry-run은 값을 읽거나 출력하지 않고, 코드 registry 기준 env key와 mount contract만 확인한다.

```bash
SECRET_SOURCE=mounted-files \
NODE_ENV=production \
SECRET_MOUNT_DIRECTORY=/run/secrets/dormduri-api \
pnpm --dir apps/api secrets:inventory
```

`.env.api.lightsail`에는 `SECRET_SOURCE=mounted-files`, `SECRET_MOUNT_DIRECTORY`, non-secret runtime key만 둔다. AWS credential은
두지 않는다.

## Rotation / rollback

- 값 교체: `put-secret-value`로 새 version을 `AWSCURRENT`로 만든 뒤 API 배포 document를 지금 digest로 다시 실행한다(`deploy`).
  Document는 `deploy`·`rollback` 모두 `AWSCURRENT`를 다시 꺼내 새 secret release로 설치한다.
- Database credential: RDS role 비밀번호 변경, 묶음 갱신, API 배포 document 실행을 같은 change window에 묶는다. 그 사이 옛
  비밀번호로 도는 container는 새 연결을 열지 못한다.
- Secret value rollback: 직전 version을 `AWSCURRENT`로 되돌린(`update-secret-version-stage`) 뒤 document를 다시 실행한다. Image
  rollback(`rollback`)은 secret 값을 되돌리지 않는다.
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
