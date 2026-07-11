# Engine source and reproducibility

## Pinned source

- Upstream: `https://github.com/yaneurao/YaneuraOu.git`
- Commit: `1308ab3803e0011979473296741e56a6981c46ba`
- Commit date: 2026-07-10T00:29:59+09:00
- Retrieved: 2026-07-10; last reproduced: 2026-07-11
- License: GPL-3.0; retain the upstream copyright/license notices and provide the corresponding source, this repository's reviewable patch, and build instructions when distributing the binaries.
- Emscripten SDK: `4.0.21`
- Engine edition: `YANEURAOU_ENGINE_MATERIAL`, `MATERIAL_LEVEL=1`
- Evaluation model: none. Material level 1 is compiled into the engine and no separately distributed NN/evaluation file is loaded.

The WASM bridge changes are recorded in `scripts/yaneuraou-wasm.patch`. Browser-pthread startup and command-handoff changes are recorded separately in `scripts/yaneuraou-wasm-pthreads.patch`; the build script verifies and applies both patches in that order. Do not replace files under `public/engine/` or `src/engine/runtime/` by hand.

## Reproduction

From a PowerShell session with Emscripten 4.0.21 active and MSYS2 `make` available:

```powershell
$env:PATH = 'C:\msys64\usr\bin;' + $env:PATH
$env:EMSDK_QUIET = '1'
. .\.emsdk\emsdk_env.ps1
.\scripts\build-yaneuraou-wasm.ps1 -Jobs 8 -SourceDirectory .vendor\YaneuraOu-repro
```

`-SourceDirectory` must be absent or a clean checkout. The script refuses tracked changes, fetches and checks out the immutable commit, verifies/applies the patch, builds single-thread and pthread variants, copies matching runtime assets, and prints hashes. Use a new empty source directory for an independent clean-machine reproduction.

Equivalent build invocations executed inside the patched upstream `source` directory are:

```text
make -j8 YANEURAOU_EDITION=YANEURAOU_ENGINE_MATERIAL MATERIAL_LEVEL=1 TARGET_CPU=WASM COMPILER=em++ WASM_THREADS=0 normal
make -j8 YANEURAOU_EDITION=YANEURAOU_ENGINE_MATERIAL MATERIAL_LEVEL=1 TARGET_CPU=WASM COMPILER=em++ WASM_THREADS=1 normal
```

## Verified outputs

| File                                    |   Bytes | SHA-256                                                            |
| --------------------------------------- | ------: | ------------------------------------------------------------------ |
| `public/engine/yaneuraou.single.js`     |  32,743 | `A5BB4D3EEB6AF7572DC22C946B769C1EEF862E57BB28FA409E757E1FA09BFE9D` |
| `public/engine/yaneuraou.single.wasm`   | 756,252 | `0BD2541F4579AB96A715CADCEED53CB4F760507CD9B15169DFC1773B19B9C464` |
| `public/engine/yaneuraou.threaded.js`   |  39,746 | `3D5C0DDB0FBF91A6EB86867803599E8E370249DA04A9ED2BB14C6A21C59BCF1B` |
| `public/engine/yaneuraou.threaded.wasm` | 776,492 | `EFF01D19AA345962D0F68C4926F6388BBE9347C29C425851123BE1FD203EC0B3` |

The corresponding files in `public/engine/single/`, `public/engine/threaded/`, `src/engine/runtime/single/`, and `src/engine/runtime/threaded/` were hash-compared and are byte-identical to the named public copies. A clean end-to-end build from the pinned commit and both recorded patches completed successfully on Windows on 2026-07-11.
