using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Riichi.Api.Data;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class ShareTests
{
    [TestMethod]
    public async Task SharingRoundTripDeleteAndExpiration()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var archive = new { format = "riichi-table", version = 1, matches = new[] { new { id = "example" } } };
        var created = await Json(await client.PostAsJsonAsync("/api/shares", archive));
        var path = "/api/shares/" + created.GetProperty("id").GetString();
        var download = await client.GetAsync(path);
        (download.StatusCode).Should().Be(HttpStatusCode.OK);
        (download.Content.Headers.ContentDisposition?.DispositionType).Should().Be("attachment");
        (download.Headers.GetValues("X-Content-Type-Options").Single()).Should().Be("nosniff");
        ((await client.DeleteAsync(path)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        client.DefaultRequestHeaders.Add("X-Deletion-Secret", created.GetProperty("deletionSecret").GetString());
        ((await client.DeleteAsync(path)).StatusCode).Should().Be(HttpStatusCode.NoContent);
        ((await client.GetAsync(path)).StatusCode).Should().Be(HttpStatusCode.NotFound);
        ((await client.PostAsJsonAsync("/api/shares", new { arbitrary = true })).StatusCode).Should().Be(HttpStatusCode.BadRequest);
        created = await Json(await client.PostAsJsonAsync("/api/shares", archive));
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Shares.ExecuteUpdateAsync(set => set.SetProperty(x => x.ExpiresAt, 0));
        }
        ((await client.GetAsync("/api/shares/" + created.GetProperty("id").GetString())).StatusCode).Should().Be(HttpStatusCode.NotFound);
    }


    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
