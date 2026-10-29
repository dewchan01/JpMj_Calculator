# Angular diagnostic policy

The in-app log is a local, in-memory troubleshooting buffer. Open Others → Developer and click the brand three times to view it. It keeps at most 200 entries, clears on reload, and sends nothing to Seq or another server. Repeated identical messages within five seconds are coalesced with an occurrence count.

| Event                                                                    | Level / category               | Included                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| App startup and navigation                                               | info / runtime, navigation     | Static page names only; no route IDs, query strings or fragments                         |
| Room connection transitions                                              | info or warn / room            | Connecting/connected; reconnecting/disconnected are warnings; no room code or credential |
| Failed HTTP request or timeout                                           | warn / network                 | Fixed failure message; no URL, body or response payload                                  |
| HTTP 429 / 5xx                                                           | warn or error / network        | Rate-limit notice or numeric status only                                                 |
| Shared/local revision conflict                                           | warn / room, storage           | Concurrency notice rather than a system-error entry                                      |
| IndexedDB read/write/import failure                                      | error / storage                | Operation description; no match, player, draft or archive content                        |
| Photo recognition success/failure                                        | info or warn / recognition     | Prediction count or fixed summary; expected cancellation is omitted                      |
| Invalid/unavailable public configuration                                 | warn / configuration           | Fixed description or HTTP status; no keys or configuration contents                      |
| Angular errors, uncaught browser errors and unhandled rejections         | error / runtime                | Fixed description and safe error class; no raw exception message or stack                |
| Invalid hand, missing input, wrong PIN, denied permission, expired share | not logged as a system failure | The UI still displays its translated message                                             |

`ErrorNotice` no longer labels every validation message as an application error. Only recognized operational messages are eligible for diagnostics. Network and storage boundaries record their actual failures. Expected cancellation and successful polling/requests do not fill the log.

Callers must pass fixed diagnostic descriptions, never user content. The shared policy additionally redacts URL, Bearer, credential, email, numeric-code and hexadecimal-ID patterns. Runtime logging intentionally excludes arbitrary exception messages, which might contain names or credentials.

Development-only recognition Console messages provide safe timing, provider and count/type details. They exclude image contents, filenames, API keys, raw responses and hand tiles. Production uses the sanitized in-app summaries. Browser DevTools can independently display request details and browser-generated diagnostics; review exports before sharing them.

Backend Serilog/Seq logging is separate; frontend logs are not uploaded to it. See [backend logging](logging.md).
