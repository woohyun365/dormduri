# Agent workflow tooling criteria

[Review criteria](./README.md)의 `agent-workflow-tooling` 기준입니다. Agent workflow의 script·검사·helper·hook·skill·역할
파일처럼 판정이나 실행 경로를 바꾸는 변경에 적용합니다. 문서도 함께 바뀌면 [Document review criteria](./documents.md)를
같이 고릅니다.

### W1. 조용한 통과 금지

- 질문: 검사·harness·validator가 대상 미발견, 읽기 실패, 빈 입력, 알 수 없는 값에서 실패하거나 명시적 사유로 거부하는가?
- 기본 severity: `medium`
- 적용 조건: 판정·거부·검사 결과를 만드는 code
- 결함 패턴: mutation 대상 문자열이 사라져도 실패로 세지 않음, parse 실패를 빈 결과로 처리해 PASS함, 기본값이 검사를 건너뜀

### W2. 보고와 실행의 일치

- 질문: 출력·기록·보고 수치가 실제로 실행된 검사와 그 결과에서만 나오는가?
- 기본 severity: `medium`
- 적용 조건: 검증 결과·건수·verdict를 기록하거나 집계하는 code와 그 실행 증거
- 결함 패턴: 실행하지 않은 검사를 통과로 셈, 집계 건수가 원 기록과 다름

### W3. 보호 test와 대조군

- 질문: 바뀐 동작을 직접 보호하는 test가 있고, 결함 fixture에서 실패하며(positive control) 정상 fixture에서 통과하는가?
  수정 전 실패(RED)는 의도한 사유로 실패했는가?
- 기본 severity: `medium`
- 적용 조건: 동작·거부 조건·판정을 바꾸는 code 변경
- 결함 패턴: 정상 경로만 test해 거부 경로가 무보호, RED가 다른 사유(문법 오류·fixture 누락)로 실패함, assertion이 구현을 그대로 복제함

### W4. 문서·skill·usage와 동작의 일치

- 질문: owner 문서, skill 절차, CLI usage 문구가 바뀐 입력·출력·거부 조건과 같은가?
- 기본 severity: `medium`
- 적용 조건: CLI 입력, helper 출력, 거부 사유, 절차 순서를 바꾸는 변경
- 결함 패턴: 새 필수 입력을 skill 명령에 빠뜨림, 문서의 거부 사유 이름이 code와 다름

### W5. Runner 기록의 형식과 진실성

- 질문: runner 기록이 실제 명령·exit·관측 결과·출력 경로·snapshot digest를 그대로 담고, exit를 뒤집거나 다른 회차의 digest를 쓰지 않는가?
- 기본 severity: `medium`
- 적용 조건: 리뷰나 판정에 runner 기록을 넘기는 변경과 그 증거
- 결함 패턴: 실패를 성공으로 보이게 하는 wrapper로 exit를 바꿈, 수정 전 digest로 만든 기록을 수정 뒤 리뷰에 씀

### W6. 입력 결속과 stale state

- 질문: 판정·정산에 쓰는 입력이 digest·경로로 결속되고, 등록 뒤 바뀌면 거부되는가?
- 기본 severity: `medium`
- 적용 조건: packet·snapshot·정산·재시도처럼 이전 상태를 다시 읽는 code
- 결함 패턴: 등록 뒤 바뀐 파일을 같은 입력으로 받아들임, 이전 회차 결과를 현재 snapshot의 결과로 씀

### W7. 범위와 dependency

- 질문: 새 dependency, 쓰기 범위 밖 수정, 다른 host 전용 가정이 들어오지 않는가?
- 기본 severity: `medium`
- 적용 조건: script·설정·공통 module 변경
- 결함 패턴: 요청 없이 package를 추가함, 공통 script가 한 host의 경로나 runtime을 전제함

### W8. 이식성

- 질문: 경로·shell·OS 차이(대소문자, symlink, 절대 경로, BSD/GNU 도구)에서 같은 결과를 내는가?
- 기본 severity: `low`
- 적용 조건: 파일 경로·외부 명령을 다루는 script
- 결함 패턴: 대소문자만 다른 경로로 거부 검사를 우회함, 한 OS의 명령 옵션에만 의존함
