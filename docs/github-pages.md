# GitHub Pages deployment

Vite uses `base: './'`, so built assets remain valid under a repository subpath. `.github/workflows/pages.yml` builds the application and deploys `dist/` through GitHub Pages Actions.

## Cross-origin isolation

YaneuraOu pthread WASM requires `crossOriginIsolated` and `SharedArrayBuffer`. GitHub Pages does not provide configurable COOP/COEP response headers, so the production build registers the reviewed `public/coi-serviceworker.js` shim. The first visit may reload once after service-worker activation.

If isolation is still unavailable or threaded initialization fails, the application automatically starts the single-thread build and shows the selected runtime in the status badge. Local Vite development and preview servers emit COOP/COEP headers directly.

## Operator verification after publication

1. Open the deployed URL in a clean browser profile and allow the one-time reload.
2. Confirm the board and controls fit without horizontal page overflow on desktop and mobile.
3. Confirm the engine badge shows `Threaded WASM`, or an explicit expected `Single WASM` fallback.
4. Start analysis and confirm a recommendation/variation appears.
5. Reload once and confirm the app still starts from the repository subpath.

Publishing has not been executed from this workspace; it remains an explicit operator action.
