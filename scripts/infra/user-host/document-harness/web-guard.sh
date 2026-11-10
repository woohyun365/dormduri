# web document guard: Docker·AWS에 닿기 전에 끝나는 경로(stub 없음, `--network none`).
set -u
. /work/common.sh
W=$(pair a)
I=$(pair b)
run() {
  name=$1
  shift
  env "$@" bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  printf 'case=%s exit=%s out=%s\n' "${name}" "${code}" "$(tail -n 1 /tmp/out)"
}
run action SSM_action=bogus SSM_webDigest="${W}" SSM_ingressDigest="${I}"
run digest SSM_action=deploy SSM_webDigest=sha256:xyz SSM_ingressDigest="${I}"
mkdir -p /opt/dormduri/state
(
  exec 9>/opt/dormduri/state/lock
  flock -n 9
  touch /tmp/held
  sleep 4
) &
while [ ! -e /tmp/held ]; do sleep 0.1; done
run locked SSM_action=deploy SSM_webDigest="${W}" SSM_ingressDigest="${I}"
wait
run tls-missing SSM_action=deploy SSM_webDigest="${W}" SSM_ingressDigest="${I}"
# TLS 사본이 없으면 release 디렉터리(compose 조각 사본)를 쓰기 전에 멈춘다.
written=no
if [ -n "$(find /opt/dormduri/releases -mindepth 1 2>/dev/null)" ]; then written=yes; fi
printf 'case=release-before-tls exit=0 written=%s out=none\n' "${written}"
