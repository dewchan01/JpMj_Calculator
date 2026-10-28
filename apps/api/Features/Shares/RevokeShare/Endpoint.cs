using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Shares.RevokeShare;

/// <summary>HTTP endpoint that revokes an archive after verifying its independent deletion credential.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapDelete("/{id}", (string id, HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, request.Headers["X-Deletion-Secret"].ToString()), cancellationToken));
}
