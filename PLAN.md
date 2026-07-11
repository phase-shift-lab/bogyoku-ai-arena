# Implementation plan

## Phase 0 — Foundation

- [x] React + Vite + TypeScript scaffold
- [x] responsive arena shell and design tokens
- [x] ESLint, Prettier, Vitest, Playwright, CI
- [x] licensing and reproducibility document skeletons

## Phase 1 — Legal shogi application

- [x] add `shogiops`
- [x] interactive 9x9 board
- [x] legal moves, promotion, drops, repetition, checkmate, SFEN/KIF import-export
- [x] game reducer and versioned persistence boundary

## Phase 2 — YaneuraOu WASM / USI

- [x] pin an official upstream revision
- [x] document and automate Emscripten builds
- [x] generate threaded and single-thread WASM variants
- [x] implement USI Worker lifecycle, stop/restart, timeout, and runtime fallback

## Phase 3 — Bogyoku strategy

- [x] define feature schema and opening-phase weights
- [x] add position-aware, side-symmetric Bogyoku planning and USI `searchmoves` integration
- [x] add evaluation decomposition and tuning UI
- [x] validate both-side routes, safety, intensity, and scoring against fixtures

## Phase 4 — Product modes

- [x] human vs AI, AI vs AI, analysis, and variation tree
- [x] side selection, board orientation, preset levels, handicap, pause/resume, and autosave
- [x] device-aware Hash/Threads presets and runtime warnings

## Phase 5 — Release preparation

- [x] Chromium, Firefox, WebKit, desktop, and mobile E2E coverage
- [x] benchmark protocol and license audit
- [x] GitHub Pages workflow and cross-origin-isolation service-worker path
- [x] operator and troubleshooting documentation
- [ ] publish and verify the actual GitHub Pages URL (operator action; not performed by Codex)
