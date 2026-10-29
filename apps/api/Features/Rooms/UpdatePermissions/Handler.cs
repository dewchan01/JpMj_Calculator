using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Features.Rooms.Notifications;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.UpdatePermissions;

/// <summary>Changes player capabilities after verifying the current host credential.</summary>
/// <param name="db">The scoped persistence context.</param>
/// <param name="hub">The room invalidation hub.</param>
public sealed class Handler(AppDb db, IHubContext<RoomHub> hub) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IHubContext<RoomHub> _hub = hub ?? throw new ArgumentNullException(nameof(hub));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == command.Id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(command.Token, room.HostHash)) return Results.Unauthorized();
        room.Permissions = JsonSerializer.Serialize(command.Permissions);
        room.Revision++;
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { return Results.Conflict(); }
        await _hub.Clients.Group(command.Id).SendAsync("Changed");
        return Results.NoContent();
    }
}
