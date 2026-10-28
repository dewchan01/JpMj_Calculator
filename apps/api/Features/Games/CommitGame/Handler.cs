using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Configuration;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Resources;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features.Games.CommitGame;

/// <summary>Commits the host snapshot and declaration decisions under a revision check.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="hub">The room notification hub.</param>
/// <param name="storage">The validated storage limits.</param>
public sealed class Handler(AppDb db, IHubContext<RoomHub> hub, IOptions<StorageOptions> storage) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly IHubContext<RoomHub> _hub = hub ?? throw new ArgumentNullException(nameof(hub));
    private readonly StorageOptions _storage = storage?.Value ?? throw new ArgumentNullException(nameof(storage));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var input = command.Input;
        if (input.HandKey is null || input.HandKey.Length is < 1 or > 256 || input.Decisions is null || input.Decisions.Length > 64 ||
            input.Match.ValueKind != JsonValueKind.Object || input.Match.GetRawText().Length > 5 * 1024 * 1024 ||
            !input.Match.TryGetProperty("playerCount", out var count) || count.ValueKind != JsonValueKind.Number || !count.TryGetInt32(out var playerCount) ||
            !input.Match.TryGetProperty("players", out var players) || players.ValueKind != JsonValueKind.Array || players.GetArrayLength() != playerCount)
            return Results.BadRequest();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        if (!Secrets.Matches(command.Token, room.HostHash)) return Results.Unauthorized();
        if (room.Revision != input.Revision) return Results.Conflict(new { error = ErrorMessages.Get("RoomChanged") });
        if (room.PlayerCount != playerCount) return Results.BadRequest();
        if (await _db.StorageBytes(cancellationToken) + (input.Match.GetRawText().Length - room.Snapshot.Length) * 2L > _storage.MaxBytes) return Results.StatusCode(507);
        // Once attached, replacing the game or reassigning player identities requires a new room.
        if (room.HandKey.Length > 0)
        {
            using var previous = JsonDocument.Parse(room.Snapshot);
            if (!input.Match.TryGetProperty("id", out var matchId) ||
                previous.RootElement.GetProperty("id").GetString() != matchId.GetString() ||
                !previous.RootElement.GetProperty("players").EnumerateArray().Select(x => x.GetProperty("id").GetString())
                    .SequenceEqual(players.EnumerateArray().Select(x => x.GetProperty("id").GetString()))) return Results.BadRequest();
        }
        var pending = await _db.Actions.Where(x => x.RoomId == id && x.Status == "pending").ToArrayAsync(cancellationToken);
        foreach (var decision in input.Decisions)
        {
            var action = pending.SingleOrDefault(x => x.Id == decision.Id);
            if (action is null || decision.Error is null || decision.Error.Length > 1000) return Results.BadRequest();
            action.Status = decision.Error.Length == 0 ? "accepted" : "rejected";
            action.Error = decision.Error;
        }
        foreach (var action in pending.Where(x => x.Status == "pending" && x.HandKey != input.HandKey))
        {
            action.Status = "rejected";
            action.Error = ErrorMessages.Get("HandChanged");
        }
        room.Snapshot = input.Match.GetRawText();
        room.HandKey = input.HandKey;
        room.Revision++;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await _hub.Clients.Group(id).SendAsync("Changed");
        return Results.Ok(new { room.Revision });
    }
}
