# Backend deployment: MonsterASP and SQL Server

Run the commands below from the repository root. Deploy **only `apps/api`** to your MonsterASP website. Your Angular app stays where it is.

The RoomPermissions feature adds `Rooms.Permissions`. Apply that migration once when upgrading an older database; do not rerun schema creation for UI, presence or documentation changes. For AdminNeo, use the [single-command upgrade SQL](../sql/room-permissions-upgrade.adminneo.sql) against the existing SQL Server database. See [permissions and deployment steps](../architecture/room-permissions.md). The matching Angular build is deployed separately to its existing host.

The API now logs through Serilog to console, with optional Seq shipping. Set `Seq__ServerUrl` and `Seq__ApiKey` in backend hosting settings to enable Seq; otherwise it stays console-only. See [logging and cloud configuration](../development/backend-logging.md).

Use [apps/api/.env.example](../../apps/api/.env.example) as the version-controlled checklist of configuration names. It contains placeholders, not credentials. ASP.NET Core does **not** automatically read `.env` files: enter the values in hosting settings, inject secrets from your hosting secret manager, or set process environment variables. `.env` and `.env.*` files are ignored by Git, while `.env.example` stays tracked.

For local secrets, enable .NET User Secrets once, then set values outside the repository:

```powershell
dotnet user-secrets init --project apps/api
dotnet user-secrets set "Seq:ApiKey" "YOUR_LOCAL_SEQ_KEY" --project apps/api
```

`init` adds a non-secret `UserSecretsId` to the project file; commit that ID, not the secret values. Development loads these settings automatically. User Secrets is for development, not production, and its local file is not encrypted. Keep real production values in your hosting settings/secret manager or password manager, not in this checklist.

Before deploying the backend:

- [ ] Supply `ConnectionStrings__Database` with the correct hosted database connection string.
- [ ] Confirm Production mode and the frontend origin in `Cors.AllowedOrigins`; override only when needed.
- [ ] If using Seq, supply `Seq__ServerUrl` and the ingestion `Seq__ApiKey`; otherwise leave the URL blank.
- [ ] Apply pending database migrations before using endpoints that need the schema.
- [ ] Publish/upload the backend, then restart it so environment-variable changes take effect.
- [ ] Check `/api/health`, create a room to verify database access, and check Seq with a non-health request when enabled.

The settings checklist is a reminder; it does not configure MonsterASP or create cloud secrets automatically.

1. **Configure the website**

   In MonsterASP, select your cloud website, choose **.NET 10**, and enable HTTPS.

   The API now uses two standard configuration files:

   - `apps/api/appsettings.json`: shared/production settings, including the production frontend CORS origin.
   - `apps/api/appsettings.Development.json`: ignored local overrides. On a fresh checkout, copy `apps/api/appsettings.Development.example.json` to this filename. The example contains no credentials. An empty database connection uses local SQLite; local Angular origins are allowed here. Both the local file and example are excluded from the backend publish output.

   `dotnet run --project apps/api` uses the Development launch profile at `http://localhost:5080`. Published applications normally use Production. Use the exact filename `appsettings.Development.json`, including capital `D`.

   On MonsterASP, the non-secret defaults are already in `appsettings.json`. Under **Scripting → Environment variables**, configure the production database secret; the other entries are optional overrides:

   | Name                          | Value                                                                                                                                                                                                                        |
   | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ASPNETCORE_ENVIRONMENT`      | Selects the environment; `Production` is already the published default. This selects configuration files, so it is not a setting inside those files.                                                                         |
   | `ConnectionStrings__Database` | Overrides `ConnectionStrings.Database` with your database's **local access connection string**. Recommended for the password. Alternatively set that value in the server-only `appsettings.json`; do not commit credentials. |
   | `Cors__AllowedOrigins__0`     | Overrides `Cors.AllowedOrigins[0]`. The file currently allows `https://dewchan01.github.io`, based on this project's published frontend. Change it only when the frontend origin changes.                                    |
   | `Cors__AllowedOrigins__1`     | Optional second origin: `http://localhost:4200` allows a locally running Angular app to call the hosted API. It is unnecessary when testing against the local API.                                                           |

   Double underscores (`__`) separate nested configuration sections; `0` and `1` are array indexes. Values load from base JSON, then environment-specific JSON, then hosting environment variables, then command-line arguments; later values override earlier ones. These variables are optional if the server's JSON already contains the desired values. The custom `appsettings.Local.json` loader has been removed. [ASP.NET Core configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0)

   `apps/web/config/production/config.json` remains a separate public frontend setting: its backend.apiUrl contains the API's HTTPS origin alongside public recognition and support settings. It must never contain SQL credentials. Angular cannot read the backend's private `appsettings.json`.

   For GitHub Pages, the origin excludes the repository path. Restart the application after changing variables. [Environment-variable instructions](https://help.monsterasp.net/websites/configuration/environment-variables)

2. **Copy the correct database connection string**

   Open **Databases → your MSSQL database → Users → Connection string**.

   Use **Local access** for the hosted API. Keep the provided encryption settings. This project requires the configuration name **Database**, rather than `DefaultConnection`. [Connection-string instructions](https://help.monsterasp.net/databases/mssql/connection-string)

3. **Generate the database tables**

   From your repository root, run:

   ```powershell
   dotnet tool restore
   dotnet ef migrations script --idempotent --project apps/api --output artifacts/online-schema.sql
   ```

   Execute `artifacts/online-schema.sql` against that SQL Server database using a tool that supports SQL Server batches, such as SSMS/sqlcmd. `GO` is a client batch separator, not a SQL statement. For an existing database's permissions-only upgrade in AdminNeo, use the linked single-command script above. The API does **not** create production tables automatically.

4. **Publish only the backend**

   ```powershell
   dotnet publish apps/api -c Release -o artifacts/api
   Compress-Archive -Path artifacts/api/* -DestinationPath artifacts/backend-iis.zip -Force
   ```

   This publishes the API only; you don’t need to run the Angular build.

5. **Upload to MonsterASP**

   Open **Websites → your website → Files**:

   - Upload `artifacts/backend-iis.zip`.
   - Click **Unzip**, targeting `/wwwroot`.
   - Enable overwrite and restart application pool when replacing a deployment.
   - Ensure `web.config` and `Riichi.Api.dll` are directly inside `/wwwroot`, without an extra parent folder. [ZIP deployment instructions](https://help.monsterasp.net/websites/deploy/zip-file)

6. **Verify the API**

   Visit:

   ```text
   https://YOUR-BACKEND-DOMAIN/api/health
   ```

   Expected:

   ```json
   { "status": "ok" }
   ```

   The `/` homepage may show 404 because this deployment serves an API. The health endpoint checks startup; creating a room also verifies database access.

When you’re ready to connect Angular, set `apps/web/config/production/config.json` to your HTTPS API address before building. **No Angular files need uploading to MonsterASP.**

Example public frontend API origin: `https://jpmj.runasp.net`.
