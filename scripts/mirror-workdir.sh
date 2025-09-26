#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME=$(basename "$0")
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"

show_help() {
  cat <<'USAGE'
Usage: mirror-workdir.sh --dest <path> [--dry-run] [--watch] [--interval <seconds>] [--daemon] [--log <file>] [--pid-file <file>]

Mirrors the repository (excluding build artifacts and patterns from .gitignore)
into the specified destination using rsync.

Options:
  --dest <path>    Destination directory to mirror into (required).
  --dry-run        Show what would be copied/removed without making changes.
  --watch          Continuously sync using a simple polling loop.
  --interval <s>   Seconds between sync attempts when --watch is enabled (default: 2).
  --daemon         Detach and keep syncing in the background (implies --watch).
  --log <file>     Log output when running with --daemon (default: <dest>/.mirror-workdir.log).
  --pid-file <f>   Write background process PID to this file when --daemon is used.
  -h, --help       Display this help message.
USAGE
}

DEST=""
RSYNC_ARGS=(-a --delete)
WATCH=0
INTERVAL=2
DAEMON=0
LOG_FILE=""
PID_FILE=""
QUIET=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)
      DEST="$2"
      shift 2
      ;;
    --dry-run)
      RSYNC_ARGS+=(--dry-run)
      DRY_RUN=1
      QUIET=0
      shift
      ;;
    --watch)
      WATCH=1
      shift
      ;;
    --interval)
      INTERVAL="$2"
      shift 2
      ;;
    --daemon)
      DAEMON=1
      WATCH=1
      shift
      ;;
    --log)
      LOG_FILE="$2"
      shift 2
      ;;
    --pid-file)
      PID_FILE="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

if [[ -z "$DEST" ]]; then
  echo "Error: --dest is required." >&2
  show_help
  exit 1
fi

SRC_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEST_DIR=$(cd "$DEST" 2>/dev/null || mkdir -p "$DEST" && cd "$DEST" && pwd)

EXCLUDES=(
  '--exclude=.git/'
  '--exclude=node_modules/'
  '--exclude=dist/'
  '--exclude=android/.gradle/'
  '--exclude=android/build/'
  '--exclude=android/app/build/'
  '--exclude=ios/'
  '--exclude=.pnpm-store/'
  '--exclude=.idea/'
  '--exclude=.vscode/'
)

RSYNC_CMD=()

build_rsync_cmd() {
  RSYNC_CMD=(rsync "${RSYNC_ARGS[@]}" -v)
  RSYNC_CMD+=("${EXCLUDES[@]}")
  RSYNC_CMD+=("--filter=:- .gitignore" "$SRC_DIR/" "$DEST_DIR/")
}

run_sync() {
  build_rsync_cmd
  if [[ "$QUIET" -eq 1 ]]; then
    local output filtered
    if output=$("${RSYNC_CMD[@]}" 2>&1); then
      filtered=$(printf '%s\n' "$output" | sed -e '/^sending incremental file list$/d' \
        -e '/^sent [0-9].* bytes.*$/d' -e '/^total size is .*$/d' -e '/^$/d')
      if [[ -n "$filtered" ]]; then
        printf '%s\n' "$filtered"
      fi
    else
      printf '%s\n' "$output" >&2
      return 1
    fi
  else
    echo "Running: ${RSYNC_CMD[*]}" >&2
    "${RSYNC_CMD[@]}"
  fi
}

if [[ "$DAEMON" -eq 1 ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Error: --dry-run cannot be combined with --daemon." >&2
    exit 1
  fi
  [[ -z "$LOG_FILE" ]] && LOG_FILE="$DEST_DIR/.mirror-workdir.log"
  [[ -z "$PID_FILE" ]] && PID_FILE="$SRC_DIR/daemon_file"

  if ! command -v nohup >/dev/null; then
    echo "Error: nohup is required for --daemon mode." >&2
    exit 1
  fi

  CMD=("$SCRIPT_PATH" --dest "$DEST_DIR" --watch --interval "$INTERVAL")
  nohup "${CMD[@]}" >> "$LOG_FILE" 2>&1 &
  DAEMON_PID=$!
  if [[ -n "$PID_FILE" ]]; then
    echo "$DAEMON_PID" > "$PID_FILE"
  fi
  echo "Mirror daemon started (PID $DAEMON_PID). Logging to $LOG_FILE" >&2
  exit 0
fi

if [[ "$WATCH" -eq 1 ]]; then
  QUIET=1
  while true; do
    run_sync
    sleep "$INTERVAL"
  done
else
  run_sync
fi
