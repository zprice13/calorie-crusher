# Calorie Crusher 🍎

A local-first **PWA** for tracking calories and macronutrients alongside weight
and exercise planning — with **UPC barcode scanning** via your phone camera to
pull nutrition facts instantly.

## Features

- **Food diary** — log foods per meal (breakfast/lunch/dinner/snacks) with
  calories, protein, carbs, and fat, tracked against a daily goal.
- **📷 Barcode scanning** — point the rear camera at a UPC/EAN barcode; the
  product's nutrition facts are fetched from
  [Open Food Facts](https://world.openfoodfacts.org) (free, community-run).
  Uses the platform `BarcodeDetector` API where available (Chrome/Edge on
  Android and desktop) and falls back to a lazy-loaded [ZXing](https://github.com/zxing-js/library)
  decoder elsewhere (iOS Safari, Firefox). Manual barcode entry is also supported.
- **Food search** — free-text Open Food Facts search plus custom foods.
- **Weight tracking** — daily weigh-ins with an interactive trend chart and a
  goal line; metric or imperial units.
- **Exercise planning** — build a weekly workout plan, mark workouts done, or
  log ad-hoc activity. Burned calories are estimated from MET values and your
  latest weight, and are credited back to the day's calorie budget.
- **Goals** — set calorie and macro-split targets manually, or estimate your
  TDEE (Mifflin-St Jeor) from your profile.
- **PWA / offline** — installable to the home screen; the app shell is
  precached, previously fetched products are cached (network-first), and all of
  your data lives on-device in IndexedDB. No account, no server.

## Stack

- [Vite](https://vitejs.dev) + React 18 + TypeScript
- [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox service worker + manifest)
- [Dexie](https://dexie.org) (IndexedDB) for local-first storage
- `BarcodeDetector` API with `@zxing/browser` fallback (code-split)
- Open Food Facts API for nutrition data

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build
npm run icons      # regenerate PWA icons (scripts/generate-icons.mjs)
```

### Testing the camera scanner

`getUserMedia` requires a **secure context** — HTTPS or `localhost`. To try the
scanner from a phone against your dev machine, either use a tunneling tool that
provides HTTPS, or run `vite --host` and add your LAN origin to the browser's
insecure-origins-treated-as-secure flag (Chrome:
`chrome://flags/#unsafe-treat-insecure-origin-as-secure`). Any production
deployment (Netlify/Vercel/Pages/etc.) is HTTPS out of the box.

On browsers without camera access you can type the barcode digits into the
manual lookup field on the Scan tab.

## Data model (IndexedDB via Dexie)

| Table | Contents |
| --- | --- |
| `foods` | Product cache (scanned/searched/custom), keyed by barcode |
| `diary` | Logged foods per date + meal, macros denormalized at log time |
| `weights` | One weigh-in per date, stored in kg |
| `exerciseLogs` | Completed workouts with estimated kcal burned |
| `plannedExercises` | Recurring weekly plan (weekday + activity + MET) |
| `settings` | Goals, macro split, units, profile |

## Notes

- Nutrition values are normalized to **per 100 g** and scaled by the logged
  amount; serving size is prefilled when Open Food Facts knows it.
- Open Food Facts is community data — coverage is excellent for packaged
  goods in Europe and good elsewhere; unknown barcodes fall back to custom
  food entry.
