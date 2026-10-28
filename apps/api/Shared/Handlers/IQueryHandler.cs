namespace Riichi.Api.Shared.Handlers;
/// <summary>Handles a query operation.</summary>
/// <typeparam name="TRequest">The request contract.</typeparam>
public interface IQueryHandler<in TRequest> : IRequestHandler<TRequest> where TRequest : class { }
