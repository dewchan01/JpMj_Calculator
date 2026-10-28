namespace Riichi.Api.Infrastructure.Configuration;
/// <summary>Configures the database connection; blank permits local SQLite only.</summary>
public sealed class DatabaseOptions
{
    /// <summary>Gets or sets the SQL Server connection string.</summary>
    public string Database { get; set; } = "";
}
