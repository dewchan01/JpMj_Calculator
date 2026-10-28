namespace Riichi.Api.Shared.Handlers;
/// <summary>Handles a command operation.</summary>
/// <typeparam name="TRequest">The request contract.</typeparam>
public interface ICommandHandler<in TRequest> : IRequestHandler<TRequest> where TRequest : class { }
