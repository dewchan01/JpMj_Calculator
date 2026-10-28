using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;
using Riichi.Api.Data;
using Riichi.Api.Features.Rooms;
using Riichi.Api.Features.Rooms.GetRoom;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class GetRoomTests
{
    [TestMethod]
    [DataRow(true, StatusCodes.Status200OK)]
    [DataRow(false, StatusCodes.Status401Unauthorized)]
    public async Task CurrentMembershipDeterminesAccess(bool allowed, int expectedStatus)
    {
        // Arrange: a current room and a credential checked by the shared access boundary.
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Rooms.Add(new Room { Id = "room", PlayerCount = 4, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds() });
        await db.SaveChangesAsync();
        var access = new Mock<IRoomAccess>(MockBehavior.Strict);
        using var cancellation = new CancellationTokenSource();
        access.Setup(x => x.CanReadAsync(It.Is<Room>(r => r.Id == "room"), "credential", cancellation.Token))
            .ReturnsAsync(allowed);
        var handler = new Handler(db, access.Object);

        // Act.
        var result = await handler.HandleAsync(new Request("room", "credential"), cancellation.Token);

        // Assert: membership is checked once with the caller's cancellation token.
        result.Should().BeAssignableTo<IStatusCodeHttpResult>().Which.StatusCode.Should().Be(expectedStatus);
        access.VerifyAll();
        access.VerifyNoOtherCalls();
    }

    [TestMethod]
    public async Task ExpiredRoomDoesNotCheckCredentials()
    {
        // Arrange.
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Rooms.Add(new Room { Id = "expired", ExpiresAt = 1 });
        await db.SaveChangesAsync();
        var access = new Mock<IRoomAccess>(MockBehavior.Strict);

        // Act.
        var result = await new Handler(db, access.Object).HandleAsync(new Request("expired", "credential"), CancellationToken.None);

        // Assert.
        result.Should().BeAssignableTo<IStatusCodeHttpResult>().Which.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        access.VerifyNoOtherCalls();
    }

    [TestMethod]
    public void NullDependenciesAndRequestsAreRejectedBeforeDatabaseAccess()
    {
        // Arrange.
        using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite("Data Source=:memory:").Options);
        var access = Mock.Of<IRoomAccess>();
        var handler = new Handler(db, access);

        // Act / Assert.
        FluentActions.Invoking(() => new Handler(null!, access)).Should().Throw<ArgumentNullException>().WithParameterName("db");
        FluentActions.Invoking(() => new Handler(db, null!)).Should().Throw<ArgumentNullException>().WithParameterName("access");
        FluentActions.Invoking(() => { _ = handler.HandleAsync(null!, CancellationToken.None); }).Should().Throw<ArgumentNullException>().WithParameterName("request");
    }

    [TestMethod]
    public void CancelledRequestDoesNotAccessDatabaseOrMembership()
    {
        // Arrange: the database has no schema, so accidental I/O would fail.
        using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite("Data Source=:memory:").Options);
        var access = new Mock<IRoomAccess>(MockBehavior.Strict);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var handler = new Handler(db, access.Object);

        // Act / Assert.
        FluentActions.Invoking(() => { _ = handler.HandleAsync(new Request("room", "credential"), cancellation.Token); })
            .Should().Throw<OperationCanceledException>();
        access.VerifyNoOtherCalls();
    }
}
