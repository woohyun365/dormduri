#!/usr/bin/env sh
set -eu

port="${PORT:-4000}"
exec curl -fsS "http://127.0.0.1:${port}/health/ready" >/dev/null
