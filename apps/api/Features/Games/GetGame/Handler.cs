using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features.Games.GetGame;

/// <summary>Reads the versioned game and declarations visible to the caller.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="access">The room membership checker.</param>
/// <param name="presence">The online connection registry.</param>
public sealed class Handler(AppDb db, IRoomAccess access, RoomPresence presence) : QueryHandler<Request>
{
    private readonly RoomPresence _presence = presence ?? throw new ArgumentNullException(nameof(presence));
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IRoomAccess _access = access ?? throw new ArgumentNullException(nameof(access));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var revision = command.Revision;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await _db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        var token = command.Token;
        if (!await _access.CanReadAsync(room, token, cancellationToken)) return Results.Unauthorized();
        var host = Secrets.Matches(token, room.HostHash);
        var hash = Secrets.Hash(token);
        var assigned = host || await _db.Seats.AnyAsync(x => x.RoomId == id && x.TokenHash == hash, cancellationToken);
        var seatRequests = host ? await _db.Unassigned.Where(x => x.RoomId == id && x.Decision == "pending" && x.RequestedSeat != null).Select(x => new { x.Id, x.RequestedSeat }).ToArrayAsync(cancellationToken) : null;
        var occupiedSeats = host ? await _db.Seats.Where(x => x.RoomId == id && x.TokenHash != room.HostHash).Select(x => x.Number).ToArrayAsync(cancellationToken) : null;
        if (assigned && revision == room.Revision) return Results.NoContent();
        var canSettle = host || DelegatedChanges.Permissions(room.Permissions).Settle;
        var visible = _db.Actions.AsNoTracking().Where(x => x.RoomId == id && (canSettle || x.ActorHash == hash));
        var pending = await visible.Where(x => x.Status == "pending").OrderBy(x => x.CreatedAt).ToArrayAsync(cancellationToken);
        var recent = await visible.Where(x => x.Status != "pending").OrderByDescending(x => x.CreatedAt).Take(20).ToArrayAsync(cancellationToken);
        var actions = pending.Concat(recent);
        return Results.Ok(new
        {
            presence = _presence.Get(id),
            permissions = DelegatedChanges.Permissions(room.Permissions),
            room.Revision,
            room.HandKey,
            host,
            ownSeat = await _db.Seats.Where(x => x.RoomId == id && x.TokenHash == hash).Select(x => (int?)x.Number).FirstOrDefaultAsync(cancellationToken),
            room.Closed,
            seatRequests,
            occupiedSeats,
            hasGame = !string.IsNullOrEmpty(room.HandKey),
            match = !assigned || string.IsNullOrEmpty(room.HandKey) ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(room.Snapshot),
            actions = actions.Select(x => new { x.Id, x.Seat, x.HandKey, x.Kind, payload = JsonSerializer.Deserialize<JsonElement>(x.Payload), x.Status, x.Error, x.CreatedAt })
        });
    }
}
