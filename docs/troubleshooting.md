# Troubleshooting

## `Single WASM` is shown

The page is not cross-origin isolated, `SharedArrayBuffer` is unavailable, or the threaded build failed to initialize. The application has intentionally fallen back to the compatible single-thread engine. Use `npm run dev`/`npm run preview` for local COOP/COEP headers, or verify service-worker activation on GitHub Pages.

## The production page reloads once on first visit

This is expected while `coi-serviceworker.js` takes control to enable cross-origin isolation. If it reloads repeatedly, unregister the site's service worker and clear site data, then retry. The engine can still use the single-thread fallback if isolation remains unavailable.

## Engine initialization or analysis fails

1. Compare every `public/engine/yaneuraou.*` SHA-256 with `ENGINE_SOURCE.md`.
2. Confirm matching files under `src/engine/runtime/<variant>/` are byte-identical.
3. Check the on-screen runtime/error diagnostic; do not manually replace generated assets.
4. Rebuild from a new clean `-SourceDirectory` using `scripts/build-yaneuraou-wasm.ps1` if an artifact is corrupt.

No external evaluation model is required; Material level 1 is compiled into the engine.

## A saved game unexpectedly appears

Use the in-app reset/start controls, or clear site data/IndexedDB for the origin. Once a new interaction starts, a late asynchronous restore is ignored.

## Development server does not start

Verify Node.js 24 LTS and npm 11+, run `npm install`, then `npm run dev`. Do not open `index.html` directly.

## Playwright browser is missing

```powershell
npx playwright install chromium firefox webkit
```

Then run `npm run test:e2e`.
