using Hewn.Application.Abstractions;
using MediatR;

namespace Hewn.Application.Secrets;

/// <summary>A credential as settings show it: never its value (L2-040 AC1).</summary>
public sealed record CredentialRefDto(string Name, string Description, DateTimeOffset? UpdatedAt);

public sealed record ListCredentialsQuery : IRequest<IReadOnlyList<CredentialRefDto>>;

public sealed class ListCredentialsHandler(ISecretStore store) : IRequestHandler<ListCredentialsQuery, IReadOnlyList<CredentialRefDto>>
{
    public async Task<IReadOnlyList<CredentialRefDto>> Handle(ListCredentialsQuery request, CancellationToken cancellationToken)
    {
        var refs = await store.ListAsync(cancellationToken);
        return [.. Credentials.All.Select(c => new CredentialRefDto(c.Name, c.Description, refs.FirstOrDefault(r => r.Name == c.Name)?.UpdatedAt))];
    }
}
