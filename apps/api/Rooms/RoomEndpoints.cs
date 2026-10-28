using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Security;

namespace Riichi.Api.Rooms;

public sealed record CreateRoom(int PlayerCount);
public sealed record JoinRoom(string Pin, int? Seat);

public static class RoomEndpoints
{
    public static async Task<bool> CanRead(AppDb db, Room room, string token) =>
        Secrets.Matches(token, room.HostHash) || await db.Seats.AnyAsync(x => x.RoomId == room.Id && x.TokenHash == Secrets.Hash(token));

    public static void MapRooms(this WebApplication app)
    {
        var routes = app.MapGroup("/api/rooms").RequireRateLimiting("api");
        routes.MapPost("", async (CreateRoom input, AppDb db, IConfiguration config) =>
        {
            if (input.PlayerCount is not (3 or 4)) return Results.BadRequest();
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            await db.Rooms.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            if (await db.Rooms.CountAsync() >= 100) return Results.StatusCode(507);
            await db.Shares.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync();
            if (await db.StorageBytes() + 1024 > config.GetValue<long>("Storage:MaxBytes", 50 * 1024 * 1024)) return Results.StatusCode(507);
            var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(5));
            var pin = RandomNumberGenerator.GetInt32(1000000).ToString("D6");
            var token = Secrets.Create();
            var room = new Room
            {
                Id = id,
                PinHash = Secrets.PinHash(pin, id),
                HostHash = Secrets.Hash(token),
                PlayerCount = input.PlayerCount,
                ExpiresAt = now + 86400
            };
            db.Rooms.Add(room);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Results.Ok(new { id, pin, token, seat = (int?)null, host = true });
        }).RequireRateLimiting("join");

        routes.MapPost("/{id}/join", async (string id, JoinRoom input, AppDb db, IHubContext<RoomHub> hub) =>
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            // Deliberately identical errors for unknown code and incorrect PIN.
            if (room is null || !Secrets.PinMatches(input.Pin ?? "", id, room.PinHash)) return Results.Unauthorized();
            var occupied = await db.Seats.Where(x => x.RoomId == id).Select(x => x.Number).ToListAsync();
            var seat = input.Seat ?? Enumerable.Range(0, room.PlayerCount).FirstOrDefault(x => !occupied.Contains(x), -1);
            if (seat == -1 && input.Seat is null) return Results.Conflict();
            if (seat < 0 || seat >= room.PlayerCount) return Results.BadRequest();
            if (occupied.Contains(seat)) return Results.Conflict();
            var token = Secrets.Create();
            db.Seats.Add(new Seat { RoomId = id, Number = seat, TokenHash = Secrets.Hash(token) });
            try
            {
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateException) { return Results.Conflict(); }
            await hub.Clients.Group(id).SendAsync("Changed");
            return Results.Ok(new { id, token, seat, host = false });
        }).RequireRateLimiting("join");

        routes.MapGet("/{id}", async (string id, HttpRequest request, AppDb db) =>
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var room = await db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            if (room is null) return Results.NotFound();
            if (!await CanRead(db, room, Secrets.Bearer(request))) return Results.Unauthorized();
            var seats = await db.Seats.Where(x => x.RoomId == id).Select(x => x.Number).ToArrayAsync();
            return Results.Ok(new
            {
                room.Id,
                room.PlayerCount,
                room.Revision,
                seats,
                expiresAt = DateTimeOffset.FromUnixTimeSeconds(room.ExpiresAt)
            });
        });

        routes.MapDelete("/{id}/seats/{seat:int}", async (string id, int seat, HttpRequest request, AppDb db, IHubContext<RoomHub> hub) =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
            if (room is null) return Results.NotFound();
            if (!Secrets.Matches(Secrets.Bearer(request), room.HostHash)) return Results.Unauthorized();
            await db.Seats.Where(x => x.RoomId == id && x.Number == seat).ExecuteDeleteAsync();
            await db.Actions.Where(x => x.RoomId == id && x.Seat == seat && x.Status == "pending")
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.Status, "rejected").SetProperty(x => x.Error, "Room credentials are incorrect or expired."));
            room.Revision++;
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            await hub.Clients.Group(id).SendAsync("Changed");
            return Results.NoContent();
        });

        routes.MapDelete("/{id}", async (string id, HttpRequest request, AppDb db, IHubContext<RoomHub> hub) =>
        {
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id);
            if (room is null) return Results.NotFound();
            if (!Secrets.Matches(Secrets.Bearer(request), room.HostHash)) return Results.Unauthorized();
            await db.Rooms.Where(x => x.Id == id).ExecuteDeleteAsync();
            await hub.Clients.Group(id).SendAsync("Changed");
            return Results.NoContent();
        });
    }
}

// Only invalidation notifications travel through this hub, never snapshots or secrets.
// Every snapshot request rechecks membership, so revoked connections cannot read state.
public sealed class RoomHub(AppDb db) : Hub
{
    public async Task Join(string id, string token)
    {
        if (Context.Items.ContainsKey("room")) throw new HubException("Already subscribed.");
        Context.Items["room"] = id;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now);
        if (room is null || !await RoomEndpoints.CanRead(db, room, token)) throw new HubException("Room access denied.");
        await Groups.AddToGroupAsync(Context.ConnectionId, id);
    }
}
