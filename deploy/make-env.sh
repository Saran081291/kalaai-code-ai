#!/usr/bin/env bash
# Create .env for the production stack from .env.prod.example and generate the secrets.
#   bash deploy/make-env.sh
# Safe to re-run: it refuses to overwrite an existing .env.
set -eu

cd "$(dirname "$0")/.."

if [ -e .env ]; then
  echo ".env already exists - not touching it. Edit it by hand, or delete it first." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secrets." >&2
  exit 1
fi

secret_key="$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')"
db_password="$(openssl rand -hex 24)"   # hex is URL-safe (it is embedded in DATABASE_URL)

umask 177   # .env readable by the owner only
sed -e "s|^SECRET_KEY=.*|SECRET_KEY=${secret_key}|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${db_password}|" \
    .env.prod.example > .env
chmod 600 .env

echo "Created .env (permissions 600) with a generated SECRET_KEY and POSTGRES_PASSWORD."
echo
echo "Still to fill in (nano .env):"
echo "  TRAEFIK_NETWORK, TRAEFIK_CERTRESOLVER   <- bash deploy/discover-traefik.sh"
echo "  OPENAI_API_KEY (or set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY)"
echo "  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (optional)"
echo
echo "Do not share or commit .env."
