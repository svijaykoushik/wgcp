#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GAME_PATH="$1"

if [ -z "$GAME_PATH" ]; then
    echo "Usage: $0 <path-to-game>"
    exit 1
fi

GAME_DIR="$(cd "$GAME_PATH" && pwd)"
GAME_YAML="$GAME_DIR/game.yaml"

if [ ! -f "$GAME_YAML" ]; then
    echo "Error: game.yaml not found at $GAME_YAML"
    exit 1
fi

# Parse metadata from game.yaml using python3
GAME_JSON=$(python3 -c "
import yaml, json
with open('$GAME_YAML') as f:
    data = yaml.safe_load(f)
print(json.dumps(data))
")

GAME_ID=$(python3 -c "import json; print(json.loads('''$GAME_JSON''').get('id', ''))")
GAME_SERVICE=$(python3 -c "import json; print(json.loads('''$GAME_JSON''').get('runtime', {}).get('service', ''))")
GAME_PORT=$(python3 -c "import json; print(json.loads('''$GAME_JSON''').get('runtime', {}).get('port', 80))")
GAME_HOSTNAME=$(python3 -c "import json; print(json.loads('''$GAME_JSON''').get('hosting', {}).get('hostname', ''))")

if [ -z "$GAME_ID" ] || [ -z "$GAME_SERVICE" ] || [ -z "$GAME_HOSTNAME" ]; then
    echo "Error: game.yaml must specify id, runtime.service, and hosting.hostname"
    exit 1
fi

echo "==> Registering game: $GAME_ID ($GAME_HOSTNAME)"

# 1. Bring up docker workload using compose in game directory
echo "==> Launching workload via Docker Compose..."
docker compose -p "$GAME_ID" -f "$GAME_DIR/docker-compose.yml" up -d --build

# 2. Get network name created by compose stack (typically ${GAME_ID}_default)
NETWORK_NAME="${GAME_ID}_default"

# 3. Connect Caddy to the game's isolated network if Caddy is running
if docker ps --format '{{.Names}}' | grep -q "^games-caddy-proxy$"; then
    echo "==> Connecting Caddy gateway to network $NETWORK_NAME..."
    docker network connect "$NETWORK_NAME" games-caddy-proxy 2>/dev/null || true
fi

# 4. Verify workload health / reachability
echo "==> Verifying workload health for container '$GAME_SERVICE'..."
MAX_RETRIES=40
RETRY_COUNT=0
HEALTHY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$GAME_SERVICE" 2>/dev/null || echo "not_found")
    HEALTH_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}healthy{{end}}' "$GAME_SERVICE" 2>/dev/null || echo "unhealthy")

    if [ "$CONTAINER_STATUS" = "running" ] && [ "$HEALTH_STATUS" = "healthy" ]; then
        HEALTHY=1
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for container $GAME_SERVICE to be healthy ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 1
done

if [ $HEALTHY -eq 0 ]; then
    echo "Error: Container $GAME_SERVICE failed health check."
    exit 1
fi

# 5. Update registry (idempotent: replace if existing, append if new)
python3 - "$PLATFORM_DIR/registry/games.json" "$GAME_JSON" << 'EOF'
import sys, json

registry_file = sys.argv[1]
game_data = json.loads(sys.argv[2])
game_id = game_data.get("id")

try:
    with open(registry_file, 'r') as f:
        registry = json.load(f)
except Exception:
    registry = {"games": []}

games = registry.get("games", [])
# Remove existing entry with same ID if present
games = [g for g in games if str(g.get("id")) != str(game_id)]
games.append(game_data)
registry["games"] = games

with open(registry_file, 'w') as f:
    json.dump(registry, f, indent=2)
EOF

# 6. Update Caddy config & reload
echo "==> Updating gateway configuration..."
"$SCRIPT_DIR/update-caddy.sh"

echo "==> Successfully registered game '$GAME_ID'!"
