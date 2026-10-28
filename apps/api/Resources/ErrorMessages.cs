using System.Globalization;
using System.Resources;
namespace Riichi.Api.Resources;

internal static class ErrorMessages
{
    private static readonly ResourceManager ResourceManager = new("Riichi.Api.Resources.ErrorMessages", typeof(ErrorMessages).Assembly);
    internal static string Get(string key) => ResourceManager.GetString(key, CultureInfo.CurrentUICulture) ?? key;
}
