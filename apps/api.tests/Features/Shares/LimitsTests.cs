using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Riichi.Api.Data;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class LimitsTests
{
    [TestMethod]
    public async Task InvalidEnvelopeAndOversizeAreRejected()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        ((await client.PostAsJsonAsync("/api/shares", new { format = "riichi-table", version = "1", matches = new[] { new { } } })).StatusCode).Should().Be(HttpStatusCode.BadRequest);
        ((await client.PostAsync("/api/shares", new StringContent(new string('x', 5 * 1024 * 1024 + 1)))).StatusCode).Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }

    [TestMethod]
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
        ((await client.PostAsJsonAsync("/api/shares", data)).StatusCode).Should().Be(HttpStatusCode.InsufficientStorage);
        using (var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDb>().Shares.ExecuteUpdateAsync(set => set.SetProperty(x => x.ExpiresAt, 0));
        ((await client.PostAsJsonAsync("/api/shares", data)).StatusCode).Should().Be(HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task RepeatedJoinAttemptsAreThrottled()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        for (var i = 0; i < 10; i++)
            ((await client.PostAsJsonAsync("/api/rooms/AAAAAAAAAA/join", new { pin = "000000", seat = 0 })).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        ((await client.PostAsJsonAsync("/api/rooms/AAAAAAAAAA/join", new { pin = "000000", seat = 0 })).StatusCode).Should().Be(HttpStatusCode.TooManyRequests);
    }
}
