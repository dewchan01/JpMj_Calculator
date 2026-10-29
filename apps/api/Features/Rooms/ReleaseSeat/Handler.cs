using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Resources;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features.Rooms.ReleaseSeat;

/// <summary>Revokes a seat and rejects its outstanding declarations.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="hub">The room notification hub.</param>
/// <param name="presence">The online connection registry.</param>
public sealed class Handler(AppDb db, IHubContext<RoomHub> hub, RoomPresence presence) : CommandHandler<Request>
{
    private readonly RoomPresence _presence = presence ?? throw new ArgumentNullException(nameof(presence));
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IHubContext<RoomHub> _hub = hub ?? throw new ArgumentNullException(nameof(hub));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var seat = command.Seat;
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(command.Token, room.HostHash)) return Results.Unauthorized();
        await _db.Seats.Where(x => x.RoomId == id && x.Number == seat).ExecuteDeleteAsync(cancellationToken);
        await _db.Actions.Where(x => x.RoomId == id && x.Seat == seat && x.Status == "pending")
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.Status, "rejected").SetProperty(x => x.Error, ErrorMessages.Get("RoomCredentialsExpired")), cancellationToken);
        room.Revision++;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await _hub.Clients.Group(id + ":hosts").SendAsync("Presence", _presence.Release(id, seat));
        await _hub.Clients.Group(id).SendAsync("Changed");
        return Results.NoContent();
    }
}
