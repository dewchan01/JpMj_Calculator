using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features.Rooms.CloseRoom;

/// <summary>Closes a room after verifying host credentials.</summary>
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
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(command.Token, room.HostHash)) return Results.Unauthorized();
        await _db.Rooms.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);
        await _hub.Clients.Group(id).SendAsync("Changed");
        return Results.NoContent();
    }
}
