#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GAME_ID="$1"

if [ -z "$GAME_ID" ]; then
    echo "Usage: $0 <game-id>"
    exit 1
fi

echo "==> Removing game: $GAME_ID"

# 1. Remove from registry
python3 - "$PLATFORM_DIR/registry/games.json" "$GAME_ID" << 'EOF'
import sys, json

registry_file = sys.argv[1]
game_id = sys.argv[2]

try:
    with open(registry_file, 'r') as f:
        registry = json.load(f)
except Exception:
    registry = {"games": {}}

# Migrate/support legacy list format on-the-fly if needed
games = registry.get("games", {})
if isinstance(games, list):
    games = {g.get("id"): g for g in games if g.get("id")}

if game_id in games:
    del games[game_id]

registry["games"] = games

with open(registry_file, 'w') as f:
    json.dump(registry, f, indent=2)
EOF

# 2. Update Caddy config & reload (removes route FIRST so traffic stops immediately)
echo "==> Updating gateway routing table..."
"$SCRIPT_DIR/update-caddy.sh"

# 3. Disconnect Caddy from game network
NETWORK_NAME="${GAME_ID}_default"
if docker ps --format '{{.Names}}' | grep -q "^games-caddy-proxy$"; then
    echo "==> Disconnecting Caddy from network $NETWORK_NAME..."
    docker network disconnect "$NETWORK_NAME" games-caddy-proxy 2>/dev/null || true
fi

# 4. Tear down workload
# Search for game dir either by ID or dirname
GAME_DIR="$PLATFORM_DIR/../games/$GAME_ID"
if [ ! -d "$GAME_DIR" ]; then
    # Try finding directory matching id in game.yaml
    for d in "$PLATFORM_DIR/../games"/*; do
        if [ -f "$d/game.yaml" ]; then
            ID=$(python3 -c "import yaml; print(yaml.safe_load(open('$d/game.yaml')).get('id',''))" 2>/dev/null || true)
            if [ "$ID" = "$GAME_ID" ]; then
                GAME_DIR="$d"
                break
            fi
        fi
    done
fi

if [ -d "$GAME_DIR" ] && [ -f "$GAME_DIR/docker-compose.yml" ]; then
    echo "==> Bringing down Docker Compose stack for $GAME_ID..."
    docker compose -p "$GAME_ID" -f "$GAME_DIR/docker-compose.yml" down
fi

echo "==> Successfully removed game '$GAME_ID'."
