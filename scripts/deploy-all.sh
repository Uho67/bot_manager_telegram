#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="bot_manager"
INSTANCES=(
  "/var/www/lunvo"
  "/var/www/sell_bot_nest"
  "/var/www/siga"
)

deploy_instance() {
  local path="$1"
  local name
  name="$(basename "$path")"

  echo ""
  echo "=========================================="
  echo "  Deploying: $name ($path)"
  echo "=========================================="

  ssh "$SSH_HOST" "bash $path/scripts/deploy.sh"
}

FAILED=()

for instance in "${INSTANCES[@]}"; do
  if ! deploy_instance "$instance"; then
    echo "[ERROR] Failed: $instance" >&2
    FAILED+=("$instance")
  fi
done

echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "All instances deployed successfully."
else
  echo "Deploy completed with failures:"
  for f in "${FAILED[@]}"; do
    echo "  - $f"
  done
  exit 1
fi
