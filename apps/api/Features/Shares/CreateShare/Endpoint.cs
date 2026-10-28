using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Shares.CreateShare;

/// <summary>HTTP endpoint that validates and stores an expiring archive within the storage quota.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPost("", (HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(request.Body), cancellationToken));
}
