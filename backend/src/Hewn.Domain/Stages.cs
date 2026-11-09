namespace Hewn.Domain;

/// <summary>The fixed pipeline: stages 0 to 10, in order.</summary>
public static class Stages
{
    public static readonly IReadOnlyList<string> Names =
    [
        "Bootstrap",
        "Idea",
        "Designs",
        "Design system",
        "Stack",
        "Requirements",
        "Scaffold",
        "Detailed designs",
        "User journeys",
        "Estimates",
        "Increments",
    ];

    public static int Count => Names.Count;
}
