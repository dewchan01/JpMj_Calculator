using System.ComponentModel.DataAnnotations;
namespace Riichi.Api.Infrastructure.Configuration;
/// <summary>Configures explicit frontend origins allowed to use credentials.</summary>
public sealed class CorsOptions
{
    /// <summary>Gets or sets the allowed frontend origins.</summary>
    [Required, MinLength(1)]
    public string[] AllowedOrigins { get; set; } = [];
}
