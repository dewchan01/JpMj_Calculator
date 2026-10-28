using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Security;

namespace Riichi.Api.Rooms;

public sealed record SubmitAction(string Id, string HandKey, string Kind, JsonElement Payload, int? Seat = null);
public sealed record ActionDecision(string Id, string Error);
public sealed record CommitGame(long Revision, string HandKey, JsonElement Match, ActionDecision[] Decisions);

public static class GameEndpoints
{
    public static void MapRoomGames(this WebApplication app)
    {
        var routes = app.MapGroup("/api/rooms/{id}/game").RequireRateLimiting("api");
        routes.MapGet("", async (string id, long? revision, HttpRequest request, AppDb db) =>
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var room = await db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            if (room is null) return Results.NotFound();
            var token = Secrets.Bearer(request);
            if (!await RoomEndpoints.CanRead(db, room, token)) return Results.Unauthorized();
            if (revision == room.Revision) return Results.NoContent();
            var host = Secrets.Matches(token, room.HostHash);
            var hash = Secrets.Hash(token);
            var visible = db.Actions.AsNoTracking().Where(x => x.RoomId == id && (host || x.ActorHash == hash));
            var pending = await visible.Where(x => x.Status == "pending").OrderBy(x => x.CreatedAt).ToArrayAsync();
            var recent = await visible.Where(x => x.Status != "pending").OrderByDescending(x => x.CreatedAt).Take(20).ToArrayAsync();
            var actions = pending.Concat(recent);
            return Results.Ok(new
            {
                room.Revision,
                room.HandKey,
                match = JsonSerializer.Deserialize<JsonElement>(room.Snapshot),
                actions = actions.Select(x => new { x.Id, x.Seat, x.HandKey, x.Kind, payload = JsonSerializer.Deserialize<JsonElement>(x.Payload), x.Status, x.Error, x.CreatedAt })
            });
        });
        routes.MapPost("/actions", async (string id, SubmitAction input, HttpRequest request, AppDb db, IHubContext<RoomHub> hub, IConfiguration config) =>
        {
            if (input.Id is null || !Guid.TryParse(input.Id, out _) || input.HandKey is null || input.HandKey.Length > 256 ||
                input.Kind is not ("riichi" or "cancelRiichi" or "call" or "win") || input.Payload.ValueKind != JsonValueKind.Object || input.Payload.GetRawText().Length > 32768)
                return Results.BadRequest();
            input = input with { Id = Guid.Parse(input.Id).ToString() };
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            if (room is null) return Results.NotFound();
            var hash = Secrets.Hash(Secrets.Bearer(request));
            var seat = await db.Seats.SingleOrDefaultAsync(x => x.RoomId == id && x.TokenHash == hash);
            var host = Secrets.Matches(Secrets.Bearer(request), room.HostHash);
            var actorSeat = host ? input.Seat : seat?.Number;
            if (actorSeat is null || actorSeat < 0 || actorSeat >= room.PlayerCount) return Results.Unauthorized();
            var duplicate = await db.Actions.SingleOrDefaultAsync(x => x.RoomId == id && x.Id == input.Id);
            if (duplicate is not null)
                return duplicate.ActorHash == hash ? Results.Ok(new { duplicate.Id, duplicate.Status, duplicate.Error }) : Results.Conflict();
            if (room.HandKey.Length == 0 || input.HandKey != room.HandKey) return Results.Conflict(new { error = "The hand has changed. Refresh before declaring." });
            if (await db.Actions.CountAsync(x => x.RoomId == id) >= 512 ||
                await db.Actions.CountAsync(x => x.RoomId == id && x.ActorHash == hash && x.Status == "pending") >= 8) return Results.StatusCode(429);
            if (await db.StorageBytes() + input.Payload.GetRawText().Length * 2L + 1024 > config.GetValue<long>("Storage:MaxBytes", 50 * 1024 * 1024)) return Results.StatusCode(507);
            db.Actions.Add(new RoomAction
            {
                RoomId = id,
                Id = input.Id,
                Seat = actorSeat.Value,
                ActorHash = hash,
                HandKey = input.HandKey,
                Kind = input.Kind,
                Payload = input.Payload.GetRawText(),
                CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
            room.Revision++;
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            await hub.Clients.Group(id).SendAsync("Changed");
            return Results.Ok(new { input.Id, status = "pending", error = "" });
        });
        routes.MapPut("", async (string id, CommitGame input, HttpRequest request, AppDb db, IHubContext<RoomHub> hub, IConfiguration config) =>
        {
            if (input.HandKey is null || input.HandKey.Length is < 1 or > 256 || input.Decisions is null || input.Decisions.Length > 64 ||
                input.Match.ValueKind != JsonValueKind.Object || input.Match.GetRawText().Length > 5 * 1024 * 1024 ||
                !input.Match.TryGetProperty("playerCount", out var count) || count.ValueKind != JsonValueKind.Number || !count.TryGetInt32(out var playerCount) ||
                !input.Match.TryGetProperty("players", out var players) || players.ValueKind != JsonValueKind.Array || players.GetArrayLength() != playerCount)
                return Results.BadRequest();
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            if (room is null) return Results.NotFound();
            if (!Secrets.Matches(Secrets.Bearer(request), room.HostHash)) return Results.Unauthorized();
            if (room.Revision != input.Revision) return Results.Conflict(new { error = "The room changed. Refresh before saving." });
            if (room.PlayerCount != playerCount) return Results.BadRequest();
            if (await db.StorageBytes() + (input.Match.GetRawText().Length - room.Snapshot.Length) * 2L > config.GetValue<long>("Storage:MaxBytes", 50 * 1024 * 1024)) return Results.StatusCode(507);
            // Once attached, replacing the game or reassigning player identities requires a new room.
            if (room.HandKey.Length > 0)
            {
                using var previous = JsonDocument.Parse(room.Snapshot);
                if (!input.Match.TryGetProperty("id", out var matchId) ||
                    previous.RootElement.GetProperty("id").GetString() != matchId.GetString() ||
                    !previous.RootElement.GetProperty("players").EnumerateArray().Select(x => x.GetProperty("id").GetString())
                        .SequenceEqual(players.EnumerateArray().Select(x => x.GetProperty("id").GetString()))) return Results.BadRequest();
            }
            var pending = await db.Actions.Where(x => x.RoomId == id && x.Status == "pending").ToArrayAsync();
            foreach (var decision in input.Decisions)
            {
                var action = pending.SingleOrDefault(x => x.Id == decision.Id);
                if (action is null || decision.Error is null || decision.Error.Length > 1000) return Results.BadRequest();
                action.Status = decision.Error.Length == 0 ? "accepted" : "rejected";
                action.Error = decision.Error;
            }
            foreach (var action in pending.Where(x => x.Status == "pending" && x.HandKey != input.HandKey))
            {
                action.Status = "rejected";
                action.Error = "The hand has changed. Refresh before declaring.";
            }
            room.Snapshot = input.Match.GetRawText();
            room.HandKey = input.HandKey;
            room.Revision++;
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            await hub.Clients.Group(id).SendAsync("Changed");
            return Results.Ok(new { room.Revision });
        });
    }
}
