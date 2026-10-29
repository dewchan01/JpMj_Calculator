using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Riichi.Api.Features;
using Riichi.Api.Infrastructure;
using Riichi.Api.Infrastructure.Logging;
using Riichi.Api.Infrastructure.Persistence;
using Riichi.Api.Infrastructure.OpenApi;

var builder = WebApplication.CreateBuilder(args);
builder.AddApiServices();
var app = builder.Build();
app.UseApiRequestLogging();
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
app.MapFeatures();
app.MapApiDocumentation();
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
    await DevelopmentDatabase.InitializeAsync(scope.ServiceProvider.GetRequiredService<AppDb>());
}
app.Run();
/// <summary>The API entry point, exposed for integration testing.</summary>
public partial class Program { }
