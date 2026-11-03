# AWS SES setup checklist

이 문서는 돔두리 API의 인증/비밀번호 재설정 메일을 AWS SES로 발송하기 전에 운영자가 확인해야 하는 체크리스트다. App code는 `EMAIL_PROVIDER=ses`와 SESv2 `SendEmail` adapter를 사용하고, 실제 AWS resource 생성/도메인 DNS 변경/production access 요청은 운영자가 명시적으로 수행한다.

지금 적용한 SES 구성(identity, 구성 세트, event destination, sandbox 상태, 요금 plan)은 [Production environment](../../docs/deploy/production-environment.md)의 메일 행이 소유하고, 이 문서는 준비·시험 절차와 release 조건을 소유한다. 이 문서와 그 실행 기록은 [식별자 규칙](../../docs/deploy/README.md#식별자-규칙)을 따른다. 아래 주소·account·ARN은 placeholder이고 실제 값은 private env와 Owner console에만 둔다.

## Required env

Private `.env.api` 또는 Secrets Manager materialization 결과에는 아래 값이 있어야 한다.

```bash
EMAIL_PROVIDER=ses
SES_REGION=ap-northeast-2
SES_FROM_EMAIL=no-reply@example.com
SES_FROM_NAME=돔두리
SES_REPLY_TO_EMAIL=support@example.com
SES_CONFIGURATION_SET=dormduri-production
```

- `SES_FROM_EMAIL`은 SES verified identity 범위에 포함되어야 한다.
- Application config에서는 `SES_CONFIGURATION_SET`을 비워둘 수 있지만 production release에는 bounce·complaint·reject·delivery delay·rendering failure event destination과 Delivery CloudWatch event destination이 연결된 구성 세트를 둔다. delivery는 메일마다 생기므로 사람 메일함으로 보내지 않고 받는 사람 주소가 없는 CloudWatch 지표로 본다([Delivery 지표](#delivery-지표-cloudwatch-event-destination)).
- secret 값은 Git commit, Docker image layer, application log, metric label에 남기지 않는다.

## 요금 plan

- SES 요금은 plan 단위다. 2026-07-21부터 새 계정(과 2025-06-01 이후 SES 사용 기록이 없는 계정·Region 조합)의 기본 plan은 Essentials이고 고정 월요금이 없다. 보낸 메일 수만큼 단가가 붙는다.
- Mailbox simulator로 보낸 메일도 일반 수신자에게 보낸 메일과 같은 단가로 청구된다.
- SNS event destination의 알림은 SNS 요금이 따로 붙는다.
- 구성 세트의 CloudWatch event destination은 지표마다 CloudWatch 요금이 붙는다. SES 기본 계정 지표는 무료다.
- 단가와 실제 월 금액은 [서버 비용](../../docs/deploy/server-costs.md)이 소유한다. 근거: [SES pricing](https://aws.amazon.com/ses/pricing/)(2026-10-31 확인).

## Identity / DKIM / sandbox

1. SES region을 production API region과 맞춘다. 초기 기준은 `ap-northeast-2`다. Identity와 sandbox 상태는 Region마다 따로다.
2. SES에서 domain identity를 생성한다. 돔두리는 `dormduri.com` domain identity를 쓴다.
3. Domain identity의 Easy DKIM DNS record를 DNS provider(Route 53 hosted zone)에 등록한다.
4. Identity verification 상태와 DKIM 상태가 성공인지 확인한다.
5. Sandbox 상태에서는 확인된 주소·domain과 mailbox simulator에만 보낼 수 있다. 실제 사용자 발송 전 SES production access를 요청한다.
6. 고정 outbound IP는 SES email sending 자체의 필수 조건이 아니다.

## 결과 알림: SNS event destination

구성 세트의 SNS event destination이 결과 event를 SNS 주제로 보내고, 운영자는 그 주제의 email 구독으로 받는다. Event destination·주제 이름, 주제 Region과 구독 주소는 Owner console에 있다.

1. SNS 주제는 **Standard**로 만든다. SES는 FIFO 주제를 지원하지 않는다.
2. 주제 접근 정책에 SES의 `sns:Publish`를 허용하고 `AWS:SourceAccount`와 `AWS:SourceArn`(구성 세트 ARN)으로 좁힌다. `<...>`는 placeholder다.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "ses.amazonaws.com" },
         "Action": "sns:Publish",
         "Resource": "arn:aws:sns:<topic-region>:<account-id>:<topic-name>",
         "Condition": {
           "StringEquals": {
             "AWS:SourceAccount": "<account-id>",
             "AWS:SourceArn": "arn:aws:ses:<ses-region>:<account-id>:configuration-set/dormduri-production"
           }
         }
       }
     ]
   }
   ```

3. 주제를 AWS KMS로 암호화하면 customer managed key를 쓰고, 그 key 정책에 `ses.amazonaws.com`의 `kms:GenerateDataKey*`·`kms:Decrypt`를 허용한다. 이 권한이 없으면 SES가 주제에 publish하지 못한다.
4. 구성 세트에 SNS event destination을 더하고 event 종류로 Bounce, Complaint, Reject, Delivery delay, Rendering failure를 고른다. Delivery는 메일마다 생기므로 고르지 않고 아래 [Delivery 지표](#delivery-지표-cloudwatch-event-destination)로 본다.
5. 주제에 email 구독을 만들면 확인 메일이 온다. 구독을 확인해야 알림이 오므로 SNS console에서 구독 상태가 confirmed인지 본다.
6. 연결은 아래 [Auth mail sandbox smoke](#auth-mail-sandbox-smoke)의 simulator 발송으로 확인한다.

알림 본문(JSON)에는 event 종류와 관계없이 원래 메일의 받는 사람 주소(`mail.destination`)가 담기고, bounce·complaint·delivery delay 알림은 수신자별 주소도 담는다. 구독 주소는 Owner가 고른 운영자 메일함이다. Incident evidence·이슈·PR에는 주소를 옮기지 않고 bounded outcome만 적는다([계정 인증 정책](../../docs/policies/account-authentication.md#abuseauditsecurity-eventmail-monitoring-baseline)). 이 메일함의 처리위탁 기록과 보존 기간은 개인정보 처리위탁 문서 작업(#289)이 정한다.

근거: [SNS event destination](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-add-event-destination-sns.html), [Configuring SNS notifications](https://docs.aws.amazon.com/ses/latest/dg/configure-sns-notifications.html), [SNS encryption key](https://docs.aws.amazon.com/sns/latest/dg/sns-key-management.html#compatibility-with-aws-services), [SNS event 본문](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html)(2026-10-31 확인).

## Delivery 지표: CloudWatch event destination

Delivery는 메일마다 생기므로 사람 메일함으로 보내지 않고, 같은 구성 세트의 CloudWatch event destination으로 받는 사람 주소가 없는 지표만 남긴다. 지금 구성에는 없고 API 단계 auth release 준비 때 더한다. 지금 상태는 [Production environment](../../docs/deploy/production-environment.md) 메일 행이 소유한다.

1. 구성 세트에 CloudWatch event destination을 더하고 event 종류로 Delivery만 고른다.
2. Dimension은 하나만 둔다. Value source는 Message Tag, dimension 이름은 SES auto-tag `ses:configuration-set`, 기본값은 `dormduri-production`이다. CloudWatch에는 dimension 값과 count만 가고 받는 사람 주소는 가지 않는다.
3. Event 종류·dimension 이름·값의 조합마다 지표가 하나 생기고 지표마다 CloudWatch 요금이 붙는다. 위 구성은 지표 하나다.
4. SES 기본 계정 지표는 구성 세트 event publishing이 아니고, simulator 발송이 거기에 세어지는지는 공식 문서에 없다. 그래서 release 근거로 쓰지 않는다.

근거: [CloudWatch event destination](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-add-event-destination-cloudwatch.html)(2026-10-31 확인).

## Feedback forwarding과 받는 곳

- SES identity의 email feedback forwarding은 기본으로 켜져 있다. 켜져 있으면 SES가 bounce·complaint 알림 메일을 보낸 쪽 주소로 보낸다. App은 `SendEmail`에 feedback 주소(`FeedbackForwardingEmailAddress`)를 주지 않으므로 그 주소는 From 주소(`SES_FROM_EMAIL`)다.
- From 주소가 받는 메일함이 없는 발신 전용 주소이면 forwarding된 알림은 아무도 읽지 못한다. 그래서 결과 알림의 원본은 위 SNS event destination이다.
- Forwarding을 끄려면 bounce·complaint를 SNS나 event publishing으로 받고 있어야 하고, event publishing이면 모든 발송에 그 구성 세트가 붙어야 한다(위 Required env). 받는 방법이 하나도 없으면 SES는 forwarding을 꺼도 From 쪽 주소로 알림을 보낸다.
- MAIL FROM·DMARC와 함께 정할 것(API 단계 auth release 준비):
  - forwarding을 끌지, 아니면 받는 메일함이 있는 feedback 주소를 둘지
  - custom MAIL FROM domain을 둘지. SES 기본 MAIL FROM은 `amazonses.com` 아래 domain이라 SPF가 From domain과 정렬되지 않는다
  - From domain의 DMARC 정책. DMARC는 SPF와 DKIM 중 하나만 From domain과 정렬돼도 통과한다. From 주소가 `dormduri.com`이면 Easy DKIM 서명 domain과 정렬된다
- 값은 그 단계의 준비 작업이 정하고, 정해지면 이 절과 [Production environment](../../docs/deploy/production-environment.md) 메일 행을 함께 고친다.

근거: [Email feedback forwarding](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-email.html), [SendEmail API v2](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html), [DMARC](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html)(2026-10-31 확인).

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
3. Sandbox 계정이면 수신자로 SES mailbox simulator 주소(`success`·`bounce`·`complaint` 뒤에 `@simulator.amazonses.com`)를 쓰고, `--dry-run` 없이 실행한다.
4. 출력에는 recipient나 raw provider error를 남기지 않고 bounded category만 기록한다.
5. SES API 접수 뒤 결과 event를 확인한다. Simulator 주소마다 생기는 event와 release 구성(SNS event destination 5종, Delivery CloudWatch event destination)에서 보이는 곳은 아래와 같다. Delivery CloudWatch event destination을 더하기 전에는 Delivery를 확인할 곳이 없다.

   | Simulator 수신자 | 생기는 event             | 확인하는 곳                                                               |
   | ---------------- | ------------------------ | ------------------------------------------------------------------------- |
   | success          | Delivery 1               | 구성 세트 CloudWatch Delivery 지표                                        |
   | bounce           | Bounce 1                 | SNS 구독 email                                                            |
   | complaint        | Delivery 1 + Complaint 1 | Complaint는 SNS 구독 email, Delivery는 구성 세트 CloudWatch Delivery 지표 |

   Simulator 발송도 일반 발송과 같은 단가로 청구되고, 일일 발송 한도(sending quota)에는 세지 않는다. 초당 최대 발송률에는 묶인다. Simulator는 bounce 주소를 suppression list에 넣지 않고, bounce·complaint 비율과 reputation 지표에도 반영하지 않는다. Reject는 simulator 주소가 없다.

6. 실제 받는 메일함 시험은 simulator로 확인한 뒤 필요할 때만 한다. Sandbox에서는 그 받는 주소를 SES email identity로 만들고 확인 메일의 link로 확인한 뒤 보낸다. 시험이 끝나면 그 email identity를 지운다. 남겨 두면 그 주소를 From으로 쓸 수 있다.
7. 실패 시 category 기준으로 대응한다.
   - `CONFIG_INVALID`: env/identity/config set 이름 확인.
   - `ACCESS_DENIED`: IAM/credential/role 확인.
   - `MESSAGE_REJECTED`: sender identity, sandbox 수신자, account paused/suspended 상태 확인.
   - `THROTTLED`: send quota/rate 확인.
   - `TRANSIENT`: AWS/network 일시 장애로 재시도/관측.

근거: [Mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html#send-email-simulator), [Sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [Email address identity](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html), [Monitoring sending activity](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity.html)(2026-10-31 확인).

## Release gate

- `EMAIL_PROVIDER=stub`은 production에서 허용하지 않는다.
- `SES_FROM_EMAIL`은 verified identity여야 한다.
- Production access 해제 전에는 실제 사용자 발송을 release complete로 보지 않는다.
- Production release에는 bounce·complaint·reject·delivery delay·rendering failure event destination과 Delivery CloudWatch event destination이 연결된 구성 세트를 둔다. 이 구성 세트가 없으면 release complete로 보지 않는다. delivery는 메일마다 생기므로 사람 메일함으로 보내지 않고 받는 사람 주소가 없는 CloudWatch 지표로 본다.
- 상세 command와 secret-free evidence 형식은 `infra/runbooks/release/components/auth/password-reset-evidence.md`를 따른다.
