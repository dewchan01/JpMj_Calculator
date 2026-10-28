using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class ConfigurationTests
{
    [TestMethod]
    public void InvalidStorageLimitsFailAtStartup()
    {
        // Arrange.
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:MaxBytes"] = "0" })));

        // Act / Assert.
        FluentActions.Invoking(() => app.CreateClient()).Should().Throw<Microsoft.Extensions.Options.OptionsValidationException>()
            .Which.Message.Should().Contain("MaxBytes");
    }

    [TestMethod]
    [DataRow("Development", "http://localhost:4200")]
    [DataRow("Production", "https://dewchan01.github.io")]
    public void EnvironmentSelectsTheCorrectJsonSettings(string environment, string expectedOrigin)
    {
        using var root = new ApiFactory();
        using var app = root.WithWebHostBuilder(builder => builder.UseEnvironment(environment));
        using var client = app.CreateClient();
        var configuration = app.Services.GetRequiredService<IConfiguration>();
        (configuration["Cors:AllowedOrigins:0"]).Should().Be(expectedOrigin);
        (configuration.GetConnectionString("Database")).Should().Be("");
        (configuration.GetValue<long>("Storage:MaxBytes")).Should().Be(52428800);
    }
}
