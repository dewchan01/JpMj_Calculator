using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class ApiDocumentationTests
{
    [TestMethod]
    public async Task DevelopmentDocsDescribeRoomAuthAndArchiveRevocation()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var document = await client.GetFromJsonAsync<JsonElement>("/openapi/v1.json");
        document.GetProperty("info").GetProperty("version").GetString().Should().Be("v1");
        var paths = document.GetProperty("paths");
        paths.GetProperty("/api/rooms").GetProperty("post").GetProperty("requestBody").ValueKind.Should().Be(JsonValueKind.Object);
        paths.GetProperty("/api/rooms/{id}/game").GetProperty("put").GetProperty("security")[0].TryGetProperty("Bearer", out _).Should().BeTrue();
        paths.GetProperty("/api/shares/{id}").GetProperty("delete").GetProperty("security")[0].TryGetProperty("DeletionSecret", out _).Should().BeTrue();
        (await client.GetAsync("/swagger/index.html")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task ProductionDoesNotExposeDocs()
    {
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        (await client.GetAsync("/openapi/v1.json")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync("/swagger/index.html")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
