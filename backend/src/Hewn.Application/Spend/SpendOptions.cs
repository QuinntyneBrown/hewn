namespace Hewn.Application.Spend;

/// <summary>A model's price in US dollars per million input and output tokens.</summary>
public sealed record ModelPrice(decimal InputPerMillionUsd, decimal OutputPerMillionUsd);

public sealed class SpendOptions
{
    /// <summary>
    /// The price table (L2-052 AC1): Anthropic's first-party API rates per million tokens, as published on
    /// 2026-10-06. Override or extend with <c>Hewn:Prices:{model}:InputPerMillionUsd</c> and
    /// <c>OutputPerMillionUsd</c>; see ADR 0010.
    /// </summary>
    public Dictionary<string, ModelPrice> Prices { get; set; } = new(StringComparer.Ordinal)
    {
        ["claude-fable-5-1"] = new(10.00m, 50.00m),
        ["claude-opus-5-5"] = new(4.00m, 20.00m),
        ["claude-sonnet-5-5"] = new(2.00m, 10.00m),
        ["claude-haiku-5-5"] = new(0.10m, 0.50m),
    };

    /// <summary>The default budget before an Owner saves one in Settings (HEWN_DEFAULT_BUDGET_USD).</summary>
    public decimal DefaultBudgetUsd { get; set; } = 300m;
}
