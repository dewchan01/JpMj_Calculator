namespace Riichi.Api.Features.Rooms.Notifications;

/// <summary>Current online seat indexes and their monotonic notification version.</summary>
/// <param name="Version">The process-local presence revision.</param>
/// <param name="Seats">Seats with at least one authenticated hub connection.</param>
/// <param name="AwaySeats">Online seats whose connections are all away from the table.</param>
public sealed record PresenceSnapshot(long Version, int[] Seats, int[]? AwaySeats = null);

/// <summary>Tracks authenticated connections without retaining credentials or changing game revisions.</summary>
public sealed class RoomPresence
{
    private readonly object _gate = new();
    private readonly Dictionary<string, (string Room, int? Seat, string Hash, bool Away)> _connections = [];
    private long _version;

    /// <summary>Registers an authenticated connection.</summary>
    /// <param name="connection">The SignalR connection ID.</param>
    /// <param name="room">The room identifier.</param>
    /// <param name="seat">The occupied seat, if any.</param>
    /// <param name="hash">The authenticated membership hash.</param>
    /// <returns>The updated room snapshot.</returns>
    public PresenceSnapshot Connect(string connection, string room, int? seat, string hash = "")
    {
        lock (_gate) { _connections[connection] = (room, seat, hash, false); _version++; return Snapshot(room); }
    }
    /// <summary>Marks a connected member as temporarily away without releasing their seat.</summary>
    public PresenceSnapshot? SetAway(string connection, bool away)
    {
        lock (_gate)
        {
            if (!_connections.TryGetValue(connection, out var entry)) return null;
            _connections[connection] = (entry.Room, entry.Seat, entry.Hash, away);
            _version++;
            return Snapshot(entry.Room);
        }
    }
    /// <summary>Checks whether a credential still has a live connection.</summary>
    public bool IsConnected(string room, string hash) { lock (_gate) return _connections.Values.Any(x => x.Room == room && x.Hash == hash); }
    /// <summary>Updates a member's seat without disconnecting their authenticated connections.</summary>
    public PresenceSnapshot Assign(string room, string hash, int? seat)
    {
        lock (_gate)
        {
            foreach (var key in _connections.Where(x => x.Value.Room == room && x.Value.Hash == hash).Select(x => x.Key).ToArray())
                _connections[key] = (room, seat, hash, _connections[key].Away);
            _version++;
            return Snapshot(room);
        }
    }
    /// <summary>Forgets all connections belonging to a departing member.</summary>
    public void ReleaseMember(string room, string hash)
    {
        lock (_gate) { foreach (var key in _connections.Where(x => x.Value.Room == room && x.Value.Hash == hash).Select(x => x.Key).ToArray()) _connections.Remove(key); _version++; }
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
        _connections.Values.Where(x => x.Room == room && x.Seat.HasValue).Select(x => x.Seat!.Value).Distinct().Order().ToArray(),
        _connections.Values.Where(x => x.Room == room && x.Seat.HasValue).GroupBy(x => x.Seat!.Value).Where(x => x.All(connection => connection.Away)).Select(x => x.Key).Order().ToArray());
}
