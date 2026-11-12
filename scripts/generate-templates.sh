#!/usr/bin/env bash
# Generates starter templates with our own agent (uses AI_PROVIDER from .env).
# Usage: bash scripts/generate-templates.sh [kit ...]   (default: static react-vite)
set -u
cd "$(dirname "$0")/.."
KITS=("${@:-static react-vite}"); [ $# -eq 0 ] && KITS=(static react-vite)
SLUGS=$(node -pe 'Object.keys(require("./scripts/template-briefs.json")).join(" ")')
run() {
  local kit=$1 slug=$2
  local brief; brief=$(node -pe "require('./scripts/template-briefs.json')['$slug'].brief")
  local extra=""; [ "$kit" = "react-vite" ] && extra=" Build it as React components (one per section)."
  AI_EFFORT=high npx tsx scripts/agent-try.ts --fresh --kit "$kit" --out "templates/$kit/$slug" "$brief$extra" > "templates/$kit/$slug.log" 2>&1
  echo "$kit/$slug exit=$?"
}
for kit in "${KITS[@]}"; do
  mkdir -p "templates/$kit"
  pids=()
  for slug in $SLUGS; do run "$kit" "$slug" & pids+=($!); done
  wait "${pids[@]}"
done
echo ALL-DONE
