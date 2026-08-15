#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMMAND="$1"
SUBCOMMAND="$2"
TARGET="$3"

case "$COMMAND" in
    game)
        case "$SUBCOMMAND" in
            add|register)
                "$SCRIPT_DIR/platform/scripts/register-game.sh" "$TARGET"
                ;;
            remove|unregister)
                "$SCRIPT_DIR/platform/scripts/remove-game.sh" "$TARGET"
                ;;
            list)
                python3 -m json.tool "$SCRIPT_DIR/platform/registry/games.json"
                ;;
            *)
                echo "Usage: $0 game [add|remove|list] <target>"
                exit 1
                ;;
        esac
        ;;
    start)
        echo "Starting Platform Gateway..."
        "$SCRIPT_DIR/platform/scripts/update-caddy.sh"
        docker compose -f "$SCRIPT_DIR/platform/docker-compose.yml" up -d
        
        # Connect Caddy to networks of all currently registered games
        python3 - "$SCRIPT_DIR/platform/registry/games.json" << 'EOF'
import sys, json, subprocess
try:
    data = json.load(open(sys.argv[1]))
    games = data.get("games", {})
    if isinstance(games, list):
        gids = [g.get("id") for g in games if g.get("id")]
    else:
        gids = list(games.keys())
    for gid in gids:
        net = f"{gid}_default"
        subprocess.run(["docker", "network", "connect", net, "games-caddy-proxy"], stderr=subprocess.DEVNULL)
except Exception:
    pass
EOF
        echo "Platform Gateway running on http://localhost"
        ;;
    stop)
        echo "Stopping Platform Gateway..."
        docker compose -f "$SCRIPT_DIR/platform/docker-compose.yml" down
        ;;
    *)
        echo "Usage: $0 [start|stop|game]"
        echo "  $0 start                   - Start the platform proxy"
        echo "  $0 stop                    - Stop the platform proxy"
        echo "  $0 game add <path>         - Register and start a game"
        echo "  $0 game remove <game-id>   - Unregister and stop a game"
        echo "  $0 game list               - List registered games"
        exit 1
        ;;
esac
