using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Riichi.Api.Data;
using Riichi.Api.Features;
using Riichi.Api.Infrastructure.Configuration;
using Riichi.Api.Infrastructure.Logging;
using Riichi.Api.Resources;
namespace Riichi.Api.Infrastructure;
/// <summary>Configures application services and hosting infrastructure.</summary>
public static class ApiServices
{
    /// <summary>Registers typed configuration, persistence, logging and feature handlers.</summary>
    /// <param name="builder">The application builder.</param>
    public static void AddApiServices(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.Services.AddOptions<StorageOptions>().BindConfiguration("Storage").ValidateDataAnnotations().ValidateOnStart();
        builder.Services.AddOptions<CorsOptions>().BindConfiguration("Cors").ValidateDataAnnotations().ValidateOnStart();
        builder.Services.AddOptions<DatabaseOptions>().BindConfiguration("ConnectionStrings");
        builder.Services.AddOptions<SeqOptions>().BindConfiguration("Seq").ValidateDataAnnotations().ValidateOnStart();
        builder.AddApiLogging();
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 6 * 1024 * 1024);
        builder.Services.AddDbContext<AppDb>((services, options) =>
        {
            var connection = services.GetRequiredService<IOptions<DatabaseOptions>>().Value.Database;
            if (!string.IsNullOrWhiteSpace(connection)) options.UseSqlServer(connection);
            else if (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"))
            {
                var directory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
                Directory.CreateDirectory(directory);
                options.UseSqlite($"Data Source={Path.Combine(directory, "riichi.db")}");
            }
            else throw new InvalidOperationException(ErrorMessages.Get("DatabaseRequired"));
        });
        builder.Services.AddCors();
        builder.Services.AddOptions<Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions>()
            .Configure<IOptions<CorsOptions>>((options, cors) => options.AddDefaultPolicy(policy => policy
                .WithOrigins(cors.Value.AllowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
        builder.Services.AddSignalR(options => { options.MaximumReceiveMessageSize = 4096; options.EnableDetailedErrors = false; });
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = 429;
            foreach (var (name, limit) in new[] { ("api", 120), ("join", 10) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        builder.Services.AddProblemDetails();

        builder.Services.AddFeatures();
    }
}
