# 백오피스 document harness 공통 함수(ssm-document-runtime.mjs가 일회용 container의 /work에 넣고 harness·가짜 명령이 source한다).
# 판정 줄 형식: `case=<이름> <key>=<값> ... out=<마지막 RESULT 줄>`. 값에는 공백이 없다(user host harness와 같은 형식).

# 첫 글자가 label인 가짜 digest: pair 1 → sha256:111…(64자).
pair() { printf 'sha256:%s' "$(printf '%64s' '' | tr ' ' "$1")"; }

# 기록 파일에서 image digest의 label(첫 hex 글자). 없으면 none.
label() {
  local value
  value=$(sed -n "s/^$1=sha256:\\(.\\).*/\\1/p" "$2" 2>/dev/null | tail -n 1)
  printf '%s' "${value:-none}"
}

result_line() { grep 'RESULT=' "$1" | tail -n 1; }

# 가짜 docker가 쓰는 compose 인자 해석: 하위 명령(sub), service 이름(services), compose 파일(files).
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
      --wait-timeout | --pull) shift 2 ;;
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

# 실제 compose처럼 넘긴 compose 파일이 없으면 실패한다(지운 release로 멈추려는 호출을 잡는다).
require_fragments() {
  local file
  for file in ${files}; do
    if [ ! -s "${file}" ]; then
      echo "${sub}:${file}" >>/tmp/missing.log
      exit 14
    fi
  done
}
