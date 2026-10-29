using Riichi.Api.Shared.Handlers;
using Riichi.Api.Features.Rooms;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Features;

/// <summary>Registers and maps the application feature slices.</summary>
public static class FeatureRegistration
{
    /// <summary>Registers scoped operation handlers.</summary>
    /// <param name="services">The services value.</param>
    /// <returns>The service collection.</returns>
    public static IServiceCollection AddFeatures(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddScoped<IRoomAccess, RoomAccess>();
        services.AddSingleton<RoomPresence>();
        services.AddScoped<ICommandHandler<Rooms.UpdatePermissions.Request>, Rooms.UpdatePermissions.Handler>();
        services.AddScoped<ICommandHandler<Rooms.CreateRoom.Request>, Rooms.CreateRoom.Handler>();
        services.AddScoped<ICommandHandler<Rooms.JoinRoom.Request>, Rooms.JoinRoom.Handler>();
        services.AddScoped<IQueryHandler<Rooms.GetRoom.Request>, Rooms.GetRoom.Handler>();
        services.AddScoped<ICommandHandler<Rooms.ReleaseSeat.Request>, Rooms.ReleaseSeat.Handler>();
        services.AddScoped<ICommandHandler<Rooms.CloseRoom.Request>, Rooms.CloseRoom.Handler>();
        services.AddScoped<IQueryHandler<Games.GetGame.Request>, Games.GetGame.Handler>();
        services.AddScoped<ICommandHandler<Games.SubmitAction.Request>, Games.SubmitAction.Handler>();
        services.AddScoped<ICommandHandler<Games.CommitGame.Request>, Games.CommitGame.Handler>();
        services.AddScoped<ICommandHandler<Shares.CreateShare.Request>, Shares.CreateShare.Handler>();
        services.AddScoped<IQueryHandler<Shares.GetShare.Request>, Shares.GetShare.Handler>();
        services.AddScoped<ICommandHandler<Shares.RevokeShare.Request>, Shares.RevokeShare.Handler>();
        return services;
    }

    /// <summary>Maps feature routes without changing public contracts.</summary>
    /// <param name="app">The app value.</param>
    public static void MapFeatures(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        var rooms = app.MapGroup("/api/rooms").RequireRateLimiting("api");
        var games = app.MapGroup("/api/rooms/{id}/game").RequireRateLimiting("api");
        var shares = app.MapGroup("/api/shares").RequireRateLimiting("api");
        Rooms.CreateRoom.Endpoint.Map(rooms);
        Rooms.JoinRoom.Endpoint.Map(rooms);
        Rooms.GetRoom.Endpoint.Map(rooms);
        Rooms.ReleaseSeat.Endpoint.Map(rooms);
        Rooms.CloseRoom.Endpoint.Map(rooms);
        Rooms.UpdatePermissions.Endpoint.Map(rooms);
        Games.GetGame.Endpoint.Map(games);
        Games.SubmitAction.Endpoint.Map(games);
        Games.CommitGame.Endpoint.Map(games);
        Shares.CreateShare.Endpoint.Map(shares);
        Shares.GetShare.Endpoint.Map(shares);
        Shares.RevokeShare.Endpoint.Map(shares);
        Health.GetHealth.Endpoint.Map(app.MapGroup("/api"));
        app.MapHub<RoomHub>("/hubs/rooms").RequireRateLimiting("api");
    }
}
