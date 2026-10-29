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

namespace Riichi.Api.Features.Games.SubmitAction;

/// <summary>Queues an authenticated, deduplicated player declaration.</summary>
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
        if (input.Id is null || !Guid.TryParse(input.Id, out _) || input.HandKey is null || input.HandKey.Length > 256 ||
            input.Kind is not ("riichi" or "cancelRiichi" or "call" or "win") || input.Payload.ValueKind != JsonValueKind.Object || input.Payload.GetRawText().Length > 32768)
            return Results.BadRequest();
        input = input with { Id = Guid.Parse(input.Id).ToString() };
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var room = await _db.Rooms.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        if (room is null) return Results.NotFound();
        var hash = Secrets.Hash(command.Token);
        var seat = await _db.Seats.SingleOrDefaultAsync(x => x.RoomId == id && x.TokenHash == hash, cancellationToken);
        var host = Secrets.Matches(command.Token, room.HostHash);
        var permissions = DelegatedChanges.Permissions(room.Permissions);
        if (!host && !(input.Kind switch
        {
            "riichi" or "cancelRiichi" => permissions.Riichi,
            "call" => permissions.Calls,
            "win" => permissions.Win,
            _ => false
        })) return Results.StatusCode(403);
        var actorSeat = host ? input.Seat : seat?.Number;
        if (actorSeat is null || actorSeat < 0 || actorSeat >= room.PlayerCount) return Results.Unauthorized();
        var duplicate = await _db.Actions.SingleOrDefaultAsync(x => x.RoomId == id && x.Id == input.Id, cancellationToken);
        if (duplicate is not null)
            return duplicate.ActorHash == hash ? Results.Ok(new { duplicate.Id, duplicate.Status, duplicate.Error }) : Results.Conflict();
        if (room.HandKey.Length == 0 || input.HandKey != room.HandKey) return Results.Conflict(new { error = ErrorMessages.Get("HandChanged") });
        if (await _db.Actions.CountAsync(x => x.RoomId == id, cancellationToken) >= 512 ||
            await _db.Actions.CountAsync(x => x.RoomId == id && x.ActorHash == hash && x.Status == "pending", cancellationToken) >= 8) return Results.StatusCode(429);
        if (await _db.StorageBytes(cancellationToken) + input.Payload.GetRawText().Length * 2L + 1024 > _storage.MaxBytes) return Results.StatusCode(507);
        _db.Actions.Add(new RoomAction
        {
            RoomId = id,
            Id = input.Id,
            Seat = actorSeat.Value,
            ActorHash = hash,
            HandKey = input.HandKey,
            Kind = input.Kind,
            Payload = input.Payload.GetRawText(),
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        room.Revision++;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await _hub.Clients.Group(id).SendAsync("Changed");
        return Results.Ok(new { input.Id, status = "pending", error = "" });
    }
}
