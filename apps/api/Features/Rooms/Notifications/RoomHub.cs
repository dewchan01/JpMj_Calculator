using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Riichi.Api.Data;
using Riichi.Api.Resources;

namespace Riichi.Api.Features.Rooms.Notifications;

/// <summary>Publishes invalidations only; every state request revalidates membership.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="access">The room membership checker.</param>
public sealed class RoomHub(AppDb db, IRoomAccess access) : Hub
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IRoomAccess _access = access ?? throw new ArgumentNullException(nameof(access));
    /// <summary>Authenticates and subscribes this connection to one room.</summary>
    /// <param name="id">The room code.</param>
    /// <param name="token">The host or seat credential.</param>
    /// <returns>The subscription completion.</returns>
    public async Task Join(string id, string token)
    {
        if (Context.Items.ContainsKey("room")) throw new HubException(ErrorMessages.Get("AlreadySubscribed"));
        Context.Items["room"] = id;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var ct = Context.ConnectionAborted;
        var room = await _db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct);
        if (room is null || !await _access.CanReadAsync(room, token, ct)) throw new HubException(ErrorMessages.Get("RoomAccessDenied"));
        await Groups.AddToGroupAsync(Context.ConnectionId, id, ct);
    }
}
