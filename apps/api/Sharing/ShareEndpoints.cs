using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Security;

namespace Riichi.Api.Sharing;

public static class ShareEndpoints
{
    public static bool IsArchive(JsonElement value) => value.ValueKind == JsonValueKind.Object &&
        value.TryGetProperty("format", out var format) && format.ValueKind == JsonValueKind.String && format.GetString() == "riichi-table" &&
        value.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var v) && v == 1 &&
        value.TryGetProperty("matches", out var matches) && matches.ValueKind == JsonValueKind.Array && matches.GetArrayLength() is > 0 and <= 500;

    public static void MapShares(this WebApplication app)
    {
        var routes = app.MapGroup("/api/shares").RequireRateLimiting("api");
        routes.MapPost("", async (HttpRequest request, AppDb db, IConfiguration config) =>
        {
            var max = config.GetValue<int>("Storage:MaxArchiveBytes", 5 * 1024 * 1024);
            using var buffer = new MemoryStream();
            var bytes = new byte[8192];
            int count;
            while ((count = await request.Body.ReadAsync(bytes)) > 0)
            {
                if (buffer.Length + count > max) return Results.StatusCode(413);
                buffer.Write(bytes, 0, count);
            }
            var content = buffer.ToArray();
            try
            {
                using var document = JsonDocument.Parse(content, new JsonDocumentOptions { MaxDepth = 64 });
                if (!IsArchive(document.RootElement)) return Results.BadRequest(new { error = "Invalid game archive." });
            }
            catch (JsonException) { return Results.BadRequest(new { error = "Invalid game archive." }); }
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            // Serializable quota check prevents simultaneous uploads bypassing the global limit.
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await db.Shares.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync();
            await db.Rooms.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync();
            var used = await db.StorageBytes();
            if (used + content.Length > config.GetValue<long>("Storage:MaxBytes", 50 * 1024 * 1024))
                return Results.StatusCode(507);
            var deletionSecret = Secrets.Create();
            var share = new SharedArchive
            {
                Id = Secrets.Create(),
                Content = content,
                Size = content.Length,
                DeleteHash = Secrets.Hash(deletionSecret),
                ExpiresAt = now + 86400
            };
            db.Shares.Add(share);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Results.Ok(new { share.Id, deletionSecret, expiresAt = DateTimeOffset.FromUnixTimeSeconds(share.ExpiresAt) });
        });
        routes.MapGet("/{id}", async (string id, AppDb db, HttpResponse response) =>
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var share = await db.Shares.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            response.Headers.CacheControl = "no-store";
            response.Headers["X-Content-Type-Options"] = "nosniff";
            return share is null ? Results.NotFound() : Results.File(share.Content, "application/json", "riichi-games.json");
        });
        routes.MapDelete("/{id}", async (string id, HttpRequest request, AppDb db) =>
        {
            var share = await db.Shares.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
            if (share is null) return Results.NoContent();
            if (!Secrets.Matches(request.Headers["X-Deletion-Secret"].ToString(), share.DeleteHash)) return Results.Unauthorized();
            await db.Shares.Where(x => x.Id == id).ExecuteDeleteAsync();
            return Results.NoContent();
        });
    }
}
