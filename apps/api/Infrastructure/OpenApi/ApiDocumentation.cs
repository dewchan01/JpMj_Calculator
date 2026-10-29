using Microsoft.OpenApi;

namespace Riichi.Api.Infrastructure.OpenApi;

/// <summary>Provides versioned OpenAPI and a development-only Swagger UI.</summary>
public static class ApiDocumentation
{
    /// <summary>Registers the API contract and its authentication schemes.</summary>
    /// <param name="services">The application services.</param>
    public static void AddApiDocumentation(this IServiceCollection services)
    {
        services.AddOpenApi("v1", options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info = new OpenApiInfo
            {
                Title = "Riichi / table API",
                Version = "v1",
                Description = "Room credentials, versioned game synchronization and 24-hour archive transfers. The host browser calculates scores; the API persists and authorizes changes."
            };
            document.Components ??= new OpenApiComponents();
            document.Components.SecuritySchemes = new Dictionary<string, IOpenApiSecurityScheme>
            {
                ["Bearer"] = new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", Description = "Host or occupied-seat token returned when creating or joining a room." },
                ["DeletionSecret"] = new OpenApiSecurityScheme { Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Header, Name = "X-Deletion-Secret", Description = "Independent revocation credential returned when creating an archive share." }
            };
            foreach (var (path, item) in document.Paths)
            {
                if (item.Operations is null) continue;
                foreach (var (method, operation) in item.Operations)
                {
                    var verb = method.ToString().ToUpperInvariant();
                    var scheme = path.StartsWith("/api/rooms/") && !path.EndsWith("/join") ? "Bearer"
                        : path.StartsWith("/api/shares/") && verb == "DELETE" ? "DeletionSecret" : null;
                    if (scheme is not null)
                        operation.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference(scheme, document)] = [] }];
                    operation.Responses ??= new OpenApiResponses();
                    if (verb == "DELETE" || (verb == "PUT" && path.EndsWith("/permissions")))
                    {
                        operation.Responses.Remove("200");
                        operation.Responses["204"] = new OpenApiResponse { Description = "Operation completed without a response body." };
                    }
                    if (verb == "GET" && path.EndsWith("/game"))
                        operation.Responses.TryAdd("204", new OpenApiResponse { Description = "The requested revision is current; no game payload is returned." });
                    if (verb is "POST" or "PUT")
                        operation.Responses.TryAdd("400", new OpenApiResponse { Description = "Invalid request input." });
                    if (path.EndsWith("/join"))
                        operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Unknown or expired room, or incorrect passcode." });
                    if (path.Contains("/game") || path.EndsWith("/join") || path.EndsWith("/permissions"))
                        operation.Responses.TryAdd("409", new OpenApiResponse { Description = "Revision conflict, stale hand or occupied seat. Refresh state before retrying." });
                    if (path == "/api/shares" && verb == "POST")
                    {
                        operation.Responses.TryAdd("413", new OpenApiResponse { Description = "Archive exceeds the configured upload limit." });
                        operation.Responses.TryAdd("507", new OpenApiResponse { Description = "The shared storage quota has been reached." });
                    }
                    operation.Responses.TryAdd("429", new OpenApiResponse { Description = "Request rate limit reached." });
                    if (scheme is not null) operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Missing, expired or incorrect credential." });
                    if (path.Contains("/game") || path.EndsWith("/permissions"))
                        operation.Responses.TryAdd("403", new OpenApiResponse { Description = "The host has not granted the requested capability." });
                    if (path == "/api/shares" && verb == "POST")
                        operation.RequestBody = new OpenApiRequestBody
                        {
                            Required = true,
                            Description = "Internal riichi-table v1 archive JSON. Maximum 5 MiB, 1–500 matches; expires after 24 hours.",
                            Content = new Dictionary<string, OpenApiMediaType> { ["application/json"] = new() { Schema = new OpenApiSchema { Type = JsonSchemaType.Object } } }
                        };
                }
            }
            return Task.CompletedTask;
        }));
    }

    /// <summary>Enables local documentation without exposing it on the production host.</summary>
    /// <param name="app">The application pipeline.</param>
    public static void MapApiDocumentation(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing")) return;
        app.MapOpenApi().ExcludeFromDescription();
        app.UseSwaggerUI(options => { options.SwaggerEndpoint("/openapi/v1.json", "Riichi / table v1"); options.DocumentTitle = "Riichi API v1"; });
    }
}
