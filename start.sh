#!/bin/sh
set -e

mkdir -p /run/nginx /var/lib/nginx/tmp /var/log/nginx

# Materialize Release secret-set env for the Next standalone server.
# Values come from container env at runtime. GEMINI_API_KEY is never a Docker ARG.
{
  echo "NEXT_PUBLIC_BLOCKS_API_URL=${NEXT_PUBLIC_BLOCKS_API_URL:-}"
  echo "NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY=${NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY:-}"
  echo "NEXT_PUBLIC_BLOCKS_APP_DOMAIN=${NEXT_PUBLIC_BLOCKS_APP_DOMAIN:-}"
  echo "NEXT_PUBLIC_BLOCKS_OIDC_URL=${NEXT_PUBLIC_BLOCKS_OIDC_URL:-}"
  echo "NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID=${NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID:-}"
  echo "NEXT_PUBLIC_BLOCKS_OIDC_SCOPE=${NEXT_PUBLIC_BLOCKS_OIDC_SCOPE:-}"
  echo "BLOCKS_DEV_HOST=${BLOCKS_DEV_HOST:-}"
  echo "BLOCKS_DEV_PORT=${BLOCKS_DEV_PORT:-}"
  echo "GEMINI_MODEL=${GEMINI_MODEL:-}"
  echo "GEMINI_API_KEY=${GEMINI_API_KEY:-}"
} > .env

missing=""
for k in NEXT_PUBLIC_BLOCKS_API_URL NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID NEXT_PUBLIC_BLOCKS_APP_DOMAIN; do
  eval "v=\${$k}"
  [ -n "$v" ] || missing="$missing $k"
done
[ -n "$missing" ] && echo "WARN: unset env (Release secret set may be missing):$missing" >&2

node server.js &
NODE_PID=$!

i=0
while [ "$i" -lt 60 ]; do
  if node -e "require('http').get('http://127.0.0.1:3000/',(r)=>{r.resume();process.exit(0)}).on('error',()=>process.exit(1))"; then
    break
  fi
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "FATAL: node server.js exited before becoming ready" >&2
    wait "$NODE_PID" || true
    exit 1
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$i" -ge 60 ]; then
  echo "FATAL: timed out waiting for Next on :3000" >&2
  kill "$NODE_PID" 2>/dev/null || true
  exit 1
fi

nginx -g 'daemon off;'
