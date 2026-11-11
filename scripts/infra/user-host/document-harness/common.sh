# SSM document harness 공통 함수(ssm-document-runtime.mjs가 일회용 container의 /work에 넣고 harness가 source한다).
# 판정 줄 형식: `case=<이름> <key>=<값> ... out=<마지막 RESULT 줄>`. 값에는 공백이 없다.

# 첫 글자가 label인 가짜 digest: pair 1 → sha256:111…(64자).
pair() { printf 'sha256:%s' "$(printf '%64s' '' | tr ' ' "$1")"; }

# 기록 파일에서 image digest의 label(첫 hex 글자). 없으면 none.
label() {
  local value
  value=$(sed -n "s/^$1=sha256:\\(.\\).*/\\1/p" "$2" 2>/dev/null | tail -n 1)
  printf '%s' "${value:-none}"
}

# 기록 형식: 2(recordFormat=2), legacy(옛 document 기록), none(파일 없음).
format_of() {
  if [ ! -f "$1" ]; then printf none
  elif grep -qx 'recordFormat=2' "$1"; then printf 2
  else printf legacy; fi
}

# 기록이 가리키는 조각: release(이번 형식 release 디렉터리)·legacy(옛 compose 사본)·missing(파일 없음)·none.
fragment_kind() {
  local fragment
  fragment=$(sed -n 's/^fragment=//p' "$1" 2>/dev/null | tail -n 1)
  if [ -z "${fragment}" ]; then printf none
  elif [ ! -s "${fragment}" ]; then printf missing
  else
    case "${fragment}" in
      */releases/web/legacy-*) printf legacy ;;
      */releases/*) printf release ;;
      *) printf other ;;
    esac
  fi
}

result_line() { grep 'RESULT=' "$1" | tail -n 1; }

# 가짜 docker가 쓰는 compose 인자 해석: 하위 명령(sub), service 이름(services), 조각 파일(files).
compose_args() {
  shift
  sub=''
  services=''
  files=''
  while [ $# -gt 0 ]; do
    case "$1" in
      -f)
        files="${files} $2"
        shift 2
        ;;
      -p | --profile) shift 2 ;;
      -*) shift ;;
      *)
        sub=$1
        shift
        break
        ;;
    esac
  done
  while [ $# -gt 0 ]; do
    case "$1" in
      --wait-timeout | --policy | --pull) shift 2 ;;
      -*) shift ;;
      *)
        services="${services} $1"
        shift
        if [ "${sub}" = run ] || [ "${sub}" = exec ]; then break; fi
        ;;
    esac
  done
  services=${services# }
}

# 실제 compose처럼 넘긴 조각 파일이 없으면 실패한다(지운 조각으로 멈추려는 호출을 잡는다).
require_fragments() {
  local file
  for file in ${files}; do
    if [ ! -s "${file}" ]; then
      echo "${sub}:${file}" >>/tmp/missing.log
      exit 14
    fi
  done
}

# 가짜 docker의 network·image 처리. 처리했으면 0, compose 등 나머지는 1.
docker_common() {
  case "$1 ${2:-}" in
    "network inspect")
      [ -f /tmp/net ] || exit 1
      printf '[{"Name":"%s","IPAM":{"Config":[{"Subnet":"%s"}]}}]\n' "$3" "$(cat /tmp/net)"
      exit 0
      ;;
    "network create")
      shift 2
      while [ $# -gt 1 ]; do
        if [ "$1" = --subnet ]; then printf '%s' "$2" >/tmp/net; fi
        shift
      done
      exit 0
      ;;
    "image ls") exit 0 ;;
  esac
  return 1
}

# 모든 실행의 docker 호출 요약: 다른 묶음 service 이름(other), project 전체 down, 모든 compose 호출의 `-p dormduri-web`,
# SSM 표준 출력의 registry 주소(가짜 account 000000000000).
isolation_line() {
  local other=$1 found_other=no down=no project=yes registry=no missing=no
  grep -Eq "^(up|stop|rm|run|create|start|restart):(.* )?(${other})( |$)" /tmp/services-all && found_other=yes
  grep -q '^down:' /tmp/services-all && down=yes
  if grep '^docker compose ' /tmp/docker-all | grep -vq -- '^docker compose -p dormduri-web '; then project=no; fi
  grep -q '000000000000' /tmp/stdout-all && registry=yes
  [ -s /tmp/missing-all ] && missing=yes
  printf 'case=bundle-isolation exit=0 other=%s down=%s project=%s registry=%s missing=%s out=none\n' "${found_other}" "${down}" \
    "${project}" "${registry}" "${missing}"
}

# api 묶음 container 정지가 새 container 시작보다 앞서는지: up:api마다 그 전에 stop:api가 있어야 한다.
stop_before_up() {
  awk -F: '$1 == "stop" && $2 ~ /(^| )api( |$)/ { stopped = 1 }
    $1 == "up" && $2 ~ /(^| )api( |$)/ { ups++; if (!stopped) bad = 1; stopped = 0 }
    END { if (!ups) print "none"; else if (bad) print "no"; else print "yes" }' /tmp/services.log
}
