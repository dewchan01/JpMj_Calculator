using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Configuration;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.CreateRoom;

/// <summary>Creates a room and optionally attaches its initial game atomically.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="storage">The validated storage limits.</param>
public sealed class Handler(AppDb db, IOptions<StorageOptions> storage) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly StorageOptions _storage = storage?.Value ?? throw new ArgumentNullException(nameof(storage));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var input = command;
        if (input.PlayerCount is not (3 or 4)) return Results.BadRequest();
        if (input.HostSeat is { } hostSeat && (hostSeat < 0 || hostSeat >= input.PlayerCount)) return Results.BadRequest();
        var snapshot = "null";
        if (input.Match is { } match)
        {
            if (match.ValueKind != JsonValueKind.Object || match.GetRawText().Length > 5 * 1024 * 1024 ||
                input.HandKey is null || input.HandKey.Length is < 1 or > 256 ||
                !match.TryGetProperty("id", out var matchId) || matchId.ValueKind != JsonValueKind.String ||
                !match.TryGetProperty("playerCount", out var count) || count.ValueKind != JsonValueKind.Number || !count.TryGetInt32(out var playerCount) || playerCount != input.PlayerCount ||
                !match.TryGetProperty("players", out var players) || players.ValueKind != JsonValueKind.Array || players.GetArrayLength() != input.PlayerCount ||
                players.EnumerateArray().Any(p => p.ValueKind != JsonValueKind.Object || !p.TryGetProperty("id", out var pid) || pid.ValueKind != JsonValueKind.String) ||
                players.EnumerateArray().Select(p => p.GetProperty("id").GetString()).Distinct().Count() != input.PlayerCount)
                return Results.BadRequest();
            snapshot = match.GetRawText();
        }
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await _db.Rooms.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        if (await _db.Rooms.CountAsync(cancellationToken) >= 100) return Results.StatusCode(507);
        await _db.Shares.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        if (await _db.StorageBytes(cancellationToken) + 1024 + snapshot.Length * 2L > _storage.MaxBytes) return Results.StatusCode(507);
        var (room, pin, token) = RoomFactory.Create(input.PlayerCount, snapshot, input.HandKey, now);
        var id = room.Id;
        _db.Rooms.Add(room);
        if (input.HostSeat is { } reservedSeat)
            _db.Seats.Add(new Seat { RoomId = id, Number = reservedSeat, TokenHash = room.HostHash });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new
        {
            id,
            pin,
            token,
            seat = input.HostSeat,
            host = true,
            room = new { id, room.PlayerCount, room.Revision, seats = input.HostSeat.HasValue ? new[] { input.HostSeat.Value } : Array.Empty<int>(), expiresAt = DateTimeOffset.FromUnixTimeSeconds(room.ExpiresAt) },
            game = new { room.Revision, room.HandKey, match = JsonSerializer.Deserialize<JsonElement>(snapshot), actions = Array.Empty<object>() }
        });
    }
}
