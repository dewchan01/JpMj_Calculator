namespace Riichi.Api.Shared.Handlers;
/// <summary>Provides common guards for command handlers.</summary>
/// <typeparam name="TRequest">The request contract.</typeparam>
public abstract class CommandHandler<TRequest> : ICommandHandler<TRequest> where TRequest : class
{
    /// <inheritdoc />
    public Task<IResult> HandleAsync(TRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();
        return ExecuteAsync(request, cancellationToken);
    }
    /// <summary>Executes the feature-specific operation.</summary>
    /// <param name="command">The validated request.</param>
    /// <param name="cancellationToken">The caller cancellation token.</param>
    /// <returns>The HTTP operation result.</returns>
    protected abstract Task<IResult> ExecuteAsync(TRequest command, CancellationToken cancellationToken);
}
