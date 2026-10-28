Deploy **only `apps/api`** to your MonsterASP website. Your Angular app stays where it is.

1. **Configure the website**

   In MonsterASP, select your cloud website, choose **.NET 10**, and enable HTTPS.

   Under **Scripting → Environment variables**, add:

   | Name | Value |
   |---|---|
   | `ASPNETCORE_ENVIRONMENT` | `Production` |
   | `ConnectionStrings__Database` | Your database’s **local access connection string** |
   | `Cors__AllowedOrigins__0` | Your Angular website origin, e.g. `https://yourname.github.io` |
   | `Cors__AllowedOrigins__1` | `http://localhost:4200` if you also want local Angular testing |

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

   Open your MSSQL database’s query/import tool and execute `artifacts/online-schema.sql` against that database. The API does **not** create production tables automatically.

4. **Publish only the backend**

   ```powershell
   dotnet publish apps/api -c Release -o artifacts/monster-api
   Compress-Archive -Path artifacts/monster-api/* -DestinationPath artifacts/monster-api.zip -Force
   ```

   This publishes the API only; you don’t need to run the Angular build.

5. **Upload to MonsterASP**

   Open **Websites → your website → Files**:

   - Upload `artifacts/monster-api.zip`.
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
   {"status":"ok"}
   ```

   The `/` homepage may show 404 because this deployment serves an API. The health endpoint checks startup; creating a room also verifies database access.

When you’re ready to connect Angular, set its `backend.json` to your HTTPS API address. **No Angular files need uploading to MonsterASP.**