# SpaceVoids

A web-based pixel RPG with a Stardew Valley-style top-down view, built with vanilla HTML5 Canvas and JavaScript — no frameworks, no build step.

## Features

- **Retro pixel main menu** with animated star field, perspective ground grid, and floating dust particles
- **Procedurally generated world** using value noise — grass, dirt, water, stone, paths, flowers, and trees
- **16×16 pixel-art tiles** rendered at 4× scale via a texture cache (crisp, no blurring)
- **Animated water** with moving shimmer lines
- **Keyboard navigation** in menus (↑ ↓ / Enter)
- **Save / load system** with 3 slots backed by `localStorage`
- **Smooth camera** that follows the player with easing

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |
| `Esc` | Return to menu (auto-saves to slot 1) |

## Getting Started

No install or build required — just open the file in a browser:

```bash
open index.html
```

Or serve it locally for best results:

```bash
npx serve .
# then visit http://localhost:3000
```

## Project Structure

```
spacevoids/
├── index.html          # Entry point
├── css/
│   └── style.css       # Retro pixel theme, menu, HUD
└── js/
    ├── utils.js        # Shared math helpers
    ├── menu.js         # Animated main menu + keyboard nav
    ├── world.js        # Tilemap generation, texture cache, rendering
    ├── player.js       # Movement, collision, walk animation
    ├── game.js         # Game loop, camera, save/load
    └── main.js         # App entry — wires menu ↔ game
```

## Tech

- **HTML5 Canvas 2D** for all rendering
- **Press Start 2P** (Google Fonts) for the pixel font
- **localStorage** for save data
- No dependencies, no bundler
