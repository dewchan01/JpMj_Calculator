using System.Security.Cryptography;
using System.Text;

namespace Riichi.Api.Infrastructure.Security;

/// <summary>Creates and verifies credentials without retaining their plaintext.</summary>
public static class Secrets
{
    /// <summary>Creates a cryptographically random bearer credential.</summary>
    /// <returns>A random hexadecimal credential.</returns>
    public static string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    /// <summary>Hashes a bearer credential.</summary>
    /// <param name="value">The presented credential.</param>
    /// <returns>The SHA-256 hexadecimal hash.</returns>
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    /// <summary>Compares a bearer credential against a stored hash in constant time.</summary>
    /// <param name="value">The presented credential.</param>
    /// <param name="hash">The stored hash.</param>
    /// <returns>Whether the credential matches.</returns>
    public static bool Matches(string value, string hash) => value.Length is > 0 and <= 256 &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(value)), Encoding.UTF8.GetBytes(hash));
    /// <summary>Derives a salted passcode hash.</summary>
    /// <param name="pin">The six-digit passcode.</param>
    /// <param name="salt">The room identifier.</param>
    /// <returns>The PBKDF2 hexadecimal hash.</returns>
    public static string PinHash(string pin, string salt) => Convert.ToHexString(
        Rfc2898DeriveBytes.Pbkdf2(pin, Encoding.UTF8.GetBytes(salt), 100_000, HashAlgorithmName.SHA256, 32));
    /// <summary>Compares a six-digit passcode with a stored salted hash.</summary>
    /// <param name="pin">The six-digit passcode.</param>
    /// <param name="salt">The room identifier.</param>
    /// <param name="hash">The stored hash.</param>
    /// <returns>Whether the passcode matches.</returns>
    public static bool PinMatches(string pin, string salt, string hash) => pin.Length == 6 &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(PinHash(pin, salt)), Encoding.UTF8.GetBytes(hash));
    /// <summary>Extracts the bearer credential from the request.</summary>
    /// <param name="request">The HTTP request.</param>
    /// <returns>The credential, or an empty string when absent.</returns>
    public static string Bearer(HttpRequest request)
    {
        var value = request.Headers.Authorization.ToString();
        return value.StartsWith("Bearer ", StringComparison.Ordinal) ? value[7..] : "";
    }
}
