using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Configuration;
using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;
using Riichi.Api.Resources;

namespace Riichi.Api.Features.Shares.CreateShare;

/// <summary>Validates and stores an expiring archive within the storage quota.</summary>
/// <param name="db">The scoped database context.</param>
/// <param name="storage">The validated storage limits.</param>
public sealed class Handler(AppDb db, IOptions<StorageOptions> storage) : CommandHandler<Request>
{
    private readonly AppDb _db = db ?? throw new ArgumentNullException(nameof(db));
    private readonly StorageOptions _storage = storage?.Value ?? throw new ArgumentNullException(nameof(storage));

    /// <inheritdoc />
    protected override async Task<IResult> ExecuteAsync(Request command, CancellationToken cancellationToken)
    {

        var max = _storage.MaxArchiveBytes;
        using var buffer = new MemoryStream();
        var bytes = new byte[8192];
        int count;
        while ((count = await command.Content.ReadAsync(bytes, cancellationToken)) > 0)
        {
            if (buffer.Length + count > max) return Results.StatusCode(413);
            buffer.Write(bytes, 0, count);
        }
        var content = buffer.ToArray();
        try
        {
            using var document = JsonDocument.Parse(content, new JsonDocumentOptions { MaxDepth = 64 });
            if (!ArchiveValidator.IsValid(document.RootElement)) return Results.BadRequest(new { error = ErrorMessages.Get("InvalidArchive") });
        }
        catch (JsonException) { return Results.BadRequest(new { error = ErrorMessages.Get("InvalidArchive") }); }
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        // Serializable quota check prevents simultaneous uploads bypassing the global limit.
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        await _db.Shares.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        await _db.Rooms.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        var used = await _db.StorageBytes(cancellationToken);
        if (used + content.Length > _storage.MaxBytes)
            return Results.StatusCode(507);
        var deletionSecret = Secrets.Create();
        var share = new SharedArchive
        {
            Id = Secrets.Create(),
            Content = content,
            Size = content.Length,
            DeleteHash = Secrets.Hash(deletionSecret),
            ExpiresAt = now + 86400
        };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { share.Id, deletionSecret, expiresAt = DateTimeOffset.FromUnixTimeSeconds(share.ExpiresAt) });
    }
}
