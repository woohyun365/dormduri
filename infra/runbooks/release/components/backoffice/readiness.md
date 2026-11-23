# BackOffice deployment readiness handoff

## 상태와 책임

- Repository state: `PENDING_TARGET`(최종 release 판정 전이라는 뜻이고 실패가 아니다). 2026-11-23에 운영 백오피스 host에 첫 배포했다
  (단계 기록 Release `deploy-backoffice-20261123-1`).
- 구현: BackOffice Web(`apps/backoffice-web`)·API(`apps/backoffice-api`), 백오피스 host 묶음(`infra/deploy/backoffice/`)과 CD
  (`.github/workflows/backoffice-cd.yml`)가 저장소에 있다.
- 결정된 target topology: **User App 4GiB host + BackOffice 2GiB host + managed PostgreSQL**
- 비용·resource source of truth:
  [`infrastructure-target-release-readiness.md`](../infrastructure-target/readiness.md)
- topology 결정 근거:
  [`production-runtime-topology.md`](../../../../../docs/architecture/platform/production-runtime-topology.md)
- 배포·rollback·운영자 접속·경보 대응 절차: [백오피스 단계 배포](../../backoffice-stage-deploy.md)

이 문서는 사용자 제품과 운영자 제품을 같은 host에 관성적으로 합치지 않도록 경계를 전달하고 운영 배포 전 남은 확인을 적는다. 실제
provider, instance, network와 비용은 배포 때 다시 확인하고 target evidence 형식으로
[실제 값의 기록 위치](../../production-release-evidence.md#실제-값의-기록-위치)에 남긴다. 식별자는
[식별자 규칙](../../../../../docs/deploy/README.md#식별자-규칙)을 따른다.

## 목표 repository 구조

```text
apps/
├── web/                 # 사용자 Next.js
├── api/                 # 사용자 NestJS
├── backoffice-web/      # 운영자 Next.js(BFF)
└── backoffice-api/      # 운영자 NestJS

infra/deploy/
├── user/                # User App host 묶음
├── backoffice-web/      # 운영자 Web image
├── backoffice-api/      # 운영자 API image·entrypoint·secret mount 계약
└── backoffice/          # 백오피스 host 묶음(compose·admin ingress·Alloy·SSM document)
```

지금 구조가 이 목표와 같다. 사용자 묶음과 백오피스 묶음은 CD workflow·경로 filter·image inventory 항목·environment·role·
rollback 기록을 따로 둔다.

## 배포 단위 경계

사용자 제품과 BackOffice는 다음 항목을 독립적으로 소유한다.

- OCI image와 immutable digest(ECR `dormduri/backoffice-api`·`dormduri/backoffice-web`·`dormduri/backoffice-ingress`)
- runtime env manifest와 secret namespace(`/dormduri/production/backoffice`)
- deploy/pull principal과 최소 권한 IAM role(`infra/aws/iam/backoffice-*`)
- ingress, firewall과 canonical host(admin ingress `127.0.0.1:4300`, 고정 origin `http://localhost:4300`)
- health/readiness, rollout, previous safe digest와 rollback(`dormduri-backoffice-deploy`)
- 로그의 `service` label과 지표 job(`backoffice-api`·`backoffice-probe`·`backoffice-host`)

BackOffice host는 public product ingress를 재사용하지 않는다. 운영자 접근은 SSM 포트 포워딩 하나이고 host에 들어오는 공개 port가
없다. 단순히 별도 container로 실행하는 것은 host 장애·memory pressure·권한 침해를 격리하지 못하므로 목표 topology로 인정하지 않는다.

## Database와 migration 경계

- 사용자 API와 BackOffice API가 같은 release에서 migration을 각각 실행하지 않는다. 백오피스 API는 migration을 실행하지 않고,
  `backoffice-cd`의 schema gate가 같은 commit의 `api-cd` 배포 성공(또는 마지막 API 배포와 같은 schema)을 확인한 뒤에만 rollout한다.
- 단일 release migration owner(`api-cd`의 migrate one-off)가 schema migration과 role grant를 한 번만 수행한다.
- BackOffice API는 browser가 아니라 별도 최소 권한 DB credential(`dormduri_backoffice`·`dormduri_backoffice_retention`)을 소유한다.
- 관리자 조회·변경은 capability guard와 actor/action/target/outcome 감사 기록을 남긴다.
- 백오피스 pool(runtime 5·정리 1)은 사용자 transaction pool과 따로이고 connection 예산 안에 있다
  ([Connection budget](../../../../db/README.md#connection-budget)).

## Resource와 비용 입력

BackOffice container resource(local rehearsal 측정값 포함), host headroom, provider 가격과 전체 배포 예산은
[`infrastructure-target-release-readiness.md`](../infrastructure-target/readiness.md)가 단독 소유한다. 이 handoff에서는 같은 숫자를
복제하지 않는다.

## Observability 연결

- BackOffice API metric·readiness probe·host 지표는 백오피스 host Alloy가 긁어 user host 수신 gateway로 remote write한다(백오피스
  host에 들어오는 port가 없어 user host가 scrape하지 않는다).
- BackOffice Web/API·admin ingress stdout은 백오피스 host Alloy가 중앙 Loki로 전달한다.
- Grafana에 사용자 제품과 분리된 label(`service=~"backoffice-.*"`)과 경보(`backoffice-alerts.yml`)를 둔다.
- 운영 로그·metric은 Grafana에서 보고, 신고·제재·문의·시즌 운영 같은 durable 제품 데이터는 BackOffice UI/API가 소유한다.
- Loki/Prometheus raw query를 BackOffice 제품 API로 재노출하지 않는다. 필요한 경우 Grafana dashboard deep link만 제한적으로
  제공한다.

## 배포 checklist

저장소 쪽 준비(앱·host 묶음·CD·경보·local rehearsal)와 첫 배포는 끝났다(2026-11-23).

1. [백오피스 단계 배포](../../backoffice-stage-deploy.md#첫-실행-전-owner-확인)의 첫 실행 전 Owner 확인(ECR·role·environment·
   document·secret 묶음·수신 gateway·bootstrap SQL 재실행·host의 AWS CLI·운영자 permission set). 끝남.
2. 첫 배포 뒤 첫 owner 등록, 로그인·재인증·권한 요청·감사 smoke, 외부에서 백오피스 host 공인 IP의 TCP port 닫힘, CloudTrail의
   `StartSession` 기록, 경보 시험(잠금·recovery 로그인). 단계 기록 Release와 단계 이슈 댓글에 남겼다.
3. 남은 것: rollback 확인(직전 묶음이 생기는 두 번째 배포 뒤 `rollback` 실행), 첫 전체 달 청구서의 실제 월 비용, 그리고 최종
   release 때 digest·rollback evidence를 release evidence 형식으로 실제 값의 기록 위치에 남긴다. 식별자는 식별자 규칙을 따른다.

## 중단 조건

- BackOffice가 사용자 session/capability를 그대로 신뢰한다.
- 관리자 API 또는 Grafana/Loki/Prometheus port가 public internet에 직접 노출된다.
- 백오피스 host Docker Engine이 loopback publish 보호 하한 밖이거나 보호를 끈 설정이 있다.
- User API와 BackOffice API가 migration ownership을 공유하지 못한다.
- 관리자 action audit과 최소 권한 DB role이 없다.
- User App 장애와 BackOffice 장애를 독립적으로 rollback할 수 없다.
