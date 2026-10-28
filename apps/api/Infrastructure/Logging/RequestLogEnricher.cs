using System.Diagnostics;
using Microsoft.AspNetCore.Routing;
using Serilog.Core;
using Serilog.Events;

namespace Riichi.Api.Infrastructure.Logging;

/// <summary>Attaches correlation and route templates while removing sensitive request fields.</summary>
/// <param name="accessor">The current HTTP context accessor.</param>
public sealed class RequestLogEnricher(IHttpContextAccessor accessor) : ILogEventEnricher
{
    private readonly IHttpContextAccessor _accessor = accessor ?? throw new ArgumentNullException(nameof(accessor));

    /// <inheritdoc />
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var context = _accessor.HttpContext;
        if (context is null) return;
        // Share IDs grant access to data. Never retain concrete paths or query strings,
        // including RequestPath added by the framework's ILogger scopes.
        var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "/unmatched";
        logEvent.AddOrUpdateProperty(propertyFactory.CreateProperty("RequestPath", route));
        logEvent.AddOrUpdateProperty(propertyFactory.CreateProperty("RequestId", context.TraceIdentifier));
        if (Activity.Current is { } activity)
            logEvent.AddOrUpdateProperty(propertyFactory.CreateProperty("TraceId", activity.TraceId.ToString()));
        foreach (var name in new[] { "QueryString", "RequestQueryString", "RequestQuery", "RequestBody", "RequestHeaders", "Authorization", "Cookie" })
            logEvent.RemovePropertyIfPresent(name);
    }
}
