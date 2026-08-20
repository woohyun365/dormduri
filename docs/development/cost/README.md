# Owner cost tracking

이 디렉터리는 1인 개발자·운영자가 제품 개발과 운영에 부담하는 비용을 월별로 이해하기 위한 human-owned ledger를
소유합니다. Architecture는 비용을 발생시키는 구조적 결정을 설명하고, release readiness는 미래 provider·instance의
승인 전 입력을 소유하며, 이 디렉터리는 실제 결제와 프로젝트 귀속 비용을 구분합니다.

- [Owner monthly costs](./owner-monthly-costs.md): current/future/optional 비용, gross cash, personal baseline,
  project-attributable delta와 usage discount/net

결제수단, invoice identifier, 주소, 세금 식별자, credential 값과 unredacted billing export는 기록하지 않습니다. 가격과
사용량은 provider UI/API와 review date를 함께 기록하고, 승인되지 않은 미래 비용은 `TBD`로 유지합니다.
