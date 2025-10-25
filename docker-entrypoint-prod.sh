#!/usr/bin/env bash
set -euo pipefail

# Launches VOICEVOX engine and the Discord bot in the same container.

ENGINE_HOST="${VOICEVOX_HOST:-0.0.0.0}"
ENGINE_PORT="${VOICEVOX_PORT:-50021}"

if [[ -z "${VOICEVOX_API_URL:-}" ]]; then
  export VOICEVOX_API_URL="http://127.0.0.1:${ENGINE_PORT}"
fi

mkdir -p /app/logs /app/db

ENGINE_CMD=(gosu user /opt/voicevox_engine/run --host "${ENGINE_HOST}" --port "${ENGINE_PORT}")
if [[ -n "${VOICEVOX_ENGINE_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  ENGINE_CMD+=(${VOICEVOX_ENGINE_ARGS})
fi

"${ENGINE_CMD[@]}" &
engine_pid=$!

cleanup() {
  if ps -p "${engine_pid}" >/dev/null 2>&1; then
    kill "${engine_pid}" 2>/dev/null || true
    wait "${engine_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd /app
gosu user npm run start:deploy
