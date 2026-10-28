using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Xunit;

namespace Riichi.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string database = Path.Combine(Path.GetTempPath(), $"riichi-test-{Guid.NewGuid()}.db");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDb>>();
            services.RemoveAll<Microsoft.EntityFrameworkCore.Infrastructure.IDbContextOptionsConfiguration<AppDb>>();
            services.AddDbContext<AppDb>(options => options.UseSqlite($"Data Source={database}"));
        });
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(database + suffix)) File.Delete(database + suffix);
    }
}

public sealed class AccessTests
{
    [Fact]
    public async Task JoinWithoutSeatAssignsFreeSeatsAndRejectsFullRoom()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var input = new { pin = room.GetProperty("pin").GetString() };
        for (var seat = 0; seat < 3; seat++)
        {
            var joined = await Json(await client.PostAsJsonAsync(path, input));
            Assert.Equal(seat, joined.GetProperty("seat").GetInt32());
        }
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(path, input)).StatusCode);
    }
    [Fact]
    public async Task ConcurrentSeatClaimHasExactlyOneWinner()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var input = new { pin = room.GetProperty("pin").GetString(), seat = 1 };
        var results = await Task.WhenAll(client.PostAsJsonAsync(path, input), client.PostAsJsonAsync(path, input));
        Assert.Single(results, result => result.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, result => result.StatusCode == HttpStatusCode.Conflict);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task SharingRoundTripDeleteAndExpiration()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var archive = new { format = "riichi-table", version = 1, matches = new[] { new { id = "example" } } };
        var created = await Json(await client.PostAsJsonAsync("/api/shares", archive));
        var path = "/api/shares/" + created.GetProperty("id").GetString();
        var download = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("attachment", download.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", download.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync(path)).StatusCode);
        client.DefaultRequestHeaders.Add("X-Deletion-Secret", created.GetProperty("deletionSecret").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/shares", new { arbitrary = true })).StatusCode);
        created = await Json(await client.PostAsJsonAsync("/api/shares", archive));
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Shares.ExecuteUpdateAsync(set => set.SetProperty(x => x.ExpiresAt, 0));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/shares/" + created.GetProperty("id").GetString())).StatusCode);
    }

    [Fact]
    public async Task RoomSeatCredentialsRevocationAndClose()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        var pin = room.GetProperty("pin").GetString();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync(path + "/join", new { pin = "wrong", seat = 0 })).StatusCode);
        var player = await Json(await client.PostAsJsonAsync(path + "/join", new { pin, seat = 0 }));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(path + "/join", new { pin, seat = 0 })).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", player.GetProperty("token").GetString());
        var state = await Json(await client.GetAsync(path));
        Assert.Equal(0, state.GetProperty("seats")[0].GetInt32());
        Assert.False(state.TryGetProperty("pinHash", out _));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync(path)).StatusCode);
        var playerToken = player.GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path + "/seats/0")).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", playerToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
    }
}
