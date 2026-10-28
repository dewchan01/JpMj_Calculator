# Backend logging

The API uses Serilog through the existing `ILogger<T>` abstraction. Configuration stays in `apps/api/appsettings.json` and `appsettings.Development.json`. Console output is always enabled; Seq is enabled only when `Seq.ServerUrl` has a value. JSON/logging configuration is backend-only; do not put the Seq key in Angular's public `config.json`.

## What is recorded

Serilog emits one completion event per HTTP request, containing method, route template, status code and elapsed milliseconds. Events carry `Application`, `Environment`, `Instance`, `RequestId` and, when available, `TraceId`. A route is recorded as `/api/shares/{id}` or `/api/rooms/{id}/game`, not the concrete room/share ID. Unmatched routes use `/unmatched`.

Request logging does not capture bodies, headers or query strings. The request enricher also replaces the framework's scoped `RequestPath` and removes common query/header/body properties, so access-bearing transfer IDs and credentials are not retained in these request properties. Application code should continue using named structured properties and must not log passcodes, tokens, deletion secrets, connection strings or raw game payloads.

- Successful requests: Information.
- Client failures (4xx): Warning.
- Server failures (5xx) and unhandled exceptions: Error.
- Successful health checks: Debug, suppressed by the production Information minimum.

Development enables Debug console output. Noisy ASP.NET Core and EF Core framework categories stay at Warning in both files. Minimum levels are configured under `Serilog.MinimumLevel`, not the old `Logging.LogLevel` section.

## Enable Seq

Seq is a separate log server with its own storage and retention; it is not installed inside the API's MSSQL database or MonsterASP website. Use an existing Seq instance or follow the [Seq installation instructions](https://datalust.co/docs/getting-started).

Create an ingestion API key in Seq, then set these backend hosting variables:

| Variable                         | Value                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| `Seq__ServerUrl`                 | Your Seq ingestion base URL, such as `https://seq.example.com` |
| `Seq__ApiKey`                    | The ingestion API key; keep it out of source control           |
| `Serilog__MinimumLevel__Default` | Optional override, normally `Information`                      |

Restart the backend after changing settings. Make an API request other than `/api/health`, then search Seq for `Application = 'Riichi.Api'`. Public remote Seq endpoints should use HTTPS; local/private deployments can use HTTP. Credentials, query strings and fragments are rejected in `Seq.ServerUrl`; supply the key separately.

The Seq sink batches events asynchronously at Information or above. Console logging continues if Seq is unavailable. Its in-memory queue is bounded to 10,000 events with a 64-KiB per-event limit. There is no durable disk buffer: queued events can be lost on process termination or when the queue is full. Seq controls how long accepted events are retained. Console output is not an application log file; whether it is retained depends on the host's stdout/log collection. No external Seq destination is configured in the repository.

See [Serilog for ASP.NET Core](https://github.com/serilog/serilog-aspnetcore) and [Seq's Serilog integration](https://datalust.co/docs/using-serilog).

## Portability across clouds

The environment-variable pattern is an ASP.NET Core convention, not a MonsterASP-specific API. The same names work when supplied to a .NET application on different hosting platforms. `__` becomes a nested configuration separator, and environment variables override JSON values. `ASPNETCORE_ENVIRONMENT` is built into .NET; names such as `Cors` and `Seq` are sections defined by this application. [Microsoft configuration documentation](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0)

| Platform          | Where settings are supplied                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| MonsterASP        | Website environment variables                                                                   |
| AWS ECS           | Task/container environment variables; inject secrets through Secrets Manager or Parameter Store |
| Azure App Service | App settings; use Key Vault references for secrets                                              |
| Google Cloud Run  | Service variables and Secret Manager-backed secret variables                                    |

The cloud consoles and secret-storage names differ; inject the values under the same environment-variable names consumed by .NET. This does not mean a Node/Python application interprets .NET's keys automatically. References: [AWS ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html), [Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-dotnetcore), [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
