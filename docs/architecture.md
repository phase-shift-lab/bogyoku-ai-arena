# Architecture

## Boundaries

- `src/app`: UI composition, modes, orchestration, and top-level state
- `src/game`: legal game state, notation, presets, reducer, and persistence schema
- `src/engine`: runtime selection, typed USI Worker bridge, lifecycle, and fallback
- `src/strategy/bogyoku`: profiles, position-aware planner, scoring, tactical safety, and final move selection
- `src/components`: board and reusable visual components
- `public/engine` and `src/engine/runtime`: reproducibly built, byte-identical engine artifacts
- `public/models`: reserved for approved evaluation assets; currently empty

The React main thread never executes engine search. Each engine instance is owned by a Web Worker; the UI exchanges typed commands and results with it.

## Runtime selection

Threaded WASM is preferred only when the page is cross-origin isolated and `SharedArrayBuffer` is available. Any unsupported environment or threaded initialization error falls back to single-thread WASM. Hash and thread values are constrained by device capabilities and exposed in the runtime diagnostics.

## Strategy flow

The rules layer supplies legal moves. During the configured opening phase, the Bogyoku layer ranks legal candidates and may narrow the engine request through USI `searchmoves`. Engine MultiPV analysis then applies tactical-loss and mate safety checks before a style-biased move is selected. The UI exposes the selected state, candidates, rejected reasons, and feature score breakdown.

## Data policy

Game state, imported records, preferences, and analysis remain client-side. Versioned saves use IndexedDB. A late restore result is ignored after the user has started or reset a game, preventing stored state from overwriting a fresh interaction. No external game-analysis API is used.
