using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Shares.GetShare;

/// <summary>Downloads an unexpired internal archive.</summary>
/// <param name="db">The scoped database context.</param>
public sealed class Handler(AppDb db) : QueryHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var share = await _db.Shares.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, cancellationToken);
        return share is null ? Results.NotFound() : Results.File(share.Content, "application/json", "riichi-games.json");
    }
}
