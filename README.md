# Bogyoku AI Arena

Browser-only shogi arena focused on the aggressive **Bogyoku (棒玉)** strategy. It includes legal shogi play, a locally running YaneuraOu WASM engine, human/AI modes, MultiPV analysis, and responsive desktop/mobile layouts.

## Local development

Requirements: Node.js 24 LTS and npm 11 or later.

```powershell
npm install
npm run dev
```

Quality checks:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The application keeps games, positions, and analysis in the browser. It does not send them to an external API. Threaded WASM is selected when cross-origin isolation is available; otherwise the app falls back to the single-thread build.

See [README_JA.md](README_JA.md) for Japanese documentation, [STATUS.md](STATUS.md) for verified status, and [ENGINE_SOURCE.md](ENGINE_SOURCE.md) for reproducible engine provenance.

## License

Source code authored for this repository is licensed under GPL-3.0-only. Engine and third-party terms are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [MODEL_LICENSE.md](MODEL_LICENSE.md), and [ENGINE_SOURCE.md](ENGINE_SOURCE.md).
