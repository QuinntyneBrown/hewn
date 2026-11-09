using Hewn.Domain;

namespace Hewn.Application.Abstractions;

/// <summary>The signed-in user making the request.</summary>
public interface ICurrentUser
{
    string Login { get; }

    Role Role { get; }
}
