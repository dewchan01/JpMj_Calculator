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
        return CanReadMemberAsync(room.Id, hash, cancellationToken);
    }
    private async Task<bool> CanReadMemberAsync(string id, string hash, CancellationToken ct) =>
        await _db.Seats.AnyAsync(x => x.RoomId == id && x.TokenHash == hash, ct) ||
        await _db.Unassigned.AnyAsync(x => x.RoomId == id && x.TokenHash == hash, ct);
}
