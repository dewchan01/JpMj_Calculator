using System.Globalization;
using System.Resources;
namespace Riichi.Api.Resources;

internal static class LogMessages
{
    private static readonly ResourceManager ResourceManager = new("Riichi.Api.Resources.LogMessages", typeof(LogMessages).Assembly);
    internal static string Get(string key) => ResourceManager.GetString(key, CultureInfo.CurrentUICulture) ?? key;
}
