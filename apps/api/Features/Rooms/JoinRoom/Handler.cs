using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features.Rooms.JoinRoom;

/// <summary>Claims a free or requested seat after passcode verification.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="hub">The room notification hub.</param>
public sealed class Handler(AppDb db, IHubContext<RoomHub> hub) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IHubContext<RoomHub> _hub = hub ?? throw new ArgumentNullException(nameof(hub));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var input = command.Input;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        // Deliberately identical errors for unknown code and incorrect PIN.
        if (room is null || !Secrets.PinMatches(input.Pin ?? "", id, room.PinHash)) return Results.Unauthorized();
        if (room.Closed) return Results.StatusCode(410);
        var occupied = await _db.Seats.Where(x => x.RoomId == id).Select(x => x.Number).ToListAsync(cancellationToken);
        if (occupied.Count >= room.PlayerCount) return Results.Conflict(new { code = "room-full" });
        var seat = string.IsNullOrEmpty(room.HandKey) ? input.Seat : null;
        if (seat is < 0 || seat >= room.PlayerCount) return Results.BadRequest();
        if (seat.HasValue && occupied.Contains(seat.Value)) return Results.Conflict();
        if (await _db.Unassigned.CountAsync(x => x.RoomId == id, cancellationToken) >= 20) return Results.Conflict();
        var token = Secrets.Create();
        if (seat.HasValue) _db.Seats.Add(new Seat { RoomId = id, Number = seat.Value, TokenHash = Secrets.Hash(token) });
        else _db.Unassigned.Add(new UnassignedPlayer { RoomId = id, TokenHash = Secrets.Hash(token) });
        room.Revision++;
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException) { return Results.Conflict(); }
        await _hub.Clients.Group(id).SendAsync("Changed");
        return Results.Ok(new { id, token, seat, host = false });
    }
}
