using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms;

/// <summary>Revalidates host or seat credentials against current room state.</summary>
/// <param name="db">The scoped database context.</param>
public sealed class RoomAccess(AppDb db) : IRoomAccess
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    /// <inheritdoc />
    public Task<bool> CanReadAsync(Room room, string token, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(room);
        ArgumentNullException.ThrowIfNull(token);
        cancellationToken.ThrowIfCancellationRequested();
        if (Secrets.Matches(token, room.HostHash)) return Task.FromResult(true);
        var hash = Secrets.Hash(token);
        return _db.Seats.AnyAsync(x => x.RoomId == room.Id && x.TokenHash == hash, cancellationToken);
    }
}
