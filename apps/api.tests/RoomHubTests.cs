using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Xunit;

namespace Riichi.Api.Tests;

public sealed class RoomHubTests
{
    private static HubConnection Connection(ApiFactory app) => new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/rooms", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => app.Server.CreateHandler();
        }).Build();

    [Fact]
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
        await Assert.ThrowsAsync<HubException>(() => invalid.InvokeAsync("Join", first.GetProperty("id").GetString(), second.GetProperty("token").GetString()));
        var response = await client.PostAsJsonAsync($"/api/rooms/{first.GetProperty("id").GetString()}/join",
            new { pin = first.GetProperty("pin").GetString(), seat = 0 });
        response.EnsureSuccessStatusCode();
        await notification.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await Task.Delay(150);
        Assert.Equal(0, otherNotifications);
        await one.StopAsync();
        await one.StartAsync();
        await one.InvokeAsync("Join", first.GetProperty("id").GetString(), first.GetProperty("token").GetString());
    }
}
