# YaneuraOu WASM build

The reproducible build is implemented by `scripts/build-yaneuraou-wasm.ps1`, `scripts/yaneuraou-wasm.patch`, and `scripts/yaneuraou-wasm-pthreads.patch`. The authoritative source revision, commands, sizes, and hashes are in `ENGINE_SOURCE.md`.

## Requirements

- Git
- PowerShell 7
- MSYS2 `make`
- Emscripten SDK exactly `4.0.21`

Example on the verified Windows environment:

```powershell
$env:PATH = 'C:\msys64\usr\bin;' + $env:PATH
$env:EMSDK_QUIET = '1'
. .\.emsdk\emsdk_env.ps1
.\scripts\build-yaneuraou-wasm.ps1 -Jobs 8 -SourceDirectory .vendor\YaneuraOu-repro
```

The source directory must be new or a clean checkout. A dirty checkout is rejected to prevent an unrecorded source change from entering a binary.

## Outputs

- `yaneuraou.threaded.*`: pthread build for a cross-origin-isolated page with `SharedArrayBuffer`.
- `yaneuraou.single.*`: compatibility build used automatically when isolation is unavailable or threaded initialization fails.

The application imports a byte-identical copy from `src/engine/runtime/<variant>/` so Vite can bundle each module into the Worker graph. The public copies are kept as the distribution/provenance artifacts. Never edit either copy manually; rebuild and update `ENGINE_SOURCE.md` after any pinned-source, toolchain, or patch change.

## USI bridge

The versioned bridge patch exports an Emscripten command entry point, keeps the engine/USI objects alive for Worker messages, emits ES modules, and makes pthread support selectable. The supplementary pthread patch makes browser search-worker creation synchronous, marks each worker ready only after its pthread reaches the idle loop, and defers subsequent commands until all workers are parked. This lets the first `Threads` option return to the browser event loop instead of deadlocking while still preserving ordered USI command delivery. The threaded build preloads four pthread workers and uses YaneuraOu's compiled default of four search threads without nesting `PROXY_TO_PTHREAD`.

WASM `isready` initialization runs in place because the desktop-only keep-alive helper thread would deadlock a synchronous browser Worker command. The Emscripten factory resolves after runtime initialization; each `postMessage()` promise resolves after its USI command has been accepted, with a capped retry while pthreads are becoming ready.

`src/engine/usi.worker.ts` owns initialization, `usi`/`isready`, option setup, position/search commands, stop, timeout response, and disposal. Search never runs on the React main thread. Local engine checks can be run with:

```powershell
node scripts/smoke-yaneuraou.mjs src/engine/runtime/single/yaneuraou.js 30000 "go depth 1" 0 1
node scripts/smoke-yaneuraou.mjs src/engine/runtime/threaded/yaneuraou.js 60000 "go depth 1" 0 4
```
