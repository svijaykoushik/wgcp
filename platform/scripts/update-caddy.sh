#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_CADDYFILE="$PLATFORM_DIR/Caddyfile.base"
FINAL_CADDYFILE="$PLATFORM_DIR/Caddyfile"
REGISTRY_FILE="$PLATFORM_DIR/registry/games.json"

cp "$BASE_CADDYFILE" "$FINAL_CADDYFILE"

python3 - "$REGISTRY_FILE" "$FINAL_CADDYFILE" << 'EOF'
import sys
import json

registry_file = sys.argv[1]
caddy_file = sys.argv[2]

try:
    with open(registry_file, 'r') as f:
        data = json.load(f)
except Exception:
    data = {"games": {}}

games = data.get("games", {})

# Support legacy array if not migrated yet
if isinstance(games, list):
    games_list = games
else:
    games_list = []
    for gid, gameObj in games.items():
        # Get active/stable release or fallback
        active_release = None
        releases = gameObj.get("releases", {})
        if releases:
            # Find stable first
            stable_releases = [r for r in releases.values() if "stable" in r.get("releaseChannels", [])]
            if stable_releases:
                active_release = stable_releases[0]
            else:
                active_release = list(releases.values())[0]
        
        mapped_game = {
            "id": gid,
            "hosting": active_release.get("hosting", {}) if active_release else gameObj.get("hosting", {}),
            "runtime": active_release.get("runtime", {}) if active_release else gameObj.get("runtime", {})
        }
        games_list.append(mapped_game)

seen_hosts = set()
with open(caddy_file, 'a') as f:
    for game in games_list:
        hostname = game.get("hosting", {}).get("hostname")
        service = game.get("runtime", {}).get("service")
        port = game.get("runtime", {}).get("port", 80)
        
        if hostname and service and hostname not in seen_hosts:
            seen_hosts.add(hostname)
            f.write(f"\nhttp://{hostname} {{\n")
            f.write(f"    reverse_proxy {service}:{port}\n")
            f.write("}\n")
EOF

if docker ps --format '{{.Names}}' | grep -q "^games-caddy-proxy$"; then
    echo "Reloading Caddy configuration..."
    docker exec games-caddy-proxy caddy reload --config /etc/caddy/Caddyfile
fi
