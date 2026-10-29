using System.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Features.Rooms.Notifications;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.ChoosePlayer;

/// <summary>Atomically moves a guest's own credential to an unoccupied lobby player.</summary>
public sealed class Handler(AppDb db, IHubContext<RoomHub> hub, RoomPresence presence) : CommandHandler<Request>
{
    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await db.Rooms.SingleOrDefaultAsync(room => room.Id == command.Id && room.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        if (Secrets.Matches(command.Token, room.HostHash)) return Results.StatusCode(403);
        var hash = Secrets.Hash(command.Token);
        var own = await db.Seats.SingleOrDefaultAsync(seat => seat.RoomId == room.Id && seat.TokenHash == hash, cancellationToken);
        if (own is null) return Results.Unauthorized();
        if (command.Seat < 0 || command.Seat >= room.PlayerCount) return Results.BadRequest();
        if (own.Number == command.Seat) return Results.NoContent();
        if (!string.IsNullOrEmpty(room.HandKey)) return Results.Conflict();
        if (await db.Seats.AnyAsync(seat => seat.RoomId == room.Id && seat.Number == command.Seat, cancellationToken)) return Results.Conflict();
        var previous = own.Number;
        db.Seats.Remove(own);
        await db.SaveChangesAsync(cancellationToken);
        db.Seats.Add(new Seat { RoomId = room.Id, Number = command.Seat, TokenHash = hash });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await hub.Clients.Group(room.Id + ":hosts").SendAsync("Presence", presence.Release(room.Id, previous), cancellationToken);
        await hub.Clients.Group(room.Id).SendAsync("Changed", cancellationToken);
        return Results.NoContent();
    }
}
