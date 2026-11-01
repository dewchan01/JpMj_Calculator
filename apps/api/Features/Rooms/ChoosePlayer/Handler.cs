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
        if (room.Closed) return Results.StatusCode(410);
        if (Secrets.Matches(command.Token, room.HostHash)) return Results.StatusCode(403);
        var hash = Secrets.Hash(command.Token);
        var own = await db.Seats.SingleOrDefaultAsync(seat => seat.RoomId == room.Id && seat.TokenHash == hash, cancellationToken);
        var waiting = await db.Unassigned.SingleOrDefaultAsync(x => x.RoomId == room.Id && x.TokenHash == hash, cancellationToken);
        if (own is null && waiting is null) return Results.Unauthorized();
        if (command.Seat < 0 || command.Seat >= room.PlayerCount) return Results.BadRequest();
        if (own?.Number == command.Seat) return Results.NoContent();
        var occupied = await db.Seats.AnyAsync(seat => seat.RoomId == room.Id && seat.Number == command.Seat, cancellationToken);
        var pending = !occupied && !string.IsNullOrEmpty(room.HandKey);
        if (own is not null) db.Seats.Remove(own);
        if (occupied || pending)
        {
            if (waiting is null) db.Unassigned.Add(new UnassignedPlayer { RoomId = room.Id, TokenHash = hash, RequestedSeat = command.Seat, Decision = pending ? "pending" : "unassigned" });
            else { waiting.RequestedSeat = command.Seat; waiting.Decision = pending ? "pending" : "unassigned"; }
        }
        else if (waiting is not null) db.Unassigned.Remove(waiting);
        room.Revision++;
        await db.SaveChangesAsync(cancellationToken);
        if (!occupied && !pending) db.Seats.Add(new Seat { RoomId = room.Id, Number = command.Seat, TokenHash = hash });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await hub.Clients.Group(room.Id).SendAsync("Presence", presence.Assign(room.Id, hash, occupied || pending ? null : command.Seat), cancellationToken);
        await hub.Clients.Group(room.Id).SendAsync("Changed", cancellationToken);
        return occupied ? Results.Conflict() : pending ? Results.Accepted(value: new { pending = true }) : Results.NoContent();
    }
}
