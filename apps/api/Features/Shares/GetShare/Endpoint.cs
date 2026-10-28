using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Shares.GetShare;

/// <summary>HTTP endpoint that downloads an unexpired internal archive.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapGet("/{id}", (string id, IQueryHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id), cancellationToken));
}
