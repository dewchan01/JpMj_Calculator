using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Riichi.Api.Data;
using Xunit;

namespace Riichi.Api.Tests;

public sealed class LimitsTests
{
    [Fact]
    public async Task InvalidEnvelopeAndOversizeAreRejected()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/shares", new { format = "riichi-table", version = "1", matches = new[] { new { } } })).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await client.PostAsync("/api/shares", new StringContent(new string('x', 5 * 1024 * 1024 + 1)))).StatusCode);
    }

    [Fact]
    public async Task QuotaCannotBeBypassedAndExpiredRowsAreReclaimed()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            db.Shares.Add(new SharedArchive { Id = "quota", Size = 50 * 1024 * 1024, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds() });
            await db.SaveChangesAsync();
        }
        var data = new { format = "riichi-table", version = 1, matches = new[] { new { id = "one" } } };
        Assert.Equal(HttpStatusCode.InsufficientStorage, (await client.PostAsJsonAsync("/api/shares", data)).StatusCode);
        using (var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDb>().Shares.ExecuteUpdateAsync(set => set.SetProperty(x => x.ExpiresAt, 0));
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/shares", data)).StatusCode);
    }

    [Fact]
    public async Task RepeatedJoinAttemptsAreThrottled()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/rooms/AAAAAAAAAA/join", new { pin = "000000", seat = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/rooms/AAAAAAAAAA/join", new { pin = "000000", seat = 0 })).StatusCode);
    }
}
