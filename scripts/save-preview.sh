#!/usr/bin/env bash
# Plan morning-digest § 3/§ 4: run rig, save one page as a single self-contained HTML file.
# Usage: scripts/save-preview.sh [night] [out]   (defaults: 2026-10-28, var/preview/index.html)
# The banner shows LANE_MARKER from the environment or .env; run with LANE_MARKER= to save it
# without the marker (ADR 0003). Previews never go into the repo: var/ is git-ignored.
set -euo pipefail
night="${1:-2026-10-28}"
out="${2:-var/preview/index.html}"
port="${PREVIEW_PORT:-8799}"
mkdir -p "$(dirname "$out")"

# A LANE_MARKER set in the environment (even empty) wins over the one in .env.
envfile=.env
if [ -n "${LANE_MARKER+set}" ] && [ -f .env ]; then
  envfile="$(mktemp)"
  grep -v '^LANE_MARKER=' .env >"$envfile" || true
fi
if curl -fsS "http://localhost:$port/health" >/dev/null 2>&1; then
  echo "port $port is already in use; stop that rig first" >&2
  exit 1
fi
PORT="$port" npx --no-install tsx --env-file-if-exists="$envfile" src/server.ts >/dev/null 2>&1 &
pid=$!
stop() {
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
trap stop EXIT

for _ in $(seq 1 50); do
  curl -fsS "http://localhost:$port/health" >/dev/null 2>&1 && break
  sleep 0.2
done

curl -fsS "http://localhost:$port/digest/$night" -o "$out"
echo "saved /digest/$night -> $out ($(wc -c <"$out" | tr -d ' ') bytes)"
grep -o '<span class="marker">[^<]*</span>' "$out" || true
