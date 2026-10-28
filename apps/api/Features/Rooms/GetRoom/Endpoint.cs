using Riichi.Api.Shared.Handlers;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.GetRoom;

/// <summary>HTTP endpoint that reads the lobby after verifying current room membership.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapGet("/{id}", (string id, HttpRequest request, IQueryHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, Secrets.Bearer(request)), cancellationToken));
}
