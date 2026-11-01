using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;

namespace Riichi.Api.Features.Rooms.Lifecycle;

/// <summary>Checks ownership after disconnects without treating short reconnects as departures.</summary>
public sealed class RoomLifecycleWorker(IServiceScopeFactory scopes, ILogger<RoomLifecycleWorker> log) : BackgroundService
{
    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDb>();
                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var ids = await db.Rooms.Where(x => !x.Closed && x.ExpiresAt > now).Select(x => x.Id).ToArrayAsync(stoppingToken);
                foreach (var id in ids)
                {
                    // A failed room must not prevent unrelated rooms from handing over ownership.
                    using var roomScope = scopes.CreateScope();
                    try { await roomScope.ServiceProvider.GetRequiredService<RoomLifecycle>().Check(id, now, stoppingToken); }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                    catch (Exception error) { log.LogWarning(error, "Ownership check for room {RoomId} will retry.", id); }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception error) { log.LogWarning(error, "Room ownership check will retry."); }
        }
    }
}
