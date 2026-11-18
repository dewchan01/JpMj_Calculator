using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Games.SubmitAction;

/// <summary>HTTP endpoint that queues an authenticated, deduplicated player declaration.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPost(
            "/actions",
            (
                string id,
                Body input,
                HttpRequest request,
                ICommandHandler<Request> handler,
                CancellationToken cancellationToken
            ) =>
                handler.HandleAsync(
                    new Request(id, input, Secrets.Bearer(request)),
                    cancellationToken
                )
        );
}
