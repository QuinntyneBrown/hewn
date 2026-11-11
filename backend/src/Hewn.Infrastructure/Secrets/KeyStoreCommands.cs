using System.Diagnostics;

namespace Hewn.Infrastructure.Secrets;

/// <summary>Runs the OS key store's command-line tool. A value only ever travels on standard input, never in arguments.</summary>
public interface IKeyStoreCommands
{
    Task<(int ExitCode, string Output)> RunAsync(string file, IReadOnlyList<string> arguments, string? input, CancellationToken cancellationToken);
}

public sealed class ProcessKeyStoreCommands : IKeyStoreCommands
{
    public async Task<(int ExitCode, string Output)> RunAsync(string file, IReadOnlyList<string> arguments, string? input, CancellationToken cancellationToken)
    {
        var start = new ProcessStartInfo(file) { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        using var process = Process.Start(start) ?? throw new InvalidOperationException($"Could not start {file}.");
        if (input is not null)
        {
            await process.StandardInput.WriteAsync(input);
        }

        process.StandardInput.Close();
        var output = process.StandardOutput.ReadToEndAsync(cancellationToken);
        // Errors are read and dropped: a key store tool can echo what it was given.
        _ = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        return (process.ExitCode, await output);
    }
}
