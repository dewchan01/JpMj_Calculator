using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.JoinRoom;

/// <summary>HTTP endpoint that claims a free or requested seat after passcode verification.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPost("/{id}/join", (string id, Body input, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, input), cancellationToken)).RequireRateLimiting("join");
}
