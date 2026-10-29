# Backend vertical slices

The ASP.NET Core API follows the [dotnet-best-practices skill](https://github.com/github/awesome-copilot/blob/main/skills/dotnet-best-practices/SKILL.md).
Code is organized by operation so an endpoint, its input contract and its handler can be reviewed together.

```text
apps/api/
  Features/
    Rooms/
      CreateRoom/       Endpoint.cs, Request.cs, Handler.cs, RoomFactory.cs
      JoinRoom/
      GetRoom/
      ReleaseSeat/
      CloseRoom/
      UpdatePermissions/
      Notifications/   RoomHub.cs
      IRoomAccess.cs
      RoomAccess.cs
    Games/
      GetGame/
      SubmitAction/
      CommitGame/
    Shares/
      CreateShare/
      GetShare/
      RevokeShare/
    Health/GetHealth/
    FeatureRegistration.cs
  Infrastructure/
    Configuration/     Typed configuration options
    Persistence/       EF context, entities and design-time factory
    Security/          Credential generation and verification
    Logging/           Serilog, Seq and safe request enrichment
    ApiServices.cs
  Shared/Handlers/     Small command/query contracts and common guards
  Resources/           ErrorMessages and LogMessages resources
  Migrations/          Existing SQL Server migrations
  Program.cs           Application composition and HTTP pipeline
```

## Responsibilities

- **Endpoint:** binds route, body, credential and request cancellation, then dispatches to its handler. Existing routes, JSON fields, status codes and rate-limit policies remain unchanged.
- **Request / Body:** contains only the input needed by that operation. HTTP bodies are separate from commands that also carry a route identifier or credential.
- **Handler:** validates inputs, authorizes access, executes database work and returns the result. Commands change state; queries read state. Handlers use scoped EF contexts directly, without a generic repository or mediator dependency.
- **Shared room access:** checks current host/seat membership for both queries and SignalR subscriptions. The hub publishes invalidations rather than snapshots or credentials.
- **Infrastructure:** configures persistence, logging, credentials and typed options. `Program.cs` keeps middleware ordering and explicit migration/startup behavior visible.

Database calls and upload reads accept the caller's cancellation token. Notifications after a successful commit intentionally continue independently of HTTP cancellation, so other clients can learn about a committed change.
Transactions, quota checks, action deduplication and revision checks stay within their owning write handlers.

`StorageOptions`, `CorsOptions`, `DatabaseOptions` and `SeqOptions` bind the existing configuration sections. Storage/CORS options and Seq queue limits use data annotations and startup validation; Seq also rejects unsafe endpoint URLs. Configuration precedence remains JSON, environment-specific JSON, environment variables and command-line overrides. See [deployment configuration](../dev.md) and [logging](logging.md).

Public API types have XML documentation, checked during compilation. Shared error and request-log messages use separate `ResourceManager` resources. There are no AI operations in this API, so it does not require an AI SDK.

## Persistence compatibility

The refactor changes source locations without changing entities, table mappings or migrations. Persistence types retain the `Riichi.Api.Data` namespace to preserve EF model identity. SQL Server remains the production provider; local development and integration tests use SQLite.

Check future model changes with:

```powershell
dotnet ef migrations has-pending-model-changes --project apps/api --configuration Release
```

## Tests and adding features

`apps/api.tests` uses **MSTest, FluentAssertions and Moq**. Tests are grouped under `Features` and `Infrastructure`, with the isolated SQLite web application factory under `Support`.
Integration tests cover routes, credentials, expiry, quotas, concurrent seat claims, action deduplication, SignalR isolation and safe logging. Handler tests cover access decisions, expired rooms, null inputs and cancellation. Configuration tests cover environment overrides and invalid limits.

```powershell
dotnet test apps/api.tests --configuration Release
npm run e2e -- --config playwright.online.config.ts
```

For a new operation, add its folder under the relevant feature, define its request and focused handler, register the handler and route in `FeatureRegistration`, then add tests for successful behavior and meaningful failure paths. Keep reusable infrastructure outside the slices; keep feature-specific validation and factories beside their operation.
