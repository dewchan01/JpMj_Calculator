namespace Riichi.Api.Features.Health.GetHealth;

/// <summary>Provides the lightweight process health endpoint.</summary>
public static class Endpoint
{
    /// <summary>Maps process health without accessing the database.</summary>
    /// <param name="routes">The API route group.</param>
    public static void Map(RouteGroupBuilder routes) => routes.MapGet("/health", () => Results.Ok(new { status = "ok" }));
}
