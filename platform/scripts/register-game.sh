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

GAME_ID=$(python3 -c "
import json
data = json.loads('''$GAME_JSON''')
print(data.get('id', ''))
")

GAME_SERVICE=$(python3 -c "
import json
data = json.loads('''$GAME_JSON''')
service = data.get('runtime', {}).get('service') or data.get('release', {}).get('runtime', {}).get('service', '')
print(service)
")

GAME_PORT=$(python3 -c "
import json
data = json.loads('''$GAME_JSON''')
port = data.get('runtime', {}).get('port') or data.get('release', {}).get('runtime', {}).get('port', 80)
print(port)
")

GAME_HOSTNAME=$(python3 -c "
import json
data = json.loads('''$GAME_JSON''')
hostname = data.get('hosting', {}).get('hostname') or data.get('release', {}).get('hosting', {}).get('hostname', '')
print(hostname)
")

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
python3 - "$PLATFORM_DIR/registry/games.json" "$GAME_YAML" << 'EOF'
import sys, json, time, yaml

registry_file = sys.argv[1]
game_yaml_path = sys.argv[2]

try:
    with open(registry_file, 'r') as f:
        registry = json.load(f)
except Exception:
    registry = {}

if "repo" not in registry:
    registry["repo"] = {
        "name": {"en-US": "Local Games Platform"},
        "description": {"en-US": "Decentralized collection of hosted HTML5 games."},
        "address": "http://localhost",
        "timestamp": int(time.time()),
        "genres": ["MMORPG", "Puzzle", "Text Adventure", "Arcade", "2D Platformer"]
    }

if "games" not in registry or isinstance(registry["games"], list):
    registry["games"] = {}

with open(game_yaml_path, 'r') as f:
    data = yaml.safe_load(f)

game_id = data.get('id')
if not game_id:
    print("Error: game.yaml is missing an ID.")
    sys.exit(1)

existing_game = registry["games"].get(game_id, {})

now = int(time.time())
added = now
if existing_game and 'metadata' in existing_game:
    added = existing_game['metadata'].get('added', now)

def localize(val):
    if not val:
        return {}
    if isinstance(val, dict):
        return val
    return {"en-US": str(val)}

legacy_meta = data.get('metadata', {})

license_val = data.get('license') or legacy_meta.get('license', 'Unknown')
upstream = data.get('upstream') or legacy_meta.get('upstream', '')
issue_tracker = data.get('issueTracker') or legacy_meta.get('issueTracker', '')

dev_val = data.get('developer') or legacy_meta.get('developer', {})
if isinstance(dev_val, str):
    developer = {"name": dev_val}
elif isinstance(dev_val, dict):
    developer = dev_val
else:
    developer = {"name": "Unknown"}

name = localize(data.get('name') or legacy_meta.get('name'))
if not name:
    name = {"en-US": game_id.capitalize()}

summary = localize(data.get('summary') or legacy_meta.get('summary'))
if not summary:
    desc_en = localize(data.get('description') or legacy_meta.get('description', '')).get('en-US', '')
    summary_en = desc_en.split('.')[0] + '.' if desc_en else f"Play {name.get('en-US')} on WGCP."
    summary = {"en-US": summary_en}

description = localize(data.get('description') or legacy_meta.get('description'))
if not description:
    description = {"en-US": f"Play {name.get('en-US')} on WGCP."}

categories = data.get('categories')
if not categories:
    genre = legacy_meta.get('genre', '')
    import re
    categories = [c.strip() for c in re.split(r'[/,\s]+', genre) if c.strip()]
if not categories:
    categories = ["HTML5"]

multiplayer = data.get('multiplayer')
if multiplayer is None:
    multiplayer = legacy_meta.get('multiplayer', False)

icon_val = None
if 'graphics' in data and 'icon' in data['graphics']:
    icon_val = data['graphics']['icon']
elif 'graphics' in legacy_meta and 'icon' in legacy_meta['graphics']:
    icon_val = legacy_meta['graphics']['icon']
else:
    icon_val = data.get('icon') or legacy_meta.get('icon', '🎮')

icon = localize(icon_val)

screenshots = {}
screenshots_val = None
if 'graphics' in data and 'screenshots' in data['graphics']:
    screenshots_val = data['graphics']['screenshots']
elif 'graphics' in legacy_meta and 'screenshots' in legacy_meta['graphics']:
    screenshots_val = legacy_meta['graphics']['screenshots']

if isinstance(screenshots_val, dict):
    screenshots = screenshots_val
elif isinstance(screenshots_val, list):
    screenshots = {"desktop": [{"name": s} for s in screenshots_val]}

metadata = {
    "added": added,
    "lastUpdated": now,
    "license": license_val,
    "upstream": upstream,
    "issueTracker": issue_tracker,
    "developer": developer,
    "name": name,
    "summary": summary,
    "description": description,
    "categories": categories,
    "multiplayer": multiplayer,
    "graphics": {
        "icon": icon,
        "screenshots": screenshots
    }
}

rel_data = data.get('release', {})
version = rel_data.get('version') or data.get('version') or '1.0.0'
channel = rel_data.get('channel') or 'stable'
whats_new = localize(rel_data.get('whatsNew') or 'Initial release')

runtime = rel_data.get('runtime') or data.get('runtime')
hosting = rel_data.get('hosting') or data.get('hosting')

if not runtime or not hosting:
    print("Error: game.yaml must specify runtime and hosting details")
    sys.exit(1)

release_key = f"{channel}-v{version}"

releases = existing_game.get('releases', {}) if existing_game else {}
releases[release_key] = {
    "added": now,
    "version": version,
    "releaseChannels": [channel],
    "whatsNew": whats_new,
    "runtime": runtime,
    "hosting": hosting
}

registry["games"][game_id] = {
    "metadata": metadata,
    "releases": releases
}

registry["repo"]["timestamp"] = now

with open(registry_file, 'w') as f:
    json.dump(registry, f, indent=2)
EOF

# 6. Update Caddy config & reload
echo "==> Updating gateway configuration..."
"$SCRIPT_DIR/update-caddy.sh"

echo "==> Successfully registered game '$GAME_ID'!"
