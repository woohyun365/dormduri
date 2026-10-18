# Web DB schema modeling criteria

[Review criteria](./README.md)의 `web-db-schema-modeling` 기준입니다. DB model·relation·제약과 삭제 동작, 이력·snapshot을 저장하는
model, model·field·enum·index의 이름과 type을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 T1 →
[swe.md S1](./swe.md#s1-요구사항intentinvariant-부합), T2 → [swe.md S5](./swe.md#s5-계약-호환성), T3 →
[swe.md S10](./swe.md#s10-예측-가능성)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### T1. model owner·제약·삭제 동작

- 질문: 새 model·relation의 owner가 정해지고, DB 제약으로 표현할 수 있는 무결성을 외래 key·unique·check 제약으로 DB가 보장하며, 관계마다 삭제 동작을 기본값에 맡기지 않고 명시하는가?
- 기본 severity: `medium`
- 적용 조건: model·relation·제약을 더하거나 바꾸는 schema 변경
- 결함 패턴: 무결성을 code에만 맡기고 외래 key·unique·check 제약이 없음, 관계 삭제 동작을 기본값에 맡겨 의도하지 않은 연쇄 삭제·고아 row가 생김, model owner가 정해지지 않음
- PASS 근거: 새 model마다 owner가 owner 문서나 schema 주석에 있고, DB 제약으로 표현할 수 있는 무결성마다 제약과 그 위반 test가 있으며, 관계마다 삭제 동작이 schema에 명시돼 있다
- 지침: model마다 owner를 정하고, 참조·유일성·값 범위 같은 무결성은 DB 제약으로 둔다. 관계마다 삭제 동작(삭제 막기·함께 삭제·참조 비우기)을 명시하고, 정하기 어려우면 삭제 막기를 기본으로 둔다
- 피함: DB 제약으로 표현할 수 있는 무결성을 code 검사에만 맡기기, 삭제 동작을 기본값에 맡기기, owner 없는 model

### T2. snapshot·history와 현재 row 분리

- 질문: 이력·감사가 필요한 data에서 현재 값을 바꿔도 과거 기록이 함께 바뀌지 않고, 저장한 snapshot에 schema version과 공개 범위가 있는가?
- 기본 severity: `medium`
- 적용 조건: 이력·snapshot을 저장하는 model을 더하거나 바꾸는 변경
- 결함 패턴: 현재 값을 바꾸면 과거 기록이 함께 바뀜, snapshot에 schema version·공개 범위가 없음
- PASS 근거: 이력·감사가 필요한 data면 현재 값을 바꾼 뒤에도 과거 기록이 그대로라는 test가 있고, snapshot에는 schema version과 공개 범위 field가 있으며 옛 version snapshot을 읽는 경로가 있다
- 지침: 이력·감사가 필요한 data는 과거 기록을 현재 값과 따로 남겨 현재 값을 바꿔도 바뀌지 않게 하고(별도 이력·snapshot table이 기본), snapshot에는 schema version과 공개 범위를 함께 둔다. 이력이 필요 없는 data는 남기지 않는다
- 피함: 이력·감사가 필요한 data에서 현재 값만 덮어쓰기, schema version·공개 범위 없는 snapshot

### T3. 명명·type 규약

- 질문: 새 model·field·enum·index의 이름과 type이 저장소 규약을 따르고, 같은 의미(날짜·금액·상태 값)를 기존 field와 같은 이름 규칙·type으로 두는가?
- 기본 severity: `low`
- 적용 조건: model·field·enum·index 이름이나 type을 더하는 변경
- 결함 패턴: 같은 의미를 다른 이름·type(날짜·금액·상태 값)으로 둠, 저장소 규약과 다른 명명
- PASS 근거: 새 이름·type이 저장소의 명명 규약(binding 문서나 schema 관례)과 맞고, 같은 의미의 기존 field와 이름 규칙·type이 같다
- 지침: 이름과 type은 저장소 규약을 따르고, 날짜·금액·상태 값처럼 같은 의미는 기존 field와 같은 이름 규칙과 type을 쓴다
- 피함: 같은 의미에 다른 이름·type 쓰기, 규약과 다른 명명
