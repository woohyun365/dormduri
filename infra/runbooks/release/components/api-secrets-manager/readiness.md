# API Secrets Manager release readiness

## 책임과 상태

이 문서는 AWS Secrets Manager origin과 GitHub OIDC release principal의 미래 production 입력을
소유한다. 실제 AWS resource가 없으므로 현재 상태는 `PENDING_TARGET`다.

## Release 입력

| 입력                            | 현재 값                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| AWS account / region            | `PENDING_TARGET`                                              |
| Secret prefix                   | `/knu-roommate/production/api` 후보, 실제 값 `PENDING_TARGET` |
| KMS key                         | 초기 `aws/secretsmanager`, 실제 확인 `PENDING_TARGET`         |
| GitHub protected environment    | `PENDING_TARGET`                                              |
| GitHub OIDC provider / role ARN | `PENDING_TARGET`                                              |
| Rotation / break-glass owner    | `PENDING_TARGET`                                              |
| CloudTrail audit destination    | `PENDING_TARGET`                                              |

## 준비 절차

1. GitHub OIDC provider와 repository·environment·branch 조건을 제한한 IAM trust policy를 만든다.
2. Release role에는 승인된 prefix의 `secretsmanager:GetSecretValue`만 허용한다.
3. Customer-managed KMS key를 선택한 경우에만 해당 key의 `kms:Decrypt`를 추가한다.
4. GitHub environment approval owner와 release job timeout을 확정한다.
5. CloudTrail에서 secret value가 아닌 API 호출 주체·시각·resource identifier를 확인한다.
6. Runner temporary directory에서 bundle을 만들고 artifact upload 대상에서 제외한다.

## 중단 조건

- Lightsail host/container에 장기 AWS access key를 저장해야 한다.
- IAM trust가 repository와 protected environment로 제한되지 않는다.
- Secret prefix 밖 resource를 읽을 수 있다.
- Rotation, rollback 또는 CloudTrail 확인 owner가 없다.
