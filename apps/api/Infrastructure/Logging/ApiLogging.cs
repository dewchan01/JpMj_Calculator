using Microsoft.Extensions.Options;
using Riichi.Api.Infrastructure.Configuration;
using Riichi.Api.Resources;
using Serilog;
using Serilog.Core;
using Serilog.Events;

namespace Riichi.Api.Infrastructure.Logging;

/// <summary>Configures structured request logging and optional Seq delivery.</summary>
public static class ApiLogging
{
    /// <summary>Registers the application logger and safe request enrichment.</summary>
    /// <param name="builder">The application builder.</param>
    public static void AddApiLogging(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.Logging.ClearProviders();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddSingleton<ILogEventEnricher, RequestLogEnricher>();
        builder.Services.AddSerilog((services, logger) =>
        {
            logger.ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(services)
                .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
                .Enrich.WithProperty("Instance", Environment.MachineName);

            var seq = services.GetRequiredService<IOptions<SeqOptions>>().Value;
            var serverUrl = seq.ServerUrl;
            if (string.IsNullOrWhiteSpace(serverUrl)) return;
            if (!Uri.TryCreate(serverUrl, UriKind.Absolute, out var uri) ||
                uri.Scheme is not ("http" or "https") || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0)
                throw new InvalidOperationException(ErrorMessages.Get("InvalidSeqUrl"));
            logger.WriteTo.Seq(uri.AbsoluteUri, apiKey: seq.ApiKey,
                restrictedToMinimumLevel: LogEventLevel.Information, queueSizeLimit: seq.QueueSizeLimit,
                eventBodyLimitBytes: seq.EventBodyLimitBytes);
        }, preserveStaticLogger: true);
    }

    /// <summary>Logs request completion using sanitized route templates.</summary>
    /// <param name="app">The application pipeline.</param>
    public static void UseApiRequestLogging(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.UseSerilogRequestLogging(options =>
        {
            // Resolve the application's logger rather than using a shared static logger.
            options.Logger = app.Services.GetRequiredService<Serilog.ILogger>();
            options.IncludeQueryInRequestPath = false;
            options.MessageTemplate = LogMessages.Get("RequestCompleted");
            options.GetLevel = (context, _, exception) =>
                exception is not null || context.Response.StatusCode >= 500 ? LogEventLevel.Error :
                context.Response.StatusCode >= 400 ? LogEventLevel.Warning :
                context.Request.Path == "/api/health" ? LogEventLevel.Debug : LogEventLevel.Information;
        });
    }
}
