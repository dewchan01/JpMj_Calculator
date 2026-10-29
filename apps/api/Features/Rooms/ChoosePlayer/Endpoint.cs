using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.ChoosePlayer;

/// <summary>Maps authenticated player selection before the game starts.</summary>
public static class Endpoint
{
    /// <summary>Maps the lobby player endpoint.</summary>
    public static void Map(RouteGroupBuilder routes) =>
        routes.MapPut("/{id}/player", (string id, Body input, HttpRequest request, ICommandHandler<Request> handler, CancellationToken cancellationToken) =>
            handler.HandleAsync(new Request(id, input.Seat, Secrets.Bearer(request)), cancellationToken));
}
