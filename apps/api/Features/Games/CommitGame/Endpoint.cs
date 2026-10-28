using Riichi.Api.Shared.Handlers;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Games.CommitGame;

/// <summary>HTTP endpoint that commits the host snapshot and declaration decisions under a revision check.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPut("", (string id, Body input, HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, input, Secrets.Bearer(request)), cancellationToken));
}
