using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Rooms;
using Riichi.Api.Sharing;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 6 * 1024 * 1024);
builder.Services.AddDbContext<AppDb>(options =>
{
    var connection = builder.Configuration.GetConnectionString("Database");
    if (!string.IsNullOrWhiteSpace(connection)) options.UseSqlServer(connection);
    else if (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"))
    {
        var directory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(directory);
        options.UseSqlite($"Data Source={Path.Combine(directory, "riichi.db")}");
    }
    else throw new InvalidOperationException("Configure ConnectionStrings__Database before starting production.");
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
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
var app = builder.Build();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    await next();
});
app.UseCors();
app.UseRateLimiter();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapShares();
app.MapRooms();
app.MapRoomGames();
app.MapHub<RoomHub>("/hubs/rooms").RequireRateLimiting("api");
// Production migrations are an explicit deployment step, never automatic startup.
if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    await db.Database.MigrateAsync();
    return;
}
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDb>().Database.EnsureCreatedAsync();
}
app.Run();
public partial class Program { }
