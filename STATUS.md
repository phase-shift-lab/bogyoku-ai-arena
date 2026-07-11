# Status

Updated: 2026-07-11

## Completed phases

- [x] Phase 0: React/Vite/TypeScript foundation, responsive shell, CI, documentation skeleton
- [x] Phase 1: `shogiops` legal moves, promotion, drops, checkmate/repetition, SFEN/KIF, persistence boundary
- [x] Phase 2: pinned YaneuraOu, reproducible Emscripten build, single/threaded WASM, USI Worker, timeout and fallback
- [x] Phase 3: Bogyoku profiles, position-aware side-symmetric planner, `searchmoves`, tactical safety filter, score decomposition
- [x] Phase 4: human/AI modes, side selection, handicap presets, variation tree, pause/step/autosave, device presets
- [x] Phase 5 implementation: CI Pages workflow, COI service-worker path, desktop/mobile cross-browser E2E, license and operator docs

## Release verification

- Clean YaneuraOu WASM build completed from the pinned upstream revision.
- Public and Worker-runtime engine copies are byte-identical; hashes are recorded in `ENGINE_SOURCE.md`.
- Both threaded and single-thread runtime assets pass the local USI `go depth 1` smoke test.
- The Chromium production-preview path starts the threaded runtime and completes a real current-position analysis.
- Unit tests pass: 5 files, 17 tests.
- Chromium, Firefox, WebKit, and Pixel 7 viewport UI E2E tests pass: 12 tests.
- The separate Chromium threaded-engine startup and analysis E2E test passes: 1 test.
- Formatting, lint, type checking, production build, and whitespace checks pass.
- Actual GitHub Pages publication was intentionally not performed. The operator must verify the deployed URL and isolation/runtime badge after publishing.

## Known limitations

- No external evaluation model is bundled. The engine uses compiled `YANEURAOU_ENGINE_MATERIAL` with `MATERIAL_LEVEL=1`.
- Perpetual-check loss and entering-king adjudication are not implemented; game termination uses checkmate and basic fourfold-position repetition.
- Benchmark methodology is documented, but no device-performance comparison is claimed.
- A host without cross-origin isolation uses the slower single-thread engine by design.
