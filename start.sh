#!/bin/sh
set -e

mkdir -p /run/nginx /var/lib/nginx/tmp /var/log/nginx

# Release may inject BLOCKS_* or NEXT_PUBLIC_BLOCKS_*. Accept either.
# GEMINI_API_KEY is runtime-only (never a Docker ARG).
api_url="${BLOCKS_API_URL:-${NEXT_PUBLIC_BLOCKS_API_URL:-}}"
project_key="${BLOCKS_PROJECT_KEY:-${NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY:-${NEXT_PUBLIC_BLOCKS_PROJECT_KEY:-}}}"
app_domain="${BLOCKS_APP_DOMAIN:-${NEXT_PUBLIC_BLOCKS_APP_DOMAIN:-}}"
oidc_url="${BLOCKS_OIDC_URL:-${NEXT_PUBLIC_BLOCKS_OIDC_URL:-}}"
oidc_client_id="${BLOCKS_OIDC_CLIENT_ID:-${NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID:-}}"
oidc_scope="${BLOCKS_OIDC_SCOPE:-${NEXT_PUBLIC_BLOCKS_OIDC_SCOPE:-}}"
dev_host="${BLOCKS_DEV_HOST:-}"
dev_port="${BLOCKS_DEV_PORT:-}"
gemini_model="${GEMINI_MODEL:-}"
gemini_key="${GEMINI_API_KEY:-}"

emit() {
  # Quote so values with spaces (openid profile) are safe for Next dotenv.
  val=$(printf '%s' "$2" | sed "s/'/'\\\\''/g")
  printf "%s='%s'\n" "$1" "$val"
}

write_env() {
  {
    emit BLOCKS_API_URL "$api_url"
    emit BLOCKS_PROJECT_KEY "$project_key"
    emit BLOCKS_APP_DOMAIN "$app_domain"
    emit BLOCKS_OIDC_URL "$oidc_url"
    emit BLOCKS_OIDC_CLIENT_ID "$oidc_client_id"
    emit BLOCKS_OIDC_SCOPE "$oidc_scope"
    emit BLOCKS_DEV_HOST "$dev_host"
    emit BLOCKS_DEV_PORT "$dev_port"
    emit NEXT_PUBLIC_BLOCKS_API_URL "$api_url"
    emit NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY "$project_key"
    emit NEXT_PUBLIC_BLOCKS_PROJECT_KEY "$project_key"
    emit NEXT_PUBLIC_BLOCKS_APP_DOMAIN "$app_domain"
    emit NEXT_PUBLIC_BLOCKS_OIDC_URL "$oidc_url"
    emit NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID "$oidc_client_id"
    emit NEXT_PUBLIC_BLOCKS_OIDC_SCOPE "$oidc_scope"
    emit GEMINI_MODEL "$gemini_model"
    emit GEMINI_API_KEY "$gemini_key"
  } > "$1"
}

write_env .env
write_env .env.production

export BLOCKS_API_URL="$api_url"
export BLOCKS_PROJECT_KEY="$project_key"
export BLOCKS_APP_DOMAIN="$app_domain"
export BLOCKS_OIDC_URL="$oidc_url"
export BLOCKS_OIDC_CLIENT_ID="$oidc_client_id"
export BLOCKS_OIDC_SCOPE="$oidc_scope"
export BLOCKS_DEV_HOST="$dev_host"
export BLOCKS_DEV_PORT="$dev_port"
export NEXT_PUBLIC_BLOCKS_API_URL="$api_url"
export NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY="$project_key"
export NEXT_PUBLIC_BLOCKS_PROJECT_KEY="$project_key"
export NEXT_PUBLIC_BLOCKS_APP_DOMAIN="$app_domain"
export NEXT_PUBLIC_BLOCKS_OIDC_URL="$oidc_url"
export NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID="$oidc_client_id"
export NEXT_PUBLIC_BLOCKS_OIDC_SCOPE="$oidc_scope"
export GEMINI_MODEL="$gemini_model"
export GEMINI_API_KEY="$gemini_key"

missing=""
for k in api_url project_key oidc_client_id app_domain; do
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
