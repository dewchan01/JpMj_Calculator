using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Riichi.Api.Data;
using Riichi.Api.Resources;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.Notifications;

/// <summary>Publishes state invalidations and player presence to authenticated room members.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="access">The room membership checker.</param>
/// <param name="presence">The authenticated connection registry.</param>
public sealed class RoomHub(AppDb db, IRoomAccess access, RoomPresence presence) : Hub
{
    private readonly RoomPresence _presence = presence ?? throw new ArgumentNullException(nameof(presence));
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IRoomAccess _access = access ?? throw new ArgumentNullException(nameof(access));
    /// <summary>Authenticates and subscribes this connection to one room.</summary>
    /// <param name="id">The room code.</param>
    /// <param name="token">The host or seat credential.</param>
    /// <returns>The current room presence.</returns>
    public async Task<PresenceSnapshot?> Join(string id, string token)
    {
        if (Context.Items.ContainsKey("room")) throw new HubException(ErrorMessages.Get("AlreadySubscribed"));
        Context.Items["room"] = id;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var ct = Context.ConnectionAborted;
        var room = await _db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct);
        if (room is null || !await _access.CanReadAsync(room, token, ct)) throw new HubException(ErrorMessages.Get("RoomAccessDenied"));
        await Groups.AddToGroupAsync(Context.ConnectionId, id, ct);
        var host = Secrets.Matches(token, room.HostHash);
        if (host) await Groups.AddToGroupAsync(Context.ConnectionId, id + ":hosts", ct);
        var hash = Secrets.Hash(token);
        var seat = await _db.Seats.AsNoTracking().Where(x => x.RoomId == id && x.TokenHash == hash).Select(x => (int?)x.Number).FirstOrDefaultAsync(ct);
        var snapshot = _presence.Connect(Context.ConnectionId, id, seat, hash);
        await Clients.Group(id).SendAsync("Presence", snapshot);
        return snapshot;
    }
    /// <summary>Changes the caller's table activity while preserving membership.</summary>
    public async Task SetAway(bool away)
    {
        var snapshot = _presence.SetAway(Context.ConnectionId, away);
        if (snapshot is null) throw new HubException(ErrorMessages.Get("RoomAccessDenied"));
        await Clients.Group((string)Context.Items["room"]!).SendAsync("Presence", snapshot);
    }
    /// <summary>Refreshes host-only notifications after a verified ownership change.</summary>
    public async Task RefreshRole(string id, string token)
    {
        if (Context.Items["room"] as string != id) throw new HubException(ErrorMessages.Get("RoomAccessDenied"));
        var room = await _db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, Context.ConnectionAborted);
        if (room is null || !await _access.CanReadAsync(room, token, Context.ConnectionAborted)) throw new HubException(ErrorMessages.Get("RoomAccessDenied"));
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, id + ":hosts");
        if (Secrets.Matches(token, room.HostHash)) await Groups.AddToGroupAsync(Context.ConnectionId, id + ":hosts");
    }

    /// <inheritdoc />
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_presence.Disconnect(Context.ConnectionId) is { } entry)
            await Clients.Group(entry.Room).SendAsync("Presence", entry.Presence);
        await base.OnDisconnectedAsync(exception);
    }
}
