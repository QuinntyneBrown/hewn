using Hewn.Infrastructure.Fakes;

namespace Hewn.Api.Tests.Support;

/// <summary>Stands in for GitHub: the in-memory GitHub the e2e stack uses, with no scripted access lists.</summary>
public sealed class FakeGitHub() : InMemoryGitHub(null);
