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
    data = {"games": []}

games = data.get("games", [])

seen_hosts = set()
with open(caddy_file, 'a') as f:
    for game in games:
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
