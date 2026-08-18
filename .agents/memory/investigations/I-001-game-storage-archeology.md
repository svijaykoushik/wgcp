---
type: Investigation
investigation_id: I-001
title: Games Storage & State Persistence Archeology
description: Archeological analysis identifying how each registered game stores player data, assets, config, and progress.
start_date: "2026-08-17"
status: completed
result: substantiated
generated: { by: antigravity/2.0, at: 2026-08-17T22:52:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-17T22:52:00Z }
sources:
  - id: games-directory
    resource: /games/
    title: WGCP Games Directory
---

# Investigation Report (I-001) - Games Storage & State Persistence Archeology

This investigation was conducted to analyze how each game on the Web Game Console Platform (WGCP) stores its player data, assets, configuration, and player progress. The five games examined are: `2048`, `BrowserQuest`, `adarkroom` (A Dark Room), `hextris`, and `supertux` (SuperTux).

---

## 1. 2048

* **Progress & Player Data Storage**:
  * Managed client-side by [`local_storage_manager.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/2048/js/local_storage_manager.js).
  * Persisted via the browser's `window.localStorage` object, falling back to an in-memory dictionary (`window.fakeStorage`) if local storage is not supported.
  * State is mapped under two distinct storage keys:
    * `"bestScore"`: Persists the highest numeric score achieved.
    * `"gameState"`: JSON string representing the active board grid tiles, current score, game-over status, and play-on flag.
* **Assets**:
  * Standard static assets served locally relative to the root page [`index.html`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/2048/index.html).
  * Main stylesheet is [`style/main.css`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/2048/style/main.css).
  * Application JS files are structured inside the `js/` folder.
* **Config**:
  * Coded as static defaults inside JS helper modules.
  * Layout scaling configurations are declared inside the index CSS and standard HTML metadata viewport constraints.
  * Inputs and key bindings (Arrow keys, WASD, Swipe gestures) are statically defined inside [`keyboard_input_manager.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/2048/js/keyboard_input_manager.js).

---

## 2. BrowserQuest

* **Progress & Player Data Storage**:
  * Saved client-side in `window.localStorage` under the key `"data"`.
  * Managed by [`storage.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/BrowserQuest/client/js/storage.js), storing a JSON structure containing:
    * `hasAlreadyPlayed`: Boolean flag indicating return user status.
    * `player`: Object containing player `name`, current `weapon` sprite, current `armor` sprite, and client-side character `image`.
    * `achievements`: Object containing unlocked achievements array and stats tracking counts (rats killed, skeletons killed, total dmg taken, total revives).
  * **Server-Side Persistence**: The game server does not integrate with any database. All websocket players, coordinates, and health pools are tracked purely in-memory.
  * **Synchronization**: On connection handshake, the client retrieves its local store, and transmits the username and equipment IDs to the server inside a WebSocket `HELLO` message defined in [`gameclient.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/BrowserQuest/client/js/gameclient.js):
    ```javascript
    sendHello: function(player) {
        this.sendMessage([Types.Messages.HELLO,
                          player.name,
                          Types.getKindFromString(player.getSpriteName()),
                          Types.getKindFromString(player.getWeaponName())]);
    }
    ```
* **Assets**:
  * Static sprite art, map tiles, and assets are hosted client-side under the `client/` folder:
    * Spritesheets and UI art assets reside in `client/img/` and `client/sprites/`.
    * Audio soundtrack files reside in `client/audio/`.
    * Tilemap descriptors are stored in `client/maps/`.
* **Config**:
  * **Server Config**: Placed in [`config.json`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/BrowserQuest/server/config.json) or [`config_docker.json`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/BrowserQuest/server/config_docker.json), defining connection properties (`port`), instance rules (`nb_players_per_world`, `nb_worlds`), and game data targets (`map_filepath`).
  * **Client Config**: Placed in [`config_build.json`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/BrowserQuest/client/config/config_build.json) to declare the target host/port for socket connection.

---

## 3. A Dark Room

