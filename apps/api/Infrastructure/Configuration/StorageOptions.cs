using System.ComponentModel.DataAnnotations;
namespace Riichi.Api.Infrastructure.Configuration;
/// <summary>Configures logical storage and upload limits in bytes.</summary>
public sealed class StorageOptions
{
    /// <summary>Gets or sets the combined archive, room and action quota.</summary>
    [Range(typeof(long), "1", "9223372036854775807")]
    public long MaxBytes { get; set; } = 50 * 1024 * 1024;
    /// <summary>Gets or sets the maximum uploaded archive size.</summary>
    [Range(1, 6 * 1024 * 1024)]
    public int MaxArchiveBytes { get; set; } = 5 * 1024 * 1024;
}
