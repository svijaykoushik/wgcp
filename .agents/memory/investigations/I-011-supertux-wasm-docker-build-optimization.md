---
type: Investigation
investigation_id: I-011
title: SuperTux WASM Docker Build Optimization & Decoupling
description: Diagnostic analysis of the SuperTux Docker build pipeline to bypass redundant C++ WASM compilation during HTML/SDK template updates.
start_date: "2026-09-02"
status: completed
result: substantiated
generated: { by: antigravity/3.7, at: 2026-09-02T22:46:00+05:30 }
sources:
  - id: supertux-dockerfile
    resource: /games/supertux/Dockerfile.wasm
    title: SuperTux WASM Dockerfile
  - id: supertux-compose
    resource: /games/supertux/docker-compose.yml
    title: SuperTux Docker Compose Configuration
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML Build Template
  - id: buildinstall-cmake
    resource: /games/supertux/mk/cmake/SuperTux/BuildInstall.cmake
    title: SuperTux BuildInstall CMake Configuration
  - id: register-game-script
    resource: /platform/scripts/register-game.sh
    title: Platform Game Registration Script
---

# Investigation Report (I-011) - SuperTux WASM Docker Build Optimization & Decoupling

## 1. Context & Problem Statement

SuperTux is packaged for the Web Game Console Platform (WGCP) as an Emscripten-compiled WebAssembly game served via Nginx.[^supertux-compose]

Integrating platform capabilities—such as the standalone Game SDK (`wgcp-sdk.js`), capturing-phase Escape key forwarding, storage permission delegation overlays, and the Emscripten IDBFS storage sync bridge—requires modifying the client-side HTML template located at `mk/emscripten/template.html.in`.[^supertux-template]

Under the platform lifecycle:
1. When modifying game client scripts or packaging, agents invoke `./platform.sh game add ./games/supertux`.[^register-game-script]
2. The registration script runs `docker compose -p supertux -f games/supertux/docker-compose.yml up -d --build`.
3. Because `Dockerfile.wasm` is structured as a monolithic multi-stage build,[^supertux-dockerfile] modifying `template.html.in` invalidates Docker's build cache and forces a **full C++ source compilation** via `emmake make`.
4. This results in **15 to 30+ minutes** of CPU-intensive compilation and massive RAM consumption (1-2GB+ per make job) simply to reflect a minor HTML or JavaScript update.

---

## 2. Technical Diagnostics & Findings

### Finding A: Monolithic Build Layer Invalidation
An audit of `games/supertux/Dockerfile.wasm`[^supertux-dockerfile] revealed how the cache is broken:

```dockerfile
# games/supertux/Dockerfile.wasm:42-69
WORKDIR /app
COPY . .  # <-- Line 45: Copies entire repository into builder context

ARG MAKE_JOBS=4

RUN --mount=type=cache,target=/opt/vcpkg/downloads \
    --mount=type=cache,target=/opt/vcpkg/buildtrees \
    --mount=type=cache,target=/opt/vcpkg/packages \
    --mount=type=cache,target=/root/.cache/vcpkg \
    /bin/bash -c "source /opt/emsdk/emsdk_env.sh && \
    mkdir -p build && cd build && \
    emcmake cmake .. -DCMAKE_BUILD_TYPE=Release ... && \
    rsync -aP ../data/ data/ && \
    emmake make -j${MAKE_JOBS} && \
    cp template.html supertux2.html && \
    mkdir upload/ && mv supertux2* upload/ && \
    cd upload/ && mv supertux2.html index.html"
```

* Any change to `template.html.in` modifies the context at `COPY . .` (line 45).
* Docker invalidates all subsequent layers, triggering the monolithic `RUN` command.
* Even with BuildKit cache mounts, re-running CMake, checking hundreds of targets, re-linking `supertux2.wasm` (via `wasm-opt` / `binaryen`), and repacking `data/` into `supertux2.data` consumes excessive compute time.

### Finding B: Independence of Web vs. WASM Engine Artifacts
Inspection of the runtime Nginx container (`/usr/share/nginx/html/`) reveals the following distribution of artifacts:

| Artifact | File Size | Origin | Rebuilt on `template.html.in` change? |
| :--- | :--- | :--- | :--- |
| `supertux2.wasm` | ~9.1 MB | Compiled C++ WASM binary | **No** (Static) |
| `supertux2.data` | ~326 MB | Emscripten asset bundle from `data/` | **No** (Static) |
| `supertux2.js` | ~796 KB | Emscripten JS runtime glue | **No** (Static) |
| `supertux2.ico`, `.png`, `_bkg.png`, `.desktop` | ~150 KB | Static branding and icons | **No** (Static) |
| `index.html` | ~23 KB | Generated from `template.html.in` | **Yes** (The ONLY modified file) |