* **Progress & Player Data Storage**:
  * Stored in the browser's `localStorage` under the key `"gameState"`.
  * Handled via `StateManager` (`$SM`) in [`state_manager.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/adarkroom/script/state_manager.js) and written to storage by `Engine.saveGame()` in [`engine.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/adarkroom/script/engine.js).
  * Structure separates concerns between:
    * `features`: Unlocked modules, structures, and systems.
    * `stores`: Current items, counts, and materials.
    * `character`: Current character status, perks, and traits.
    * `income`: Active production ticks (woodcutters, traps, etc.).
    * `timers`, `game`, `playStats`, `previous`, `outfit`, `config`, and `cooldown`.
  * **Cloud Save Sync**:
    * Managed inside [`dropbox.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/adarkroom/script/dropbox.js) using the Dropbox Datastore API (using key `'q7vyvfsakyfmp3o'` under the table `'adarkroom'`).
    * Encodes game data in base64 to keep up to 5 individual save slots.
* **Assets**:
  * Text-based game with styled CSS layouts inside `css/`.
  * Text translations are loaded from JS lang modules in `lang/`.
  * Audio tracks and sound effects are stored locally in the `audio/` directory.
  * Static images (logos, icons) are stored in the `img/` directory.
* **Config**:
  * Sound and layout preferences are saved directly under the `config` subkey inside `localStorage.gameState` (e.g. `config.soundOn`).
  * The user language configuration is stored under `localStorage.lang`.

---

## 4. Hextris

* **Progress & Player Data Storage**:
  * High scores and active states are stored in browser `localStorage`.
  * Saving is controlled within [`save-state.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/hextris/js/save-state.js).
  * Keys used:
    * `"highscores"`: Sorted array of high scores, serialized as a JSON string and capped to the top 3 scores.
    * `"saveState"`: JSON string representing the state of the active/paused game, serialized with `JSONfn.stringify`.
  * The save state object tracks `hex` (rotation & blocks), `blocks` (falling block grids), `score`, `wavegen` (wave generator), `gdx`/`gdy` (offsets), and `comboTime`.
* **Assets**:
  * Static web assets structured within game directory subfolders:
    * Scripts in `js/`.
    * Styling sheets in `style/`.
    * Images and fonts in `images/`.
    * Third-party libraries (jQuery, JSONfn, Hammer.js, FontAwesome) are loaded locally from `vendor/`.
* **Config**:
  * Core settings (fall speeds, difficulty multipliers, scales, combo timing limits) are hardcoded as configuration constants inside [`initialization.js`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/hextris/js/initialization.js).

---

## 5. SuperTux

* **Progress, Config & Player Data Storage**:
  * Ported to WebAssembly, using the Emscripten IndexedDB File System (`IDBFS`) to achieve persistence.
  * The virtual home directory is defined in [`main.cpp`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/supertux/src/supertux/main.cpp):
    ```cpp
    m_userdir = "/home/web_user/.local/share/supertux2/";
    ```
  * During startup, the directory is mounted and synced from the browser database to the in-memory files:
    ```javascript
    FS.mount(IDBFS, {}, m_userdir);
    FS.syncfs(true, (err) => { console.log(err); });
    ```
  * PhysFS compiles configuration files, world progress, and savegames to this virtual directory.
  * **Synchronization**: At the end of every loop iteration (`loop_iter` in [`screen_manager.cpp`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/supertux/src/supertux/screen_manager.cpp)), the JS routine `supertux2_syncfs()` executes `FS.syncfs(false, ...)` (defined in [`template.html.in`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/games/supertux/mk/emscripten/template.html.in)) to sync all updates back to the browser's IndexedDB.
* **Assets**:
  * Compiled game assets (levels, sound, graphics, scripts, fonts) are placed in the `data/` directory.
  * During the WASM build process (`Dockerfile.wasm`), the asset pack is copied to the build target and read by the executable using the static virtual filesystem.
* **Config**:
  * Config details are stored in standard C++ config syntax in `/home/web_user/.local/share/supertux2/config` inside the virtual path (persisted via IndexedDB).

---

## Conclusion & Recommendations

All HTML5 games in the WGCP workspace execute storage completely client-side in the browser:
1. Four games (`2048`, `BrowserQuest`, `adarkroom`, and `hextris`) store game state using standard key-value browser `localStorage`.
2. The compiled WASM game (`supertux`) mounts a virtual filesystem to store directories and configs, backed by browser `IndexedDB` with asynchronous flush cycles.
3. Server-side architecture is purely transactional/in-memory (as demonstrated by `BrowserQuest`), and does not require database orchestration on the platform layer.
