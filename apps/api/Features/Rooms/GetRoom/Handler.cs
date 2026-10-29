using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Riichi.Api.Data;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms;

namespace Riichi.Api.Features.Rooms.GetRoom;

/// <summary>Reads the lobby after verifying current room membership.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="access">The room membership checker.</param>
public sealed class Handler(AppDb db, IRoomAccess access) : QueryHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IRoomAccess _access = access ?? throw new ArgumentNullException(nameof(access));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var room = await _db.Rooms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        if (!await _access.CanReadAsync(room, command.Token, cancellationToken)) return Results.Unauthorized();
        var seats = await _db.Seats.Where(x => x.RoomId == id).Select(x => x.Number).ToArrayAsync(cancellationToken);
        var snapshot = JsonSerializer.Deserialize<JsonElement>(room.Snapshot);
        string[]? playerNames = null;
        if (snapshot.ValueKind == JsonValueKind.Object)
        {
            if (snapshot.TryGetProperty("playerNames", out var names)) playerNames = names.Deserialize<string[]>();
            else if (snapshot.TryGetProperty("players", out var players))
                playerNames = players.EnumerateArray().Select(player => player.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String ? name.GetString() ?? "" : "").ToArray();
        }
        return Results.Ok(new
        {
            room.Id,
            room.PlayerCount,
            room.Revision,
            seats,
            playerNames,
            expiresAt = DateTimeOffset.FromUnixTimeSeconds(room.ExpiresAt)
        });
    }
}
