namespace Riichi.Api.Features.Rooms.Notifications;

/// <summary>Current online seat indexes and their monotonic notification version.</summary>
/// <param name="Version">The process-local presence revision.</param>
/// <param name="Seats">Seats with at least one authenticated hub connection.</param>
public sealed record PresenceSnapshot(long Version, int[] Seats);

/// <summary>Tracks authenticated connections without retaining credentials or changing game revisions.</summary>
public sealed class RoomPresence
{
    private readonly object _gate = new();
    private readonly Dictionary<string, (string Room, int? Seat)> _connections = [];
    private long _version;

    /// <summary>Registers an authenticated connection.</summary>
    /// <param name="connection">The SignalR connection ID.</param>
    /// <param name="room">The room identifier.</param>
    /// <param name="seat">The occupied seat, if any.</param>
    /// <returns>The updated room snapshot.</returns>
    public PresenceSnapshot Connect(string connection, string room, int? seat)
    {
        lock (_gate) { _connections[connection] = (room, seat); _version++; return Snapshot(room); }
    }

    /// <summary>Removes a connection while preserving other tabs on the same seat.</summary>
    /// <param name="connection">The disconnected connection ID.</param>
    /// <returns>The affected room and snapshot, or null.</returns>
    public (string Room, PresenceSnapshot Presence)? Disconnect(string connection)
    {
        lock (_gate)
        {
            if (!_connections.Remove(connection, out var entry)) return null;
            _version++;
            return (entry.Room, Snapshot(entry.Room));
        }
    }

    /// <summary>Reads online seats for a room.</summary>
    /// <param name="room">The room identifier.</param>
    /// <returns>The current snapshot.</returns>
    public PresenceSnapshot Get(string room) { lock (_gate) return Snapshot(room); }

    /// <summary>Removes revoked seat connections from presence.</summary>
    /// <param name="room">The room identifier.</param>
    /// <param name="seat">The revoked seat.</param>
    /// <returns>The updated snapshot.</returns>
    public PresenceSnapshot Release(string room, int seat)
    {
        lock (_gate)
        {
            foreach (var key in _connections.Where(x => x.Value.Room == room && x.Value.Seat == seat).Select(x => x.Key).ToArray()) _connections.Remove(key);
            _version++;
            return Snapshot(room);
        }
    }

    /// <summary>Forgets a closed room's connections.</summary>
    /// <param name="room">The closed room identifier.</param>
    public void Remove(string room)
    {
        lock (_gate)
        {
            foreach (var key in _connections.Where(x => x.Value.Room == room).Select(x => x.Key).ToArray()) _connections.Remove(key);
            _version++;
        }
    }

    private PresenceSnapshot Snapshot(string room) => new(_version,
        _connections.Values.Where(x => x.Room == room && x.Seat.HasValue).Select(x => x.Seat!.Value).Distinct().Order().ToArray());
}
