using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Riichi.Api.Data;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms;
using Riichi.Api.Infrastructure.Security;

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
        var hash = Secrets.Hash(command.Token);
        var ownSeat = await _db.Seats.Where(x => x.RoomId == id && x.TokenHash == hash).Select(x => (int?)x.Number).FirstOrDefaultAsync(cancellationToken);
        var unassigned = Secrets.Matches(command.Token, room.HostHash)
            ? await _db.Unassigned.Where(x => x.RoomId == id).Select(x => new { x.Id, x.RequestedSeat, x.Decision }).ToArrayAsync(cancellationToken)
            : null;
        var assignment = await _db.Unassigned.Where(x => x.RoomId == id && x.TokenHash == hash).Select(x => x.Decision).FirstOrDefaultAsync(cancellationToken);
        var snapshot = JsonSerializer.Deserialize<JsonElement>(room.Snapshot);
        string[]? playerNames = null;
        string? ruleLabel = null;
        string? gameLength = null;
        if (snapshot.ValueKind == JsonValueKind.Object)
        {
            if (snapshot.TryGetProperty("gameLength", out var length) && length.ValueKind == JsonValueKind.String) gameLength = length.GetString();
            if (snapshot.TryGetProperty("ruleLabel", out var label) && label.ValueKind == JsonValueKind.String) ruleLabel = label.GetString();
            else if (snapshot.TryGetProperty("rules", out var rules) && rules.ValueKind == JsonValueKind.Object && rules.TryGetProperty("preset", out var preset))
                ruleLabel = preset.GetString() switch { "tenhou" => "Tenhou", "m-league" => "M.League", "custom" => rules.TryGetProperty("name", out var name) ? name.GetString() : "Custom / house rules", _ => "Mahjong Soul" };
            if (snapshot.TryGetProperty("playerNames", out var names)) playerNames = names.Deserialize<string[]>();
            else if (snapshot.TryGetProperty("players", out var players))
                playerNames = players.EnumerateArray().Select(player => player.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String ? name.GetString() ?? "" : "").ToArray();
        }
        return Results.Ok(new
        {
            room.Id,
            room.PlayerCount,
            matchName = snapshot.ValueKind == JsonValueKind.Object && snapshot.TryGetProperty("name", out var matchName) && matchName.ValueKind == JsonValueKind.String ? matchName.GetString() : null,
            host = Secrets.Matches(command.Token, room.HostHash),
            room.Revision,
            seats,
            ownSeat,
            assignment,
            room.Closed,
            started = !string.IsNullOrEmpty(room.HandKey),
            unassigned,
            pendingMatch = Secrets.Matches(command.Token, room.HostHash) && string.IsNullOrEmpty(room.HandKey) && snapshot.ValueKind == JsonValueKind.Object && snapshot.TryGetProperty("id", out _) ? (JsonElement?)snapshot : null,
            playerNames,
            ruleLabel,
            gameLength,
            expiresAt = DateTimeOffset.FromUnixTimeSeconds(room.ExpiresAt)
        });
    }
}
