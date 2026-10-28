using System.Security.Cryptography;
using System.Text;

namespace Riichi.Api.Security;

public static class Secrets
{
    public static string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static bool Matches(string value, string hash) => value.Length is > 0 and <= 256 &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(value)), Encoding.UTF8.GetBytes(hash));
    public static string PinHash(string pin, string salt) => Convert.ToHexString(
        Rfc2898DeriveBytes.Pbkdf2(pin, Encoding.UTF8.GetBytes(salt), 100_000, HashAlgorithmName.SHA256, 32));
    public static bool PinMatches(string pin, string salt, string hash) => pin.Length == 6 &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(PinHash(pin, salt)), Encoding.UTF8.GetBytes(hash));
    public static string Bearer(HttpRequest request)
    {
        var value = request.Headers.Authorization.ToString();
        return value.StartsWith("Bearer ", StringComparison.Ordinal) ? value[7..] : "";
    }
}
