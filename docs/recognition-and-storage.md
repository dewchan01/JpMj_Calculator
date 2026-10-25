# Tile recognition and local storage

## Recognition logs

Open the browser developer tools (`F12` or `Ctrl+Shift+J` in Chrome/Edge), select **Console**,
enable Info and Warning messages, then filter for `[recognition]`. Selecting a photo logs the
provider, image byte count/type, elapsed time, prediction count or failure type. The app's own
diagnostics do not log image contents, filenames, API keys or full provider responses.
Enable **Preserve log** to retain messages across navigation/reloads. These logs are local to
the browser console; they are not sent to a monitoring service or saved in IndexedDB.

Use **Network** to inspect failed model downloads/API status codes. Inference runs in a worker
for Roboflow, so inspect Console messages as well. Avoid sharing full network exports, which can
contain authentication parameters. `npm start` terminal output covers the Angular development
server; browser inference logs appear in developer tools.

## Roboflow publishable browser key

Recognition provider, model and key are configured only in `apps/web/public/config.json`.
Switch `recognition.provider` between `"roboflow"` and `"api"`; both settings can stay in the
file. Only the selected provider is validated and used. No automatic provider fallback occurs.
After editing, reload the app; the running app reads configuration once per page load.

```json
{
  "recognition": {
    "provider": "roboflow",
    "timeoutMs": 30000,
    "endpoint": "https://www.example.com/api/detect-server",
    "roboflow": {
      "model": "mahjong-baq4s-q6hto",
      "version": 1,
      "publishableApiKey": "YOUR_PUBLISHABLE_API_KEY",
      "classMap": { "EW": "1z", "RD": "7z" }
    }
  }
}
```

The example class map is abbreviated. Keep the full map in the real config: B=bamboo, C=characters, D=dots, EW/SW/WW/NW for winds, and WD/GD/RD for dragons. Optional `ignoredClasses` excludes explicitly listed labels before normalization; unknown labels otherwise cause an error.
`endpoint` is required only for `api`. The Roboflow model, version and publishable key are used
only for `roboflow`; `classMap` defaults to direct tile labels if omitted. `timeoutMs` defaults
to 30,000 ms. Use `"mock"` for offline demo suggestions.

