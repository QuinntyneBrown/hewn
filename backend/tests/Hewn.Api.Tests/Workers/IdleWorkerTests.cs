// Acceptance Test
// Traces to: L2-026
// Description: An idle worker waits for a push from the server: a held lease request answers as soon as work is queued or a retry's backoff ends (L2-006 AC1), and with no work it answers 204 when its wait ends (AC5)

using System.Diagnostics;
using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Workers;

public sealed class IdleWorkerTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task A_held_lease_request_answers_as_soon_as_work_is_queued()
    {
        var worker = await _factory.RegisterWorkerAsync();
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var clock = Stopwatch.StartNew();

        var waiting = worker.LeaseAsync(waitSeconds: 20);
        await Task.Delay(500);
        Assert.False(waiting.IsCompleted);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);

        var run = await waiting;
        Assert.NotNull(run);
        Assert.Equal(0, run.Stage);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(5), $"answered after {clock.Elapsed}");
    }

    [Fact]
    public async Task A_held_lease_request_answers_as_soon_as_a_retrys_backoff_ends()
    {
        var worker = await _factory.RegisterWorkerAsync();
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await owner.PostAsync("/api/projects", new { name = "Ledgerline", idea = "A web app for small accounting teams.", budgetUsd = 300m });
        var first = await worker.LeaseAsync();
        (await worker.FailAsync(first!, "Bootstrap failed")).EnsureSuccessStatusCode();

        var waiting = worker.LeaseAsync(waitSeconds: 20);
        await Task.Delay(500);
        Assert.False(waiting.IsCompleted);
        var clock = Stopwatch.StartNew();
        _factory.Clock.Advance(TimeSpan.FromSeconds(31));

        var retry = await waiting;
        Assert.NotNull(retry);
        Assert.Equal(0, retry.Stage);
        Assert.NotEqual(first!.RunId, retry.RunId);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(5), $"answered after {clock.Elapsed}");
    }

    [Fact]
    public async Task With_no_work_a_held_lease_request_answers_204_when_its_wait_ends()
    {
        var worker = await _factory.RegisterWorkerAsync();
        var clock = Stopwatch.StartNew();

        var run = await worker.LeaseAsync(waitSeconds: 2);

        Assert.Null(run);
        Assert.InRange(clock.Elapsed, TimeSpan.FromSeconds(1.8), TimeSpan.FromSeconds(6));
    }
}
