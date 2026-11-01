using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Features.Rooms.Notifications;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.Lifecycle;

/// <summary>Serializes room departures, ownership changes and host-approved re-entry.</summary>
public sealed class RoomLifecycle(AppDb db, RoomPresence presence, IHubContext<RoomHub> hub)
{
    /// <summary>Leaves a room, handing ownership to an online member or finalizing an empty room.</summary>
    public async Task<IResult> Leave(string id, string token, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct);
        if (room is null) return Results.NotFound();
        var hash = Secrets.Hash(token);
        if (hash != room.HostHash && !await db.Seats.AnyAsync(x => x.RoomId == id && x.TokenHash == hash, ct) && !await db.Unassigned.AnyAsync(x => x.RoomId == id && x.TokenHash == hash, ct)) return Results.Unauthorized();
        if (!room.Closed) await Depart(room, hash, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await Notify(id, ct, room.Closed);
        return Results.Ok(new { closed = room.Closed, match = room.Closed && !string.IsNullOrEmpty(room.HandKey) ? JsonSerializer.Deserialize<JsonElement>(room.Snapshot) : (JsonElement?)null });
    }

    /// <summary>Only the current host may explicitly appoint an assigned member.</summary>
    public async Task<IResult> Transfer(string id, string token, int seat, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(token, room.HostHash)) return Results.StatusCode(403);
        if (room.Closed) return Results.StatusCode(410);
        var next = await db.Seats.SingleOrDefaultAsync(x => x.RoomId == id && x.Number == seat, ct);
        if (next is null || next.TokenHash == room.HostHash) return Results.BadRequest();
        room.HostHash = next.TokenHash; room.HostOfflineSince = null; room.Revision++;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await Notify(id, ct);
        return Results.NoContent();
    }

    /// <summary>Accepts or rejects a pending mid-game seat request after rechecking occupancy.</summary>
    public async Task<IResult> Decide(string id, string token, string memberId, bool accept, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(token, room.HostHash)) return Results.StatusCode(403);
        if (room.Closed) return Results.StatusCode(410);
        var member = await db.Unassigned.SingleOrDefaultAsync(x => x.RoomId == id && x.Id == memberId && x.Decision == "pending", ct);
        if (member?.RequestedSeat is not { } seat) return Results.NotFound();
        if (accept)
        {
            if (await db.Seats.AnyAsync(x => x.RoomId == id && x.Number == seat, ct)) return Results.Conflict();
            db.Unassigned.Remove(member);
            db.Seats.Add(new Seat { RoomId = id, Number = seat, TokenHash = member.TokenHash });
        }
        else member.Decision = "rejected";
        room.Revision++;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (accept) await hub.Clients.Group(id).SendAsync("Presence", presence.Assign(id, member.TokenHash, seat), ct);
        await Notify(id, ct);
        return Results.NoContent();
    }

    /// <summary>Observes disconnects and applies the thirty-second reconnection grace period.</summary>
    public async Task Check(string id, long now, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var room = await db.Rooms.SingleOrDefaultAsync(x => x.Id == id && !x.Closed, ct);
        if (room is null) return;
        var changed = false;
        if (presence.IsConnected(id, room.HostHash)) room.HostOfflineSince = null;
        else
        {
            room.HostOfflineSince ??= now;
            if (now - room.HostOfflineSince >= 30)
            {
                await Depart(room, room.HostHash, ct);
                changed = true;
            }
        }
        if (!room.Closed)
            foreach (var seat in await db.Seats.Where(x => x.RoomId == id && x.TokenHash != room.HostHash).ToArrayAsync(ct))
            {
                if (presence.IsConnected(id, seat.TokenHash)) seat.OfflineSince = null;
                else
                {
                    seat.OfflineSince ??= now;
                    if (now - seat.OfflineSince >= 30)
                    {
                        db.Seats.Remove(seat);
                        if (!await db.Unassigned.AnyAsync(x => x.RoomId == id && x.TokenHash == seat.TokenHash, ct))
                            db.Unassigned.Add(new UnassignedPlayer { RoomId = id, TokenHash = seat.TokenHash });
                        await RejectActions(id, seat.TokenHash, ct);
                        presence.ReleaseMember(id, seat.TokenHash);
                        room.Revision++; changed = true;
                    }
                }
            }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (changed) await Notify(id, ct);
    }

    private async Task Depart(Room room, string hash, CancellationToken ct)
    {
        var id = room.Id;
        presence.ReleaseMember(id, hash);
        await db.Seats.Where(x => x.RoomId == id && x.TokenHash == hash).ExecuteDeleteAsync(ct);
        await db.Unassigned.Where(x => x.RoomId == id && x.TokenHash == hash).ExecuteDeleteAsync(ct);
        await RejectActions(id, hash, ct);
        if (room.HostHash == hash)
        {
            var candidates = await db.Seats.Where(x => x.RoomId == id).OrderBy(x => x.Number).ToArrayAsync(ct);
            var successor = candidates.FirstOrDefault(x => presence.IsConnected(id, x.TokenHash))?.TokenHash;
            if (successor is not null) { room.HostHash = successor; room.HostOfflineSince = null; }
            else
            {
                RoomFinalizer.Finish(room);
                await db.Seats.Where(x => x.RoomId == id).ExecuteDeleteAsync(ct);
                await db.Unassigned.Where(x => x.RoomId == id).ExecuteDeleteAsync(ct);
                presence.Remove(id);
                await db.Actions.Where(x => x.RoomId == id && x.Status == "pending").ExecuteUpdateAsync(x => x.SetProperty(a => a.Status, "rejected").SetProperty(a => a.Error, "This room has ended."), ct);
            }
        }
        room.Revision++;
    }
    private Task<int> RejectActions(string id, string hash, CancellationToken ct) => db.Actions.Where(x => x.RoomId == id && x.ActorHash == hash && x.Status == "pending").ExecuteUpdateAsync(x => x.SetProperty(a => a.Status, "rejected").SetProperty(a => a.Error, "The player left the room."), ct);
    private async Task Notify(string id, CancellationToken ct, bool closed = false)
    {
        if (closed) await hub.Clients.Group(id).SendAsync("Closed", ct);
        await hub.Clients.Group(id).SendAsync("Changed", ct);
    }
}
