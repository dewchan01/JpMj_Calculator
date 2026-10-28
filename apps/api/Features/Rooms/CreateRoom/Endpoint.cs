using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.CreateRoom;

/// <summary>HTTP endpoint that creates a room and optionally attaches its initial game atomically.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPost("", (Request input, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(input, cancellationToken)).RequireRateLimiting("join");
}
