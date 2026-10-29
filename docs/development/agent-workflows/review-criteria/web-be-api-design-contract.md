# Web BE API design and contract criteria

[Review criteria](./README.md)의 `web-be-api-design-contract` 기준입니다. Server API의 요청·응답 schema와 presenter, 오류 응답,
목록 조회와 resource 이름, 여러 소비자가 쓰는 공유 contract를 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P1](./web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)·[web-security-privacy-data-privacy-secret.md P2](./web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 E1 → [swe.md S5](./swe.md#s5-계약-호환성), E2 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로), E3 → [swe.md S8](./swe.md#s8-측정-근거-있는-성능)·[swe.md S10](./swe.md#s10-예측-가능성), E4 →
[swe.md S5](./swe.md#s5-계약-호환성)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### E1. 경계 schema 검증과 내부 type 비노출

- 질문: 요청을 진입점 경계에서 schema로 검증하고 허용한 필드만 쓰며, 응답은 내부 DTO·저장 row·provider payload가 아닌 공개 type으로 소비자가 쓰는 필드만 담는가?
- 기본 severity: `medium`
- 적용 조건: 요청·응답 schema, presenter, 공개 type을 더하거나 바꾸는 변경
- 결함 패턴: 요청 body를 schema 검증 없이 쓰거나 허용 필드 목록 없이 그대로 저장함(mass assignment), 내부 DTO·DB row·provider payload를 응답 type으로 그대로 노출함, 응답에 화면이 쓰지 않는 필드를 담음
- PASS 근거: 진입점마다 요청 schema 검증과 허용 필드 목록이 있고 허용 밖 필드·잘못된 형식을 거부하는 test가 있으며, 응답이 presenter를 거친 공개 type이고 응답 형태 test가 내부 필드가 없음을 확인한다
- 지침: 요청은 진입점 경계에서 schema로 검증하고 허용한 필드만 command에 넘긴다. 응답은 presenter가 공개 type으로 만들고 소비자가 쓰는 필드만 담는다. 공개 type은 내부 저장 형식이 바뀌어도 유지되게 따로 정의한다. 경계 schema test는 허용·거부, optional·null, enum 값을 표로 둔다
- 피함: 요청 body를 그대로 저장하기, 저장 row·provider payload를 응답으로 돌려주기, 쓰지 않는 필드를 미리 내보내기

### E2. 오류 의미 구분

- 질문: 검증 실패·권한 없음·없음·충돌·빈도 제한·provider 장애를 소비자가 구분할 수 있는 status·오류 code로 나누고, 모든 진입점이 같은 오류 형식을 쓰며, 실패를 빈 결과로 숨기거나 내부 오류 원문을 응답에 담지 않는가?
- 기본 severity: `medium`
- 적용 조건: 오류 응답·status·오류 code를 더하거나 바꾸는 변경
- 결함 패턴: 검증 실패·권한 없음·없음·충돌·빈도 제한·provider 장애를 같은 오류로 뭉침, 실패를 빈 결과나 기본값으로 숨김, 내부 오류 원문을 응답에 담음, 오류 형식이 진입점마다 다름
- PASS 근거: 오류 종류마다 status·오류 code 표가 있고 오류 변환이 한 곳에서 공통 형식을 만들며, 종류별 오류 응답 test(status·오류 code·응답 schema를 확인)와 내부 오류 원문이 응답에 없다는 test가 있다
- 지침: 오류는 소비자가 할 행동(입력 수정, 다시 로그인, 다시 시도, 기다림)이 다른 만큼 나눈다. 형식은 표준 문제 상세 형식이나 저장소 공통 envelope 가운데 하나를 모든 진입점에서 같게 쓰고, 내부 원인은 정제된 log에 남긴다. 실패를 빈 결과나 기본값으로 바꾸지 않는다
- 피함: 모든 실패를 같은 오류로 뭉치기, 실패를 빈 결과로 숨기기, 진입점마다 다른 오류 형식, 응답에 내부 오류 원문 담기, 오류 응답 test에서 message 문장을 고정하기

### E3. 목록 상한·pagination·resource 명명

- 질문: 목록 조회가 상한과 pagination을 갖고 내용이 바뀌는 목록은 page 사이에 중복·누락이 없게 넘기며, 같은 resource를 진입점마다 같은 이름·모양으로 노출하는가?
- 기본 severity: `medium`
- 적용 조건: 목록 조회 진입점이나 resource 경로·이름을 더하거나 바꾸는 변경
- 결함 패턴: 상한·pagination 없는 전체 목록 조회, 내용이 바뀌는 목록을 offset으로 넘겨 중복·누락이 생김, 같은 resource를 진입점마다 다른 이름·모양으로 노출함
- PASS 근거: 목록 진입점마다 기본·최대 page 크기와 다음 page 방식이 있고 상한을 넘는 요청의 test가 있으며, 내용이 바뀌는 목록이면 page 사이에 항목이 더해지거나 빠져도 중복·누락이 없다는 test가 있고, 같은 resource의 이름·필드 모양이 진입점 사이에 같다
- 지침: 목록에는 기본·최대 크기를 두고 상한 없는 전체 조회를 만들지 않는다. 내용이 바뀌는 목록은 마지막 항목을 기준으로 다음 page를 찾는 방식(cursor)으로 넘긴다. resource 이름과 필드 모양은 진입점 사이에 같게 쓰고 저장소의 명명 규약을 따른다
- 피함: 상한 없는 목록, 내용이 바뀌는 목록을 offset으로 넘기기, 같은 resource에 진입점마다 다른 이름 쓰기

### E4. 공유 contract owner·호환성·deprecation

- 질문: 공유 contract에는 여러 소비자가 실제로 쓰는 type만 두고, 따로 배포되는 옛 소비자가 남는 동안 필드 제거·의미 변경에 호환 구간이 있으며, deprecated 필드마다 제거 조건이 있는가?
- 기본 severity: `medium`
- 적용 조건: 여러 소비자가 쓰는 공개 contract를 바꾸는 변경
- 결함 패턴: 한쪽만 쓰는 type을 공유 contract에 둠, 필드를 지우거나 의미를 바꾸면서 옛 소비자의 호환 구간이 없음, 제거 조건 없는 deprecated 필드
- PASS 근거: 공유 contract의 새 type마다 쓰는 소비자가 둘 이상이고, 옛 소비자가 배포 중에 남는 변경이면 호환 구간(먼저 더하고 나중에 지우는 순서나 version 분리)이 변경 설명에 있고 옛 형식을 확인하는 contract test가 있으며, deprecated 필드마다 제거 조건이 있다
- 지침: 공유 contract는 여러 소비자가 같은 의미를 실제로 공유할 때만 둔다. 따로 배포되는 소비자가 있으면 옛 소비자가 남는 동안 호환 구간을 둔다(필드를 먼저 더하고 제거·의미 변경은 예고와 제거 조건 뒤에 하거나, 깨지는 변경을 새 version으로 나눈다). 모든 소비자가 같은 배포 단위에 있으면 같은 변경에서 함께 바꾼다. 공유 contract test는 공개 export와 옛 형식 호환을 검사하고, 소비자 쪽에 같은 검사를 복제하지 않는다
- 피함: 한쪽만 쓰는 type을 공유 contract에 두기, 옛 소비자가 남는데 필드를 바로 지우거나 의미를 바꾸기, 제거 조건 없는 deprecated 표시
