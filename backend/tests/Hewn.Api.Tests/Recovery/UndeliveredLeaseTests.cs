// Acceptance Test
// Traces to: L2-026, L2-050
// Description: A lease the API grants but can't deliver (the request fails after the grant) goes back to the queue at once, so another worker (or the same one) leases the run instead of it waiting 60 seconds on a worker that never heard of it, and a cancel meanwhile isn't left waiting on that worker (L2-026 AC3, L2-050 AC2)

using System.Net;
using System.Net.Http.Json;
using Hewn.Api.Tests.Support;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hewn.Api.Tests.Recovery;

public sealed class UndeliveredLeaseTests : IAsyncLifetime
{
    private readonly FailingPublisher _publisher = new();
    private readonly HewnApiFactory _factory;

    public UndeliveredLeaseTests()
    {
        _factory = new HewnApiFactory().WithServices(services =>
        {
            services.RemoveAll<IProjectEventPublisher>();
            services.AddSingleton<IProjectEventPublisher>(_publisher);
        });
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task A_lease_whose_answer_fails_goes_back_to_the_queue_at_once()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Seed Swap",
            idea = "A seed swap register for a community garden.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var first = await _factory.RegisterWorkerAsync("worker-a");
        var second = await _factory.RegisterWorkerAsync("worker-b");

        _publisher.FailNext = true;
        var failed = await first.Http.PostAsJsonAsync("/api/worker/lease", new { workerId = first.WorkerId });
        Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);

        // No 60-second wait for a lease nobody received: the next worker to ask gets the run.
        var run = await second.LeaseAsync();
        Assert.NotNull(run);
        Assert.Equal(0, run.Stage);
        (await second.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
    }

    /// <summary>Publishes nothing, and throws once when told to, as a broken SignalR backplane might.</summary>
    private sealed class FailingPublisher : IProjectEventPublisher
    {
        public bool FailNext { get; set; }

        public Task PublishAsync(IReadOnlyList<StoredEvent> events, CancellationToken cancellationToken)
        {
            if (!FailNext)
            {
                return Task.CompletedTask;
            }

            FailNext = false;
            throw new InvalidOperationException("The event publisher failed.");
        }

        public Task ProjectDeletedAsync(Guid projectId, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
