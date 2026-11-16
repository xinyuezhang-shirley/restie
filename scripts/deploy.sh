#!/usr/bin/env bash
# Deploy Restie: Supabase (database, auth, Rusty's edge function) + the web app on Vercel.
# (Vercel builds from GitHub main; this script sets its env vars and triggers a rebuild.)
#
#   1. Fill .env.deploy.local (project ref, db password, Supabase + Vercel tokens).
#      The Anthropic key is set in Supabase → Edge Functions → Secrets, never here.
#   2. bash scripts/deploy.sh            everything
#      bash scripts/deploy.sh supabase   backend only
#      bash scripts/deploy.sh web        web only (after the backend exists)
#
# Safe to re-run: migrations only apply once, deploys replace the previous one.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.deploy.local ] || { echo "✗ .env.deploy.local is missing"; exit 1; }
set -a; source .env.deploy.local; set +a
WHAT="${1:-all}"

sb() { npx -y supabase@3.1.0 "$@"; }
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
need() { for v in "$@"; do [ -n "${!v:-}" ] || { echo "✗ $v is empty in .env.deploy.local"; exit 1; }; done; }

if [ "$WHAT" = all ] || [ "$WHAT" = supabase ]; then
  need SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD
  export SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_YES=1
  REF="$SUPABASE_PROJECT_REF"
  API="https://api.supabase.com/v1/projects/$REF"
  AUTHZ="Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

  step "Link project $REF"
  sb link --project-ref "$REF"

  step "Database migrations"
  sb db push --remote="$REF" --password "$SUPABASE_DB_PASSWORD"

  step "Anonymous sign-ins"
  if curl -fsS -H "$AUTHZ" "$API/config/auth" | grep -q '"external_anonymous_users_enabled":true'; then
    echo "already on"
  else
    curl -fsS -X PATCH -H "$AUTHZ" -H 'Content-Type: application/json' \
      -d '{"external_anonymous_users_enabled":true}' "$API/config/auth" >/dev/null && echo "turned on"
  fi

  step "Rusty's edge function"
  sb functions deploy rusty --remote="$REF" --use-api

  step "Secrets (names only)"
  if sb secrets list --remote="$REF" 2>/dev/null | grep -q ANTHROPIC_API_KEY; then
    echo "ANTHROPIC_API_KEY is set"
  else
    echo "⚠ ANTHROPIC_API_KEY is not set yet: Supabase → Edge Functions → Secrets. Rusty uses offline lines until then."
  fi

  step "App keys → .env.local"
  KEY=$(sb projects api-keys --remote="$REF" -o json | node -e '
    const keys = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const k = keys.find((k) => String(k.api_key).startsWith("sb_publishable_")) ?? keys.find((k) => k.name === "anon");
    if (!k) process.exit(1);
    process.stdout.write(k.api_key);')
  printf '# Written by scripts/deploy.sh (public values: safe in the app bundle).\nEXPO_PUBLIC_SUPABASE_URL=https://%s.supabase.co\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%s\n' "$REF" "$KEY" > .env.local
  echo "wrote .env.local"

  step "Smoke test"
  node --env-file=.env.local scripts/smoke-rusty.mjs || echo "⚠ smoke test had failures (see above)"
fi

if [ "$WHAT" = all ] || [ "$WHAT" = web ]; then
  need VERCEL_TOKEN
  [ -f .env.local ] || { echo "✗ .env.local missing: deploy the backend first"; exit 1; }

  # The Vercel project is connected to GitHub: it builds from main with vercel.json.
  # This sets its Supabase env vars and rebuilds production (pushing to main also redeploys).
  step "Vercel (env vars + production rebuild)"
  node --env-file=.env.deploy.local --env-file=.env.local scripts/vercel-web.mjs
fi

printf '\n\033[1mDone.\033[0m\n'
