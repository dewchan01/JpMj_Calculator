namespace Riichi.Api.Shared.Handlers;
/// <summary>Handles a single application request.</summary>
/// <typeparam name="TRequest">The request contract.</typeparam>
public interface IRequestHandler<in TRequest> where TRequest : class
{
    /// <summary>Executes a validated request with cooperative cancellation.</summary>
    /// <param name="request">The operation input.</param>
    /// <param name="cancellationToken">The caller cancellation token.</param>
    /// <returns>The operation result.</returns>
    Task<IResult> HandleAsync(TRequest request, CancellationToken cancellationToken);
}
