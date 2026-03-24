# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpaceVoids is a pixel-art top-down RPG built with vanilla JavaScript and Three.js r128. It runs on `file://` protocol (no build tools, no localhost required). All game assets (tile textures) are embedded as base64-encoded RGB data directly in the JS files to avoid CORS issues.

## Running the Game

Open `index.html` directly in a browser. No build step, no server needed.

Alternatively: `npx serve .` for HTTP serving.

## Architecture

**Module pattern**: All JS files use IIFEs that export a global object (e.g., `const World = (() => { ... return { ... }; })();`). No ES6 modules or bundler.

**Script load order matters** (index.html):
1. Three.js (CDN) → 2. utils.js → 3. menu.js → 4. world.js → 5. player.js → 6. game.js → 7. main.js

**Module responsibilities**:
- `Utils` — math helpers (lerp, clamp, randInt)
- `Menu` — main menu background animation (stars + rotating planet), keyboard nav
- `World` — procedural world generation, tile rendering, water shader, tile textures
- `Player` — sprite rendering, movement, collision
- `Game` — Three.js renderer/camera/scene, game loop, save/load (localStorage)
- `main.js` — entry point, wires menu ↔ game transitions, changelog popup

## Key Constants

- `TILE_W = TILE_H = 16` (world pixels per tile)
- `SCALE = 4` (in game.js; 1 world pixel = 4 screen pixels)
- `MAP_COLS = MAP_ROWS = 50`
- Tile types: `T = { GRASS:0, DIRT:1, WATER:2, TREE:3, STONE:4, FLOWER:5, PATH:6 }`

## Rendering Pipeline

- **Ground**: Static canvas texture (painted once per game via `_paintBaseLayer`) on a PlaneGeometry mesh (renderOrder=0)
- **Water**: Separate ShaderMaterial mesh with GLSL animation (renderOrder=0.5). Uniforms updated each frame via `updateWater(gameTime)`
- **Trees**: InstancedMesh with procedural canvas sprites (renderOrder=1)
- **Player**: Canvas-drawn sprite updated every frame, CanvasTexture with `needsUpdate=true` (renderOrder=2)

## Tile Textures

Tile images (Green.png, Flower.png, Grassflower.png, Rock.png, Water2.png) are decoded from PNG in Python, converted to raw RGB bytes, base64-encoded, and embedded in world.js. Grass tiles use 1-of-3 variant selection per tile `((col*7 + row*13) % 3)` with 2px edge blending. Each tile image is scaled to fit one 16×16 game tile via `Math.floor(px * imgWidth / TILE_W)`.

## Coordinate System

- World: origin top-left, Y increases downward
- Three.js: Y is up, so positions use negated Y: `mesh.position.set(x, -y, z)`
- Camera: Orthographic, follows player with easing

## Critical Constraints

- **file:// protocol**: Cannot use `Image()`, `fetch()`, or `drawImage()` with external files (CORS). All pixel data must be embedded in JS.
- **Three.js r128**: WebGL 1 GLSL (no `#version 300 es`). Variable array indexing not allowed in GLSL ES 1.0 — use if/else chains.
- **PNG decoding**: When extracting pixels from PNG files, check `color_type`. Type 6 = RGBA (4 bytes/pixel) — must skip alpha channel when extracting RGB.
- **world.js is large** (~400KB+) due to embedded base64 tile data. Use `sed` or offset/limit reads.

## Version System

Version displayed in bottom-right of main menu (index.html `#version-label`). Changelog entries in `#changelog-content`. Increment last number (1.0.X) for each update; middle number on user request.

**IMPORTANT**: Always update the version after making changes:
1. Increment the version number in `#version-label` in index.html
2. Add a `<p><b>vX.X.X</b> - Description</p>` entry at the top of `#changelog-content` in index.html
3. Do NOT skip version updates — every meaningful change gets a version bump
