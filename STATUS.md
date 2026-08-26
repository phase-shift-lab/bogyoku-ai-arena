# Status

Updated: 2026-08-26

## Completed phases

- [x] Phase 0: React/Vite/TypeScript foundation, responsive shell, CI, documentation skeleton
- [x] Phase 1: `shogiops` legal moves, promotion, drops, checkmate/repetition, SFEN/KIF, persistence boundary
- [x] Phase 2: pinned YaneuraOu, reproducible Emscripten build, single/threaded WASM, USI Worker, timeout and fallback
- [x] Phase 3: Bogyoku profiles, position-aware side-symmetric planner, `searchmoves`, tactical safety filter, score decomposition
- [x] Phase 4: human/AI modes, side selection, handicap presets, variation tree, pause/step/autosave, device presets
- [x] Phase 5 implementation: CI Pages workflow, COI service-worker path, desktop/mobile cross-browser E2E, license and operator docs
- [x] Phase 6: mobile board interaction and opening selection
- [x] Phase 7: compact strategy controls and last-move trace
- [x] Phase 8: expanded surprise strategy selection
- [x] Phase 9: persistent strategy palette and opening guides
- [x] Phase 10/11: adaptive and shared surprise learning removed; fixed catalog policy retained

## Current verification

- Root type checking, lint, formatting, production build, and whitespace checks pass.
- Root unit tests pass: 13 files, 56 tests.
- No learning or telemetry endpoint is configured; game and analysis data remain browser-local.
- `public/engine/` and `public/models/` are unchanged by the learning removal.

## Known limitations

- No external evaluation model is bundled. The engine uses compiled `YANEURAOU_ENGINE_MATERIAL` with `MATERIAL_LEVEL=1`.
- Perpetual-check loss and entering-king adjudication are not implemented; game termination uses checkmate and basic fourfold-position repetition.
- Benchmark methodology is documented, but no device-performance comparison is claimed.
- A host without cross-origin isolation uses the slower single-thread engine by design.
