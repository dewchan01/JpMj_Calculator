using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;
using Riichi.Api.Features.Rooms.Notifications;
using System.Net.Http.Headers;
using System.Threading.Channels;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class RoomHubTests
{
    [TestMethod]
    public async Task HostSeesAuthenticatedPresenceAcrossMultipleTabsWithoutChangingGameRevision()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await (await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4 }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var id = room.GetProperty("id").GetString()!;
        var player = await (await client.PostAsJsonAsync($"/api/rooms/{id}/join", new { pin = room.GetProperty("pin").GetString(), seat = 1 }))
            .Content.ReadFromJsonAsync<JsonElement>();
        await using var host = Connection(app); await using var first = Connection(app); await using var second = Connection(app);
        var updates = Channel.CreateUnbounded<PresenceSnapshot>();
        host.On<PresenceSnapshot>("Presence", value => updates.Writer.TryWrite(value));
        async Task WaitFor(bool online)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            while (await updates.Reader.WaitToReadAsync(timeout.Token))
                while (updates.Reader.TryRead(out var value)) if (value.Seats.Contains(1) == online) return;
        }
        await host.StartAsync();
        var initial = await host.InvokeAsync<PresenceSnapshot>("Join", id, room.GetProperty("token").GetString());
        initial.Seats.Should().BeEmpty();
        await first.StartAsync();
        var participantPresence = await first.InvokeAsync<PresenceSnapshot?>("Join", id, player.GetProperty("token").GetString());
        participantPresence.Should().BeNull();
        await WaitFor(true);
        await second.StartAsync(); await second.InvokeAsync("Join", id, player.GetProperty("token").GetString());
        await first.StopAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        var state = await client.GetFromJsonAsync<JsonElement>($"/api/rooms/{id}/game");
        state.GetProperty("revision").GetInt64().Should().Be(0);
        state.GetProperty("presence").GetProperty("seats")[0].GetInt32().Should().Be(1);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", player.GetProperty("token").GetString());
        (await client.GetFromJsonAsync<JsonElement>($"/api/rooms/{id}/game")).GetProperty("presence").ValueKind.Should().Be(JsonValueKind.Null);
        await second.StopAsync();
        await WaitFor(false);
    }

    private static HubConnection Connection(ApiFactory app) => new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/rooms", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => app.Server.CreateHandler();
        }).Build();

    [TestMethod]
    public async Task NotificationsStayInRoomAndInvalidCredentialsCannotJoin()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        async Task<JsonElement> Create() => await (await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4 }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var first = await Create(); var second = await Create();
        await using var one = Connection(app); await using var two = Connection(app); await using var invalid = Connection(app);
        var notification = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var otherNotifications = 0;
        one.On("Changed", () => notification.TrySetResult());
        two.On("Changed", () => Interlocked.Increment(ref otherNotifications));
        await one.StartAsync(); await two.StartAsync(); await invalid.StartAsync();
        await one.InvokeAsync("Join", first.GetProperty("id").GetString(), first.GetProperty("token").GetString());
        await two.InvokeAsync("Join", second.GetProperty("id").GetString(), second.GetProperty("token").GetString());
        await FluentActions.Awaiting(() => invalid.InvokeAsync("Join", first.GetProperty("id").GetString(), second.GetProperty("token").GetString())).Should().ThrowAsync<HubException>();
        var response = await client.PostAsJsonAsync($"/api/rooms/{first.GetProperty("id").GetString()}/join",
            new { pin = first.GetProperty("pin").GetString(), seat = 0 });
        response.EnsureSuccessStatusCode();
        await notification.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await Task.Delay(150);
        (otherNotifications).Should().Be(0);
        await one.StopAsync();
        await one.StartAsync();
        await one.InvokeAsync("Join", first.GetProperty("id").GetString(), first.GetProperty("token").GetString());
    }
}