The heavy engine binaries (`supertux2.wasm`, `supertux2.data`, `supertux2.js`) do **not** depend on `template.html.in`. They only need to be built when C++ engine sources (`src/`), build flags (`CMakeLists.txt`), or raw assets (`data/`) change.

### Finding C: Minimal CMake Variable Substitution
Analysis of `mk/cmake/SuperTux/BuildInstall.cmake`[^buildinstall-cmake] shows how `index.html` is produced:
```cmake
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/mk/emscripten/template.html.in ${CMAKE_CURRENT_BINARY_DIR}/template.html)
```

Grep analysis across `template.html.in` revealed that CMake only substitutes **two** static variables:
1. `@SUPERTUX_VERSION_STRING@` &rarr; `v0.7.0` (in `<link rel="icon" href="supertux2.ico?v=v0.7.0" />`)
2. `@CMAKE_BUILD_TYPE@` &rarr; `Release` (in release-mode UI display checks)

Running a 20-minute C++ toolchain to substitute two string variables in a 23KB HTML file is completely unnecessary.

### Finding D: Host Docker Cache Availability
Local Docker environment inspection confirms that prebuilt base images already exist:
* `supertux-wasm:latest` (Image ID `73059126d038`, 398 MB)
* `supertux-game-supertux:latest` (Image ID `4cffbf49f57c`, 736 MB)

Both images contain the complete set of compiled assets (`supertux2.wasm`, `supertux2.data`, `supertux2.js`, and media files).

---

## 3. Evaluation of Proposed Solutions

### Option 1: Two-Tier Build with Prebuilt Base Image (Recommended)
* **Architecture**:
  1. Maintain `Dockerfile.source` (or a dedicated compilation stage) to build the engine once and output a base image (`supertux-wasm-base:latest`).
  2. Structure `Dockerfile.wasm` as a fast assembly Dockerfile:
     ```dockerfile
     # syntax=docker/dockerfile:1
     ARG BASE_IMAGE=supertux-wasm:latest
     FROM ${BASE_IMAGE} AS prebuilt

     FROM nginx:alpine
     COPY --from=prebuilt /usr/share/nginx/html/ /usr/share/nginx/html/
     COPY mk/emscripten/template.html.in /tmp/template.html.in

     RUN sed -e 's/@SUPERTUX_VERSION_STRING@/v0.7.0/g' \
             -e 's/@CMAKE_BUILD_TYPE@/Release/g' \
             /tmp/template.html.in > /usr/share/nginx/html/index.html && \
         rm /tmp/template.html.in && \
         chmod -R 755 /usr/share/nginx/html/

     EXPOSE 80
     CMD ["nginx", "-g", "daemon off;"]
     ```
* **Pros**:
  - Build time reduced from **~20 minutes to ~2 seconds** (99.8% speedup).
  - Preserves `./platform.sh game add ./games/supertux` compatibility without changing platform CLI scripts.
  - Generates an immutable, production-ready Nginx Docker image.
  - Eliminates host CPU spikes and OOM risks during local development.
* **Cons**: Requires the prebuilt base image to exist locally or in a container registry.

### Option 2: Docker Compose Bind Mount Override (Development Only)
* **Architecture**: Mount `template.html.in` (or pre-rendered `index.html`) directly into `/usr/share/nginx/html/index.html` via `volumes:` in `docker-compose.yml`.
* **Pros**: Zero build time.
* **Cons**:
  - Incompatible with `./platform.sh game add` which always executes `docker compose up -d --build`.
  - Violates the platform's immutable container isolation invariant.

### Option 3: Git-Committed Prebuilt Binaries
* **Architecture**: Extract `supertux2.wasm`, `supertux2.js`, and `supertux2.data` into the repository.
* **Pros**: Portable across machines without pre-existing Docker images.
* **Cons**: `supertux2.data` is **326 MB**, which exceeds standard GitHub file limits (100 MB) without Git LFS configured.

---

## 4. Resolution & Recommended Plan

1. **Tag Stable Base Image**: Tag existing compiled image as `supertux-wasm-base:latest` or reference `supertux-wasm:latest`.
2. **Refactor `Dockerfile.wasm`**:
   - Split `Dockerfile.wasm` into a fast assembly Dockerfile using `ARG BASE_IMAGE=supertux-wasm:latest` as the default source for prebuilt engine binaries.
   - Retain the complete C++ build pipeline in `Dockerfile.source` (or an optional `source-builder` target) for reproducible cold builds.
3. **Template Rendering**:
   - Use a lightweight substitution step in Docker (or a build script) to generate `index.html` from `template.html.in`.
4. **Development Velocity**:
   - Enables instantaneous iteration on `template.html.in` when wiring SDK storage bridge and testing.
