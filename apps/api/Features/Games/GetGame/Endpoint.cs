using Riichi.Api.Shared.Handlers;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Games.GetGame;

/// <summary>HTTP endpoint that reads the versioned game and declarations visible to the caller.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapGet("", (string id, long? revision, HttpRequest request, IQueryHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, revision, Secrets.Bearer(request)), cancellationToken));
}
