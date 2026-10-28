using System.ComponentModel.DataAnnotations;
namespace Riichi.Api.Infrastructure.Configuration;
/// <summary>Configures optional, bounded Seq delivery.</summary>
public sealed class SeqOptions
{
    /// <summary>Gets or sets the Seq HTTP(S) endpoint; blank disables delivery.</summary>
    public string ServerUrl { get; set; } = "";
    /// <summary>Gets or sets the optional ingestion credential.</summary>
    public string ApiKey { get; set; } = "";
    /// <summary>Gets or sets the maximum queued event count.</summary>
    [Range(1, 100000)]
    public int QueueSizeLimit { get; set; } = 10000;
    /// <summary>Gets or sets the maximum serialized event size.</summary>
    [Range(1024, 1024 * 1024)]
    public int EventBodyLimitBytes { get; set; } = 64 * 1024;
}
