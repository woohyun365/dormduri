# Legal 단계 배포

공개 법적 문서를 Web 사본(fallback) 대신 백오피스 게시 판으로 내는 단계의 배포 순서, document 갱신, API 중단 시험, rollback
절차다. 각 workflow의 실행·재배포·실패 대응은 [API 단계 배포](./api-stage-deploy.md), [백오피스 단계 배포](./backoffice-stage-deploy.md),
[Web 단계 배포](./web-stage-deploy.md)가 소유하고, 판을 만들고 승인하는 화면 절차는
[법적 문서 게시 runbook](../../../docs/runbooks/legal-publication.md)이 소유한다. 이 문서는 그 절차를 이 단계에서 잇는 순서와
확인만 적는다. 단계 기록 형식은 [단계 배포 기록](./production-release-evidence.md#단계-배포-기록)이다.

공개 저장소라 log·run 요약·Release·이슈·노트에 AWS account ID, IP, node·instance ID, email을 쓰지 않는다
([식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)). 그런 값이 필요한 자리는 "Owner console"로 적는다.

## 왜 이 순서인가

- 새 Web은 법적 문서 문안 사본이 없다. `/privacy`·`/terms`는 요청마다 사용자 API를 읽고, 받은 응답을 user host의 named volume
  (`dormduri-web_legal-last-success`)에 마지막 성공본으로 남긴다. API가 답하지 못하면 그 파일을, 파일도 없으면 '문서를 불러오지
  못했습니다'를 보인다([Web legal](../../../apps/web/src/legal/README.md)).
- 첫 배포 때는 volume이 비어 있다. 그래서 production DB에 게시 판이 있고 공개 API가 그 판을 내는 것을 확인한 뒤에 Web을 바꾼다.
  처리방침은 계속 게재해야 하므로 '불러올 수 없음'이 공개 화면에 남으면 안 된다.
- Host의 Web 배포는 새 쌍을 띄운 뒤 `/privacy`·`/terms`가 API 게시본 표지(`data-dormduri-legal-source="published"`, 사용자 문구
  아님)를 내는지 보고, 아니면 새 쌍을 남기지 않고 직전 쌍으로 되돌린다(`RESULT=failed action=deploy reason=rolled-back-to-current`). 이
  gate는 새 쌍을 올리는 `deploy`에만 있고 `rollback`에는 없다.

## 순서

이 단계의 `dev`에는 판 목록·적용기간·조항 대조표·새 판 공지 줄을 그리는 사용자 Web legal 화면이 이미 merge돼 있어야 한다. 그
화면 전의 Web은 보고 있는 판의 본문만 그리므로 아래 [공개 확인](#공개-확인)의 둘째·셋째 줄을 볼 수 없다.

1. `dev` → `main` 승격 PR을 merge한다(승격 직전 확인은 [단계 배포](./production-release-readiness.md#단계-배포)).
2. `api-cd`(migrate·grant·role smoke) → `backoffice-cd` 순서로 승인한다. 둘 다 각 runbook의 성공 확인까지 본다.
3. 백오피스에서 문서마다 첫 게시를 올린다([법적 문서 게시 runbook의 첫 게시](../../../docs/runbooks/legal-publication.md#첫-게시)).
   처리방침은 이전 판 기록(적용 2026-06-22~2026-11-19)을 먼저 승인하고 지금 판(시행일 2026-11-20)을 승인한다. 나머지 셋은
   2026-06-22 판 하나다.
4. 공개 API가 게시 판을 내는지 host 안에서 본다. Session Manager로 host에 들어가 Web container 안에서 ingress private
   listener로 요청한다(공개 `/api/**`는 JSON 503이라 밖에서는 볼 수 없다).

   ```sh
   for kind in TERMS_OF_SERVICE PRIVACY_POLICY PERSONAL_DATA_COLLECTION_USE_CONSENT AGE_14_OR_ABOVE_NOTICE; do
     docker exec dormduri-web-web-1 node -e "fetch('http://ingress:8081/api/legal/documents/${kind}/page').then(async (r) => { const b = await r.json(); console.log('${kind}', r.status, b.viewing?.versionKey, b.viewing?.status, b.versions?.length); })"
   done
   ```

   네 문서 모두 200이고 처리방침은 판 둘(`2026-11-20` 시행 중, `2026-06-22` 이전)이어야 한다. Container 이름은
   `docker ps --format '{{.Names}}'`로 확인한다.

5. 첫 개정 초안(`apps/api/prisma/seed-data/reference/legal/*-first-revision.draft.json`)을 가져와 시행일(승인일 + 7일 이상)을
   골라 승인한다([개정](../../../docs/runbooks/legal-publication.md#개정)). 4를 다시 돌려 그 문서의 판이 `scheduled` 하나만큼
   늘었는지 본다.
6. Owner가 [document 갱신](#document-갱신)을 한 뒤 `web-cd`를 승인한다. Host가 새 쌍의 법적 문서 출처를 확인한다.
   `api-cd`와 `web-cd`는 같은 concurrency group(`user-host-production`)이라 먼저 승인을 기다리는 쪽 뒤에서 다른 쪽이 기다린다.
   `web-cd`가 2(`api-cd`)보다 먼저 group을 잡아 승인을 기다리면 거절한다. 거절했거나 document 갱신 전에 승인해 deploy job이 document
   해시 대조에서 멈췄으면(SendCommand 전이라 host는 바뀌지 않는다), 갱신 뒤 그 run을 Re-run failed jobs로 다시 돌린다(build는
   다시 돌지 않는다).
7. 아래 [공개 확인](#공개-확인)과 [API 중단 시험](#api-중단-시험)을 한다.
8. 단계 기록(Release)을 확인하고, 첫 개정 시행일 다음 날 공개 화면에서 그 판이 시행 중인지 본다.

## Document 갱신

이 단계의 Web 배포 입력은 `infra/deploy/user/ssm/deploy.sh`와 `infra/deploy/user/compose.yml`을 바꾸므로 생성본
`infra/deploy/user/ssm/dormduri-web-deploy.json`도 바뀐다. `web-cd` deploy job은 AWS document Hash와 그 파일의 sha256이 다르면
SendCommand 전에 멈춘다.

1. `main`에서 생성본이 원본과 같은지 본다.

   ```sh
   node scripts/infra/user-host/ssm-document.mjs --check
   shasum -a 256 infra/deploy/user/ssm/dormduri-web-deploy.json
   ```

2. Systems Manager > Documents > `dormduri-web-deploy`에서 그 파일 내용으로 새 버전을 만들고 기본 버전으로 둔다.
3. 새 기본 버전의 Hash(SHA-256)가 1의 값과 같은지 본다. 값은 기록하지 않고 "같음"만 남긴다.

## 공개 확인

- `/privacy`·`/terms`가 게시본(`data-dormduri-legal-source="published"`)이고 '최신 판을 확인할 수 없어 마지막으로 확인한 판을
  보여 드립니다.' 안내가 없다.
- `/privacy`의 판 목록에 이전 판이 있고 `/privacy?version=2026-06-22`가 적용기간(2026-06-22~2026-11-19)을 보인다.
- 첫 개정 시행 전에는 그 문서 화면에 새 판 공지('…부터 적용하는 새 …이 공지되어 있습니다.'와 '새 판 미리 보기')가, Landing에
  개정 예고 줄(처리방침 줄이 먼저)이 있고, 새 판 주소가 변경 요약과 '이전 판과 달라진 조항'을 보인다.
- 없는 판 주소(`/terms?version=2026-01-01`)와 형식이 틀린 주소(`/terms?version=next`)가 HTTP 404와 '이용약관에서 이 판을
  찾을 수 없습니다'(Web 앱 화면)다. 이 화면은 브라우저가 그리므로 HTML 원문이 아니라 브라우저로 본다.
- 백오피스 감사 기록에 승인한 판마다 행이 있다.

## API 중단 시험

API가 멈춘 동안 Web이 마지막 성공본을 내는지 본다. 공개 화면이 잠시 '마지막으로 확인한 판' 안내로 바뀌므로 이용이 적은 시각에 한다.

1. `/privacy`·`/terms`를 한 번씩 열어 그 응답이 마지막 성공본으로 남게 한다.
2. Actions > API CD > Run workflow에서 지금 묶음으로 `maintenance`를 보낸다([API 단계 배포](./api-stage-deploy.md#재배포-rollback-api-내림)).
3. `/privacy`·`/terms`가 '최신 판을 확인할 수 없어 마지막으로 확인한 판을 보여 드립니다.' 안내와 확인 시각, 본문을 보인다.
   마지막 성공본이 없는 주소(1에서 열지 않은 판 주소, 예: `/terms?version=2026-06-22`)는 '이용약관을 지금 표시할 수
   없습니다'다(HTTP 200). Landing 개정 예고 줄은 마지막 성공본을 쓰지 않아 API가 돌아올 때까지 보이지 않는다.
4. Grafana Explore(Loki)에서 그 시각의 Web log 줄을 본다.

   ```logql
   {service="web"} | json | eventName="web_legal_last_success" | action="served"
   ```

5. 지금 묶음을 `deploy`로 다시 올려 API를 복구하고, `/privacy`·`/terms`의 안내가 사라졌는지 본다.

API가 내려간 동안에는 API 지표도 없어 읽기 출처 경보(`ApiLegalReadDegraded`)는 울리지 않는다. 그 경보는 API가 떠 있는데 DB
읽기가 실패해 memory 판으로 답할 때 울린다([마지막 성공본 확인](../../../docs/runbooks/legal-publication.md#마지막-성공본-확인)).

## 실패와 rollback

- `web-cd`가 `rolled-back-to-current`로 멈췄으면 새 Web의 `/privacy`·`/terms`가 API 게시본을 내지 못한 것이다. 이전 Web이 그대로
  떠 있다. 4의 host 안 요청으로 공개 API를 보고, 게시 판이 없으면 3부터 다시 한다. API가 멈췄으면 API를 먼저 복구한다.
- 새 Web을 올린 뒤 되돌릴 때는 `web-cd` `rollback`으로 직전 쌍을 올린다([Web 단계 배포](./web-stage-deploy.md#재배포-rollback-점검-mode)).
  이전 Web은 자기 fallback 문서를 내고 volume을 읽지 않는다. Volume은 지우지 않으며 다시 새 Web을 올리면 그대로 읽는다.
- 이 gate가 생기기 전의 쌍을 dispatch `deploy`로 다시 올리면 출처 표지가 없어 gate가 되돌린다. 그 쌍으로 가려면 `rollback`을 쓴다.
- 읽기 출처 경보 rule과 API DB 읽기 시간 상한은 API image와 같은 commit의 `api-cd`가 내보낸다. 둘이 잘못되면 `api-cd` 직전 묶음
  `rollback`이다.
- 게시한 판은 고치지 않는다. 문안이 틀렸으면 다음 판으로 고치고, 시행 전 개정은 철회한다
  ([철회](../../../docs/runbooks/legal-publication.md#철회)).
