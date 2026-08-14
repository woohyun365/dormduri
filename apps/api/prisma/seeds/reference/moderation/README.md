# Moderation reference seed

닉네임과 공개 텍스트의 고신뢰 금칙어 및 서비스 예약어를 관리하는 reference seed다.

## 운영 원칙

- 전체 외부 목록을 그대로 복제하지 않고, 한국 대학생 대상 서비스에서 명확히 차단할 표현만 검토해 반영한다.
- 중립적인 정체성 표현(`게이`, `장애인`, `외국인` 등)은 금칙어로 취급하지 않는다.
- 짧은 영문은 정상 단어 안에 포함될 가능성이 있으므로 `INCLUDES`를 피하고 `PREFIX` 또는 `EXACT`를 사용한다.
- 런타임 비교는 공백·기호 제거에 더해 한글 사이에 삽입된 숫자만 제거한 후보도 검사한다. 일반 숫자 suffix는 보존한다.
- `REFERENCE` row만 manifest 동기화 대상이다. 운영자가 추가한 `OPERATIONS` row는 seed가 수정하거나 비활성화하지 않는다.
- 목록은 완전한 안전장치가 아니다. 신고와 운영 검토를 함께 사용한다.

## 검토 근거

- Shutterstock LDNOOBW 한국어·영어 목록(CC BY 4.0): 후보 어휘 교차 확인
  - https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
- 한전MCS 공개 금칙어 데이터(KOGL 제1유형): 공공 웹서비스의 reference/operations 분리 및 주기적 검수 사례
  - https://www.data.go.kr/data/15137553/fileData.do
- Korean UnSmile dataset: 욕설과 혐오 표현 범주 및 맥락 의존성 검토
  - https://github.com/smilegate-ai/korean_unsmile_dataset
- BEEP! Korean Hate Speech Dataset: hate/offensive/none 구분과 맥락 기반 한계 검토
  - https://github.com/kocohub/korean-hate-speech
- K-HATERS: 한국어 공격 표현의 대상별·강도별 판단과 annotation 편향 검토
  - https://aclanthology.org/2023.findings-emnlp.952/
- KOTOX: 한글 변형, 교차 문자 치환, 기호 삽입 등 한국어 toxicity 우회 taxonomy 검토
  - https://github.com/leeyejin1231/KOTOX
- 한국 게임 서비스 필터 dump: 실제 사용자 철자 변형·자모 분해·성적 표현 후보 교차 확인
  - https://gist.github.com/hw4n/9bb64a9d5ffe78c28bc52e9404a42dd6
- 한국어 사용자 커뮤니티의 초성체 설명: 실제 채팅에서 쓰이는 욕설 초성 후보 교차 확인
  - https://www.reddit.com/r/Korean/comments/tsyhp8/todays_korean_%E3%85%8E%E3%85%87basic_korean_consonant/
- 온라인 그루밍 예방 자료의 실제 수집 은어: 성적 행위·요구·초성 후보의 위험도 교차 확인
  - https://www.seoul.co.kr/SpecialEdition/grooming_education/
- 국내 대중 매체와 성향 용어 자료: 도미넌트·서브미시브·디그레이디 등 성적 성향 vocabulary 교차 확인
  - https://www.cosmopolitan.co.kr/article/57845
  - https://asdn.kr/460
- 국내 주요 커뮤니티 혐오 표현 연구: 젠더 갈등 표현과 커뮤니티별 실제 사용 맥락 교차 확인
  - https://astlyi.s3.ap-northeast-2.amazonaws.com/2023/%5B98%5DHCIK_HateSpeech.pdf
- 2026년 디시인사이드 사용자 차단어 사례: 현재 사용되는 젠더 갈등·모욕·성적 표현 후보 교차 확인
  - https://gall.dcinside.com/board/view/?id=battlegrounds&no=1614459
- 한국어 사용자 커뮤니티의 젠더 갈등 사례: 양방향 혐오 표현과 성적 비하 표현 후보 교차 확인
  - https://www.reddit.com/r/hanguk/comments/1migxpz/

외부 데이터는 taxonomy와 후보 검토 자료로 사용하며, 이 manifest는 서비스 정책에 맞게 별도로 선별한 목록이다.
