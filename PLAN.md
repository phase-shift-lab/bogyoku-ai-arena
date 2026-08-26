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

## Phase 6 — Mobile board and opening selection

- [x] make board taps immediate and preserve selection after an invalid destination tap
- [x] refresh the board, coordinates, and pieces with a compact warm-wood game UI
- [x] replace the strategy dropdown with horizontally scrollable strategy cards
- [x] add four side-symmetric surprise-opening guides with evaluation-based fallback
- [x] enlarge candidate and sound checkboxes for touch operation

## Phase 7 — Compact strategy controls and move trace

- [x] remove the hero catchphrase and duplicate Bogyoku preset
- [x] render strategy choices as compact wrapped cards and unify tuning under surprise intensity
- [x] tune Bogyoku and surprise-opening evaluation limits from that intensity
- [x] highlight the previous origin/destination and show the latest KIF move

## Phase 8 — Expanded surprise strategy selection

- [x] expand the catalog to fifteen strategies including minor surprise openings
- [x] add normal, specified surprise, and automatic surprise selection modes
- [x] support side-symmetric, branch-aware opening guides with legal-move fallback
- [x] lock automatic selections per game and provide separate AI-vs-AI side settings
- [x] keep strategy selection compact and touch-friendly on mobile

## Phase 9 — Persistent strategy palette and opening guides

- [x] keep all surprise strategy cards visible in normal, specified, and automatic modes
- [x] switch to specified mode when a visible strategy card is selected
- [x] add a basic sequence and ideal formation for all fourteen non-Bogyoku surprises
- [x] resume from a legal setup move after deviations, with side-symmetric mirroring
- [x] preserve legality checks, evaluation limits, and unrestricted-engine fallback

## Phase 10 — Adaptive surprise opening policy (廃止)

学習による戦法・分岐の適応は採用せず、固定カタログと既存の合法手・安全性・評価ロジックを使用する。

## Phase 11 — Anonymous cross-device shared learning (廃止)

共有学習、外部API、専用サーバーは採用しない。棋譜・局面・指し手・評価値・解析結果はブラウザ内だけで扱う。
