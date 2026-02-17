#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"

PEARL_DIR="${PEARL_DIR:-$REPO_DIR}"
PEARL_PORT="${PEARL_PORT:-8081}"
PEARL_HOST="${PEARL_HOST:-127.0.0.1}"
PEARL_HEALTH_URL="${PEARL_HEALTH_URL:-http://${PEARL_HOST}:${PEARL_PORT}/health}"
PEARL_LOG="${PEARL_LOG:-${PEARL_DIR}/pearl-data/autostart-pearl.log}"

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_TAGS_URL="${OLLAMA_TAGS_URL:-${OLLAMA_BASE_URL}/api/tags}"
OLLAMA_LOG="${OLLAMA_LOG:-/tmp/openclaw-pearl-ollama.log}"
OLLAMA_WARM_MODEL="${OLLAMA_WARM_MODEL:-llama3.2:3b}"

WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-60}"
WAIT_INTERVAL_SECONDS="${WAIT_INTERVAL_SECONDS:-1}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local waited=0
  while ! curl -fsS "$url" >/dev/null 2>&1; do
    sleep "$WAIT_INTERVAL_SECONDS"
    waited=$((waited + WAIT_INTERVAL_SECONDS))
    if (( waited >= WAIT_TIMEOUT_SECONDS )); then
      echo "Timed out waiting for ${url}" >&2
      return 1
    fi
  done
}

start_ollama_if_needed() {
  if curl -fsS "$OLLAMA_TAGS_URL" >/dev/null 2>&1; then
    echo "Ollama already running."
    return 0
  fi

  echo "Starting Ollama service..."
  nohup ollama serve >"$OLLAMA_LOG" 2>&1 &
  wait_for_url "$OLLAMA_TAGS_URL"
  echo "Ollama is ready."
}

ensure_warm_model() {
  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -Fxq "$OLLAMA_WARM_MODEL"; then
    return 0
  fi

  echo "Pulling Ollama model: $OLLAMA_WARM_MODEL"
  ollama pull "$OLLAMA_WARM_MODEL"
}

warm_model() {
  curl -fsS "${OLLAMA_BASE_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${OLLAMA_WARM_MODEL}\",\"prompt\":\"ping\",\"stream\":false,\"keep_alive\":\"30m\"}" \
    >/dev/null || true
}

start_pearl_if_needed() {
  if curl -fsS "$PEARL_HEALTH_URL" >/dev/null 2>&1; then
    echo "Pearl already running."
    return 0
  fi

  echo "Starting Pearl server..."
  mkdir -p "$(dirname -- "$PEARL_LOG")"
  (
    cd "$PEARL_DIR"
    nohup npm start >"$PEARL_LOG" 2>&1 &
  )
  wait_for_url "$PEARL_HEALTH_URL"
  echo "Pearl is ready."
}

main() {
  require_cmd curl
  require_cmd npm
  require_cmd ollama
  require_cmd openclaw

  start_ollama_if_needed
  ensure_warm_model
  warm_model
  start_pearl_if_needed

  exec openclaw tui "$@"
}

main "$@"
