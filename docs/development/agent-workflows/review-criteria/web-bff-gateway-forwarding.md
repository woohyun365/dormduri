# Web BFF gateway and forwarding criteria

[Review criteria](./README.md)의 `web-bff-gateway-forwarding` 기준입니다. Browser와 upstream API 사이의 BFF(backend for
frontend) route를 두거나 upstream 전달 규칙, 상태 변경 요청의 진입 방식을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 B1 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도)·[swe.md S5](./swe.md#s5-계약-호환성), B2 →
[swe.md S11](./swe.md#s11-응집도와-중복-trade-off)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다. cookie로 인증하는 상태 변경 진입점을 바꾸면
[web-security-privacy-trust-authz-model.md P1](./web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)도
고릅니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### B1. BFF를 둘 조건과 upstream allowlist

- 질문: BFF route가 인증 cookie 처리·응답 정리·오류 번역 같은 책임을 갖고, upstream으로 넘기는 method·path·query·header·body를 route별 allowlist로 제한하는가?
- 기본 severity: `high`
- 적용 조건: BFF route를 더하거나 바꾸는 변경, upstream 전달 helper를 바꾸는 변경
- 결함 패턴: 맡은 책임 없이 upstream을 그대로 중계하는 route를 둠, 임의 path·query·header·body를 upstream으로 넘기는 공통 proxy를 둠, browser가 보낸 인증·host·forwarding header를 그대로 전달함, 전달 helper를 입력 검증이나 위조 방어로 셈
- PASS 근거: route마다 허용 method·path·query·header·body schema가 명시되어 있고, 허용 밖 요청이 거부되는 test가 있다
- 지침: BFF route는 맡는 책임(cookie 처리·응답 정리·오류 번역)이 있을 때만 두고, route마다 upstream으로 넘길 항목을 allowlist로 명시한다. 입력 검증과 위조 방어는 전달과 별도의 검사로 둔다
- 피함: path를 그대로 붙이는 catch-all proxy, browser header를 통째로 전달하기, 전달 helper에 보안 판단 맡기기

### B2. mutation 진입점 선택

- 질문: 상태 변경 요청의 진입 방식을 인증·위조 방어·cache·rate limit·오류 의미로 비교해 고르고, 같은 action을 두 진입점에 복제하지 않는가?
- 기본 severity: `medium`
- 적용 조건: 상태 변경 요청의 진입 방식(framework의 server 함수 호출, route handler, browser의 upstream 직접 호출)을 더하거나 바꾸는 변경
- 결함 패턴: 비교 없이 편한 진입 방식을 고름, 같은 action이 두 진입점에 있어 검사가 한쪽에만 적용됨, 진입점마다 오류 형식이 다름
- PASS 근거: 진입 방식을 고른 이유(인증·위조 방어·오류 의미)가 변경 설명에 있고, action마다 진입점이 하나다
- 지침: 진입 방식은 인증·위조 방어·cache·rate limit·오류 의미를 한 곳에서 검사할 수 있는 쪽으로 고른다. 한 action에는 진입점을 하나만 둔다
- 피함: 진입점 복제, 진입점마다 다른 검사
