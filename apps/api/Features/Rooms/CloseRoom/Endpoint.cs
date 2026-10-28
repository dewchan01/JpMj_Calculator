using Riichi.Api.Shared.Handlers;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.CloseRoom;

/// <summary>HTTP endpoint that closes a room after verifying host credentials.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapDelete("/{id}", (string id, HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, Secrets.Bearer(request)), cancellationToken));
}
