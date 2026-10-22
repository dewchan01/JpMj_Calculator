# Tile recognition and local storage

## Free recognition candidate

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
classes, red-five flags and confidence. Keep manual verification before settlement. The current
adapter remains a clearly labelled fixed mock; no real model is connected yet.

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