There are no provider/key controls in the app, and old browser-stored key preferences are ignored.
The [provider link](https://app.roboflow.com/settings/api) is for the administrator to obtain a
**Publishable API Key**. Put it in `recognition.roboflow.publishableApiKey`, then set
`recognition.provider` to `roboflow`. Never put a private server API key in this public file.

The optional `recognition.roboflow` section in `config.json` contains the model slug, version,
an optional publishable key, and class-label mappings. Set `recognition.provider` to `roboflow`
to select it, or keep `api` for the JSON endpoint. The configured model is restored to `mahjong-baq4s-q6hto`, version 1, following worse physical-photo results with the candidate. Its full suit and honor mapping is restored and candidate-specific exclusions are removed. Red-five recognition for the restored model remains unverified; review those tiles manually.

The browser adapter uses the official `inferencejs` SDK with a downloaded model, rather than
sending images to the hosted inference endpoint. Model initialization needs network access and
permission to load the selected model. A publishable key does not grant access to every model.
The SDK is a separate ~5 MB raw build chunk; the PWA currently prefetches JavaScript, including
this chunk. Actual model downloads and browser/GPU compatibility remain unverified without a key.

See the [SDK API](https://www.npmjs.com/package/inferencejs). Hosted private-key inference and
publishable-key browser inference use different authentication and request interfaces.

## Existing JSON endpoint

Configure recognition in `apps/web/public/config.json`, which is served as `config.json` beside
the app. API settings are not shown in the UI and old browser endpoint preferences are ignored.

```json
{
  "recognition": {
    "provider": "api",
    "endpoint": "https://www.example.com/api/detect-server",
    "timeoutMs": 30000
  }
}
```

Use `"provider": "mock"` for offline demonstration. HTTPS is required except on localhost;
timeouts must be between 1,000 and 120,000 milliseconds. Invalid configuration disables uploads
but leaves manual preview editing and scoring available. This public file is not a place for secrets.
It is bundled into the PWA cache; publish changes with the app and reload after the update installs.

Choosing a photo in API mode uploads it immediately to the configured service. The request is
`POST`, `Content-Type: application/json`, with `{ "image": "<raw base64>" }` (no data-URL prefix).
The API must return `image.width`, `image.height`, and a `predictions` array containing `class`,
`confidence`, `x`, `y`, `width`, and `height`. Classes use `1m`–`9m`, `1p`–`9p`, `1s`–`9s`,
`1z`–`7z`, and `0m`/`0p`/`0s` for red fives. Coordinates are interpreted as center-based pixel boxes.

The adapter validates responses, normalizes boxes, and orders suggestions left to right. It times
out after 30 seconds, accepts images up to 20 MiB, and reports server/network errors without
substituting mock results. Confidence is displayed, but every tile must be checked by the user.
Capture or enter all hand, meld and North tiles together, without choosing their destinations first.
Photo results stay in the review tray until confirmed. Remove or reorder tiles, or edit notation
and choose **Update preview**, then **Apply reviewed tiles**. Select tiles from the collection
and assign them to Chi/Pon/Kan or extracted North afterward. Remaining tiles stay concealed.
Assignments can be undone or returned to the collection without recapturing. Replacing the full
collection resets its assignments and supports Undo. Dora/Ura have separate review trays.
North assignments reject non-North tiles and more than four tiles. Verification is required before settling.
Multi-row grouping and automatic meld inference are not implemented.

Changing the URL supports another provider with the same contract. For another contract, add a
separate `TileRecognizer` adapter instead of coupling the scorer to provider-specific fields.
Cross-origin requests require the provider to allow CORS from localhost and the deployed Pages
origin, including the JSON POST preflight. Browser-side code cannot bypass provider CORS settings.

Tests use intercepted responses and do not establish live RiichiCam availability, photo accuracy,
or CORS permission for your deployment. Test with your photo before relying on recognition.

## Hosted alternative evaluated

[Roboflow Mahjong detection](https://universe.roboflow.com/mahjongmasterai/mahjong-baq4s-q6hto/model/1)
offers hosted inference for model `mahjong-baq4s-q6hto/1`. The published examples require an API key.
Its class list uses labels such as `1B`, `1C`, `1D`, `EW` and `RD`, rather than our notation; red-five
coverage is not established by the listed classes. This needs a separate adapter and real-photo
evaluation rather than changing only the endpoint URL.

Roboflow's [API example](https://universe.roboflow.com/mahjongmasterai/mahjong-baq4s-q6hto/model/1)
posts base64 using `application/x-www-form-urlencoded`. The provider warns against exposing a
private API key in a public frontend. Use a backend with the key stored as a secret for a public
deployment; GitHub Pages alone cannot keep it private. Hosted CORS and account access still need
verification for the chosen deployment. The [pricing page](https://roboflow.com/pricing) lists a
free tier with credits, not unlimited free inference. No key or provider change is included here.

No free, anonymous hosted replacement with verified Japanese red-five support and Pages-origin
CORS has been established. A self-hosted detector gives control of the endpoint and CORS policy.

## Local model candidate

[Mahjong-YOLO](https://github.com/nikmomo/Mahjong-YOLO) publishes Mahjong-specific YOLOv11
models in PyTorch and ONNX formats, with several model sizes. This is a candidate to evaluate on
actual Japanese tiles, especially red fives, rotated calls, glare and different tile fonts. Its
repository advertises MIT licensing; check the model, dataset and upstream dependencies separately.
[Ultralytics licensing](https://www.ultralytics.com/license) describes AGPL and commercial options.
Free downloads do not imply unrestricted use of every dependency.

Recommended integration: start with the small ONNX model and test accuracy on representative photos.
Use [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) for browser
inference if performance and supported operators permit it. Alternatively serve inference from a
local Docker container. Both avoid per-request API fees; hardware and hosting still have costs.
These are proposed integration paths, not measured performance claims.

Implement the existing `TileRecognizer` interface in
`apps/web/src/app/features/scoring/capture/recognizer.ts`, returning normalized boxes, mapped tile
classes, red-five flags and confidence. Keep preview editing available; there is no separate verification checkbox before settlement. The current
local model integration is an alternative to the configured API. An explicit mock mode also remains
available for offline demonstration and performs no upload.

## IndexedDB retention

The app sets no expiry for saved matches or drafts. IndexedDB normally survives browser restarts,
but storage is best-effort by default. Browsers can evict it under storage pressure; users can clear
site data, and private browsing usually removes data when its session ends. Safari can also evict
script-created storage proactively for inactive origins in applicable browsing contexts.

Storage belongs to an origin (scheme, hostname and port). `localhost:4200`, `localhost:4300` and a
deployed HTTPS site have separate databases. Switching URLs does not migrate matches.

The app shows `navigator.storage.estimate()` usage and quota on every page. It refreshes after
match/draft writes and deletions, on window focus, every 30 seconds, and through a manual refresh
button. Warnings appear at 80% and become urgent at 95%. Estimates cover the entire origin,
including offline caches; they are not an exact database size or a guarantee that a save will fit.
Unavailable estimates are shown explicitly rather than reported as zero usage.

The app does not currently request `navigator.storage.persist()`. Permission and quotas depend on
the browser. Even persistent storage can be deleted by the user. Export match JSON for backups.
There is currently no JSON import UI or cloud sync.

Source: [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Swappable recognizers and model evaluation

`TileRecognizer` is the polymorphic interface. `ApiTileRecognizer`, `RoboflowRecognizer`, and `MockTileRecognizer` implement it; `createRecognizer` selects an implementation from configuration. The photo UI consumes the shared `RecognitionResult`, with normalized boxes, tile kinds, red-five flags, confidence and model identity. A new provider implements this interface and is registered in the factory. Another model using the same Roboflow protocol needs only model configuration, class mappings and explicit ignored labels, rather than another subclass. Polymorphism handles interchangeability; it does not improve model accuracy.

The previously tried [candidate model page](https://universe.roboflow.com/riichimahjongdetection/riichi-mahjong-detection) lists `riichi-mahjong-detection/3`, red-five labels, and 99% mAP@50 on its own data. This is not a measured improvement on this app's physical-tile photos. Browser model access and inference still need live verification with the configured publishable key.

For a comparison, use the same original physical-tile photos for both models. Include straight and angled views, bright and dim lighting, red fives, honors and repeated tiles. Write the expected tile counts before recognition. Record the raw preview before correcting it; changing lighting or manually correcting predictions invalidates a direct comparison.

| Photo           | Expected tiles        | Model/version         | Missed | Wrong label | Extra | Red-five errors | Elapsed ms |
| --------------- | --------------------- | --------------------- | ------ | ----------- | ----- | --------------- | ---------- |
| straight-bright | Fill in tile notation | baseline or candidate |        |             |       |                 |            |

Compare hands with every tile correct as well as individual mistakes; a high per-tile score can still leave many hands needing correction. No evaluation photos currently exist in this workspace, so the model configuration and adapter behavior can be tested here, but a physical-photo accuracy comparison cannot yet be completed. Keep reviewing predictions before scoring.

## Recognition and artwork caching

The factory keeps one Roboflow recognizer for the active configuration. Its model worker remains loaded after successful recognition and is reused across photo inputs and dialogs during the current visit. Requests are serialized; cancellation, failures, or configuration changes dispose of the worker so a retry starts cleanly. The cache does not retain photos or prediction results. Reloading closes the worker and requires initialization again; model-weight downloads still follow the SDK and remote server cache rules.

Tile artwork uses eager image loading and stable bordered preview frames. The production PWA already prefetches `/tiles/**/*.svg`, allowing artwork to be served from its versioned cache across visits after a successful install. Development mode uses the browser HTTP cache and does not enable the production service worker.
