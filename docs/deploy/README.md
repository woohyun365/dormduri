# Deploy documentation

`docs/deploy/`는 지금 적용한 production 운영 환경의 설명과 그 환경의 서버·도메인·메일 비용을 소유합니다. 배포·rollback·복구
절차는 [`infra/runbooks/`](../../infra/runbooks/README.md), 실행 가능한 runtime 구성은 [`infra/`](../../infra/README.md)가
소유하고 이 디렉터리는 그 문서를 링크만 합니다.

## 문서

- [운영 환경](./production-environment.md): 지금 적용한 Web 단계 구성(resource 종류·상태·확인하는 console 위치), 계정과 비용
  알림, 이후 단계에서 정할 입력
- [서버 비용](./server-costs.md): 지금 청구되는 항목의 공식 단가 근거, 실제 월 금액, 청구서 확인 주기

## 소유 범위

같은 값을 두 문서가 따로 갱신하지 않도록 아래처럼 나눕니다.

| 내용                                                                                                 | owner                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 지금 적용한 구성의 설명(resource 종류·상태·확인하는 console 위치)                                    | [운영 환경](./production-environment.md)                                                                                                 |
| 지금 청구되는 항목의 단가 근거, 실제 월 금액, 청구서 확인                                            | [서버 비용](./server-costs.md)                                                                                                           |
| Release gate가 판정에 쓰는 target 입력(container resource 값, 이후 단계 planning budget)과 실행 결과 | [Infrastructure target readiness](../../infra/runbooks/release/components/infrastructure-target/readiness.md)와 같은 디렉터리의 evidence |
| Runtime topology와 관측 도구 선택                                                                    | [Production runtime topology](../architecture/platform/production-runtime-topology.md)와 같은 디렉터리의 architecture 문서               |
| 배포·rollback·복구 절차                                                                              | [`infra/runbooks/`](../../infra/runbooks/README.md)                                                                                      |

이 디렉터리의 문서는 release evidence가 아닙니다. 실행 결과, operator, 수집 시각은 release evidence가 소유하고 여기에는 적지
않습니다.

## 식별자 규칙

이 저장소는 공개 저장소입니다. 이 디렉터리와 운영 기록은 아래 규칙을 따릅니다.

- 기록할 수 있는 값: 공개 도메인·host 이름, Region, Lightsail bundle 이름, ECR repository 이름(registry host 제외), image
  digest, commit SHA, workflow run URL, tag·Release 이름, SSM document 이름
- 기록하지 않는 값: AWS account ID(registry host와 ARN에 든 값 포함), IP 주소, instance·managed node ID, activation code·ID,
  access portal URL, email 주소, ACME account URI, secret과 인증 code. Git 밖 plan·evidence·log를 포함한 모든 기록(run 요약,
  PR·Issue·Release 본문, attestation, workflow artifact)에 적용합니다. 이런 값이 필요한 자리에는 "Owner console"이라고 적습니다.
- 두 목록 어디에도 없는 resource 이름(IAM role·permission set·SNS 주제·alarm·health check·event destination 이름 등)은 공개되는
  기록(tracked 문서, PR·Issue·Release 본문, run 요약, attestation, workflow artifact)에 적지 않고 resource 종류와 "Owner
  console"로 적습니다. 예외는 저장소의 설정·workflow 파일에 값으로 들어가는 이름입니다: SES 구성 세트 이름(application env
  `SES_CONFIGURATION_SET`의 값), GitHub environment 이름(workflow가 참조하는 값).
- GitHub 소유자·저장소 숫자 ID는 공개 API로 조회되지만 사람이 쓰는 기록에는 적지 않습니다. GitHub이 만드는 attestation 인증서와
  provenance에는 이 값이 들어가므로 attestation은 이 항목의 예외입니다.

문서를 commit하기 전에 금지 종류(숫자 12자리, `arn:aws:`, `dkr.ecr`, `mi-`·`i-` 뒤 hex, IPv4, email, `/acme/acct/`, UUID 형식
activation ID)가 없는지 확인합니다. 두 목록 밖 resource 이름은 pattern으로 찾을 수 없으므로 리뷰가 봅니다.
