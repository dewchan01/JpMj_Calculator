using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Shares.RevokeShare;

/// <summary>Revokes an archive after verifying its independent deletion credential.</summary>
/// <param name="db">The scoped database context.</param>
public sealed class Handler(AppDb db) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {
        var id = command.Id;
        var share = await _db.Shares.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (share is null) return Results.NoContent();
        if (!Secrets.Matches(command.DeletionSecret, share.DeleteHash)) return Results.Unauthorized();
        await _db.Shares.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);
        return Results.NoContent();
    }
}
