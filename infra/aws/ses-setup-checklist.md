# AWS SES setup checklist

이 문서는 KNU Roommate API production 인증/비밀번호 재설정 메일을 AWS SES로 발송하기 전에 운영자가 확인해야 하는 체크리스트다. App code는 `EMAIL_PROVIDER=ses`와 SESv2 `SendEmail` adapter를 사용하고, 실제 AWS resource 생성/도메인 DNS 변경/production access 요청은 운영자가 명시적으로 수행한다.

## Required env

Private `.env.api` 또는 Secrets Manager materialization 결과에는 아래 값이 있어야 한다.

```bash
EMAIL_PROVIDER=ses
SES_REGION=ap-northeast-2
SES_FROM_EMAIL=no-reply@example.com
SES_FROM_NAME=KNU Roommate
SES_REPLY_TO_EMAIL=support@example.com
SES_CONFIGURATION_SET=knu-roommate-production
```

- `SES_FROM_EMAIL`은 SES verified identity 범위에 포함되어야 한다.
- Application config에서는 `SES_CONFIGURATION_SET`을 비워둘 수 있지만 production release에서는 delivery/bounce/complaint event destination이 연결된 Configuration Set을 필수로 주입한다.
- secret 값은 Git commit, Docker image layer, application log, metric label에 남기지 않는다.

## Identity / DKIM / sandbox

1. SES region을 production API region과 맞춘다. 초기 기준은 `ap-northeast-2`다.
2. SES에서 domain identity 또는 sender email identity를 생성한다.
3. Domain identity를 선택하면 SES가 제공하는 DKIM DNS record를 DNS provider에 등록한다.
4. Identity verification 상태가 `verified`인지 확인한다.
5. Sandbox 상태에서는 실제 사용자 수신자가 verified identity가 아니면 발송이 실패한다. 실제 사용자 발송 전 SES production access를 요청한다.
6. 고정 outbound IP는 SES email sending 자체의 필수 조건이 아니다.

## IAM

API runtime role 또는 deploy-time credential에는 최소한 아래 권한만 부여한다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail"],
      "Resource": "*"
    }
  ]
}
```

초기에는 identity/resource ARN 조건을 운영 환경에 맞게 좁히는 것을 권장한다. IAM deny/invalid credential은 app security event에서 `ACCESS_DENIED` category로만 남긴다.

## Local/unit smoke

실제 AWS network 없이 payload mapping과 provider selection을 검증한다.

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts \
  src/auth/adapters/email/ses-email-sender.service.spec.ts \
  src/auth/adapters/email/ses-email-error.spec.ts \
  src/auth/adapters/email/email-sender.provider.spec.ts \
  src/auth/adapters/email/monitored-email-sender.service.spec.ts \
  --maxWorkers=50%
```

## Auth mail sandbox smoke

운영 credential과 verified sender가 준비된 뒤에만 수행한다.

1. Private `.env.api` 또는 shell에 `EMAIL_PROVIDER=ses`, `SES_REGION`, `SES_FROM_EMAIL`, `SES_CONFIGURATION_SET`, `AUTH_SES_SMOKE_RECIPIENT`를 설정한다.
2. `pnpm --dir apps/api auth:ses:smoke -- --dry-run`으로 설정 경계를 먼저 확인한다.
3. Sandbox 계정이면 수신자도 verified identity 또는 SES mailbox simulator 주소를 사용하고, `--dry-run` 없이 실행한다.
4. 출력에는 recipient나 raw provider error를 남기지 않고 bounded category만 기록한다.
5. SES API acceptance 뒤 Configuration Set destination에서 delivery/bounce/complaint event를 별도로 확인한다.
6. 실패 시 category 기준으로 대응한다.
   - `CONFIG_INVALID`: env/identity/config set 이름 확인.
   - `ACCESS_DENIED`: IAM/credential/role 확인.
   - `MESSAGE_REJECTED`: sender identity, sandbox 수신자, account paused/suspended 상태 확인.
   - `THROTTLED`: send quota/rate 확인.
   - `TRANSIENT`: AWS/network 일시 장애로 재시도/관측.

## Release gate

- `EMAIL_PROVIDER=stub`은 production에서 허용하지 않는다.
- `SES_FROM_EMAIL`은 verified identity여야 한다.
- Production access 해제 전에는 실제 사용자 발송을 release complete로 보지 않는다.
- Configuration Set delivery/bounce/complaint event destination이 없으면 release complete로 보지 않는다.
- 상세 command와 secret-free evidence 형식은 `infra/runbooks/auth-password-reset-release-evidence.md`를 따른다.
