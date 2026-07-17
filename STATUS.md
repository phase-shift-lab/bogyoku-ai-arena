# Status

Updated: 2026-07-17

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
- [x] Phase 10: adaptive surprise opening policy with device-local learning
- [x] Phase 11 implementation: anonymous opt-in cross-device aggregate learning with local-only fallback

## Current verification

- Root type checking, lint, formatting, production build, and whitespace checks pass.
- Root unit tests pass: 13 files, 56 tests.
- Worker type checking and unit tests pass: 2 files, 15 tests.
- Wrangler dry-run and production deployment resolve the D1, rate-limit, origin, threshold, and retention bindings.
- Production Worker health, aggregate GET, allowed-origin CORS preflight, and rejected invalid POST were verified at `https://bogyoku-shared-learning.toshibacreat.workers.dev` without writing test events.
- The GitHub repository variable `VITE_SHARED_LEARNING_API_URL` points Pages builds to the production Worker.
- The browser submits only the strict anonymous event DTO: strategy, side, branch ID, and win/draw/loss outcome.
- KIF, SFEN, moves, engine evaluation, device identifier, and the device-local duplicate key are excluded from the shared DTO; unknown fields are rejected by the Worker.
- Shared learning is opt-in, human-vs-AI only, and unavailable when the API URL is unset. Network, quota, or server failure leaves device-local learning and play operational.
- `public/engine/` and `public/models/` are unchanged by Phase 11.

## Production rollout

- [x] Created the production D1 database and applied `worker/migrations/0001_shared_learning.sql`.
- [x] Deployed the Worker with the production D1 and fail-closed rate limiter bindings.
- [x] Set `VITE_SHARED_LEARNING_API_URL` for Pages production builds.
- [x] The Pages workflow injects the production API URL and publishes this release after push.

## Known limitations

- No external evaluation model is bundled. The engine uses compiled `YANEURAOU_ENGINE_MATERIAL` with `MATERIAL_LEVEL=1`.
- Perpetual-check loss and entering-king adjudication are not implemented; game termination uses checkmate and basic fourfold-position repetition.
- Benchmark methodology is documented, but no device-performance comparison is claimed.
- A host without cross-origin isolation uses the slower single-thread engine by design.
- Shared weights are withheld until the configured minimum of 30 aggregated games per strategy/side/branch is reached.
- Worker unit tests use a fake D1 implementation; production smoke checks cover connectivity, CORS, validation, and aggregate reads without inserting synthetic learning events.
- Cloudflare free-tier quota exhaustion or outage temporarily disables shared updates, while the game continues with device-local learning.
