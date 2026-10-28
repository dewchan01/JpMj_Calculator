using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Riichi.Api.Data;
using Serilog.Core;
using Serilog.Events;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class LoggingTests
{
    private sealed class CaptureSink : ILogEventSink
    {
        public readonly ConcurrentQueue<LogEvent> Events = new();
        public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
    }

    [TestMethod]
    public async Task RequestEventsContainSafeRoutesAndCorrelationWithoutCredentialsOrBodies()
    {
        var sink = new CaptureSink();
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<ILogEventSink>(sink)));
        using var client = app.CreateClient();
        const string pin = "private-query-passcode", token = "private-auth-token", body = "private-player-data";
        var id = new string('a', 64);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await client.GetAsync($"/api/shares/{id}?pin={pin}");
        await client.PostAsJsonAsync("/api/shares", new { format = "riichi-table", version = 1, matches = new[] { new { id = body } } });
        await client.GetAsync("/api/health");
        var requests = sink.Events.Where(e => e.MessageTemplate.Text.StartsWith("HTTP ")).ToArray();
        (requests.Length).Should().Be(2);
        var missing = (requests).Should().ContainSingle(e => e.Level == LogEventLevel.Warning).Which;
        (missing.Properties["RequestPath"].ToString()).Should().Contain("{id}");
        (missing.Properties["StatusCode"].ToString()).Should().Be("404");
        (requests).Should().AllSatisfy(e =>
        {
            (e.Properties["Application"].ToString()).Should().Be("\"Riichi.Api\"");
            (e.Properties["Environment"].ToString()).Should().Be("\"Testing\"");
            (e.Properties.ContainsKey("RequestId")).Should().BeTrue();
            (e.Properties.ContainsKey("TraceId")).Should().BeTrue();
            (e.Properties.ContainsKey("Elapsed")).Should().BeTrue();
        });
        foreach (var logged in sink.Events)
        {
            var text = logged.RenderMessage() + string.Join(" ", logged.Properties.Select(p => p.Value.ToString()));
            (text).Should().NotContain(id);
            (text).Should().NotContain(pin);
            (text).Should().NotContain(token);
            (text).Should().NotContain(body);
        }
    }

    [TestMethod]
    public async Task ServerErrorsAreLoggedAtErrorLevel()
    {
        var sink = new CaptureSink();
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.ConfigureServices(services =>
            {
                services.AddSingleton<ILogEventSink>(sink);
                services.AddScoped<AppDb>(_ => throw new InvalidOperationException("Test database unavailable"));
            });
        });
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        ((await client.GetAsync("/api/shares/" + new string('a', 64))).StatusCode).Should().Be(HttpStatusCode.InternalServerError);
        (sink.Events).Should().Contain(e => e.MessageTemplate.Text.StartsWith("HTTP ") && e.Level == LogEventLevel.Error && e.Properties["StatusCode"].ToString() == "500");
    }

    [TestMethod]
    [DataRow("not-a-url")]
    [DataRow("https://user:password@seq.example.test")]
    [DataRow("https://seq.example.test/?apiKey=secret")]
    public void InvalidSeqDestinationsFailConfigurationWithoutEchoingSecrets(string serverUrl)
    {
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Seq:ServerUrl"] = serverUrl })));
        var error = FluentActions.Invoking(() => app.CreateClient()).Should().Throw<Exception>().Which;
        (error.ToString()).Should().Contain("Seq:ServerUrl");
        (error.ToString()).Should().NotContain(serverUrl);
    }
}
