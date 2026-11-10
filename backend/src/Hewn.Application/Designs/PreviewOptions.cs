namespace Hewn.Application.Designs;

/// <summary>Where project HTML is previewed, apart from Mission Control (L2-011 AC2; ADR 0018).</summary>
public sealed class PreviewOptions
{
    /// <summary>
    /// The preview origin, such as <c>https://mocks.hewn.dev</c> (Hewn:Preview:Origin; the local API's own port on 127.0.0.1 by default). It must differ from Mission
    /// Control's host, so the browser keeps Mission Control's cookies and storage away from the previewed page.
    /// </summary>
    public string Origin { get; set; } = "http://127.0.0.1:5200";

    /// <summary>How long a signed preview link works (Hewn:Preview:TokenMinutes).</summary>
    public int TokenMinutes { get; set; } = 60;

    /// <summary>The only folders a preview may serve.</summary>
    public static readonly IReadOnlyList<string> AllowedRoots = ["docs/mocks/", "docs/design-system/"];
}
