using Riichi.Api.Shared.Handlers;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.ReleaseSeat;

/// <summary>HTTP endpoint that revokes a seat and rejects its outstanding declarations.</summary>
public static class Endpoint
{
    /// <summary>Maps the existing HTTP route.</summary>
    /// <param name="routes">The route group for this feature.</param>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapDelete("/{id}/seats/{seat:int}", (string id, int seat, HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, seat, Secrets.Bearer(request)), cancellationToken));
}
