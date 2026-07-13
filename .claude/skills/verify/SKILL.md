---
name: verify
description: Build, run, and drive Calorie Crusher (Vite React PWA) end-to-end for verification.
---

# Verifying Calorie Crusher

## Build & serve

```bash
npm install
npm run build                       # tsc -b && vite build (also regenerates sw + manifest)
npm run preview -- --port 4173 &    # serves dist/ (background it)
```

## Drive (headless Chromium + Playwright)

Use the pre-installed browser: `executablePath: '/opt/pw-browsers/chromium'`.
Mobile viewport `390x844` matches the intended surface.

- **Camera**: launch Chromium with `--use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream` and grant the `camera` permission on the
  context. "Start camera" should reach the scanning state (reticle overlay
  visible). Headless Linux Chromium has no `BarcodeDetector`, so the ZXing
  fallback engine is what runs; a real decode needs a barcode in the fake
  stream, so use the manual-entry field instead — it funnels into the same
  lookup path as camera detection.
- **Open Food Facts is NOT reachable from the remote sandbox** (proxy 403 on
  CONNECT). Mock it with `context.route('**/world.openfoodfacts.org/**', ...)`.
  Product endpoint shape: `{status: 1, product: {code, product_name, brands,
  serving_quantity, nutriments: {'energy-kcal_100g', proteins_100g,
  carbohydrates_100g, fat_100g}}}`; search returns `{products: [...]}`.
- Data lives in IndexedDB (`calorie-crusher` DB) — persists across reloads in
  the same browser context, so a reload is the persistence probe.

## Flows worth driving

1. Diary: add custom food (Add food → Create custom food) → totals/meters update.
2. Scan tab: manual barcode → product sheet → serving-size shortcut → Add to
   diary. Re-lookup the same code with routes aborted → must serve from cache.
3. Weight: log two dates → SVG chart + hover tooltip; re-save same date must
   replace, not duplicate.
4. Exercise: "Log now" → burned kcal appears and is credited on the diary
   summary line (wait for the live query — the summary updates async).
5. Goals: macro split ≠ 100% disables save; TDEE estimate needs sex/age/height
   plus a logged weight.

## Gotchas

- `useLiveQuery` renders `undefined` first — always wait for content, not
  just selectors, before asserting text.
- The toast (`.toast`) is a reliable completion signal after saves.
