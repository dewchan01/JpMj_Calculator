using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.Lifecycle;

/// <summary>Room departure, host transfer and re-entry decisions.</summary>
public static class Endpoint
{
    /// <summary>The requested new host seat.</summary>
    public sealed record TransferBody(int Seat);
    /// <summary>The host's re-entry decision.</summary>
    public sealed record DecisionBody(bool Accept);
    /// <summary>Maps authenticated lifecycle operations.</summary>
    public static void Map(RouteGroupBuilder rooms)
    {
        rooms.MapPost("/{id}/leave", (string id, HttpRequest request, RoomLifecycle lifecycle, CancellationToken ct) => lifecycle.Leave(id, Secrets.Bearer(request), ct));
        rooms.MapPost("/{id}/host", (string id, TransferBody body, HttpRequest request, RoomLifecycle lifecycle, CancellationToken ct) => lifecycle.Transfer(id, Secrets.Bearer(request), body.Seat, ct));
        rooms.MapPost("/{id}/assignments/{memberId}", (string id, string memberId, DecisionBody body, HttpRequest request, RoomLifecycle lifecycle, CancellationToken ct) => lifecycle.Decide(id, Secrets.Bearer(request), memberId, body.Accept, ct));
    }
}
