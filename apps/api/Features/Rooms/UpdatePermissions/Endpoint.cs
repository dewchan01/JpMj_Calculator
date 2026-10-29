using Riichi.Api.Infrastructure.Security;
using Riichi.Api.Shared.Handlers;

namespace Riichi.Api.Features.Rooms.UpdatePermissions;

/// <summary>Maps host-only updates to room capabilities.</summary>
public static class Endpoint
{
    /// <summary>Maps the permissions route.</summary>
    /// <param name="routes">The room route group.</param>
    public static void Map(RouteGroupBuilder routes) => routes.MapPut("/{id}/permissions",
        (string id, RoomPermissions input, HttpRequest request, ICommandHandler<Request> handler, CancellationToken ct) =>
            handler.HandleAsync(new Request(id, input, Secrets.Bearer(request)), ct));
}
