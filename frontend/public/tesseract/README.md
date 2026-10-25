# Local screenshot OCR assets

These are public runtime assets, not customer uploads. No image is sent to a server.
They are lazy-loaded only after a shopper chooses a product/cart image.

Sources (installed with Yarn; pinned in package.json/yarn.lock):
- tesseract.js 7.0.0: `dist/worker.min.js` → `worker/worker.min.js`
- tesseract.js-core 7.0.0: root `*.js` and `*.wasm` → `core/`
- @tesseract.js-data/eng 1.0.0: `4.0.0_best_int/eng.traineddata.gz` → `lang/eng.traineddata.gz`

Bundled worker/core/model files are intentional: no external CDN or runtime keys.
License files are included alongside these assets. Refresh these copies together
when deliberately upgrading the pinned OCR packages. English text recognition is
best-effort; currency recognition can be imperfect. Store and amount must be
reviewed before applying. OCR does not establish cashback eligibility.
