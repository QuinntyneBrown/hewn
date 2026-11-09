using Microsoft.Extensions.Options;

namespace Hewn.Application.Spend;

/// <summary>Turns a model call's tokens into dollars.</summary>
public sealed class PriceTable(IOptions<SpendOptions> options)
{
    /// <summary>Costs are kept to a millionth of a dollar, so totals stored as doubles add up exactly.</summary>
    public const int Decimals = 6;

    /// <summary>
    /// The call's cost. A model missing from the table is priced at the table's highest rates, so an unknown
    /// model can only make the budget stop sooner, never later.
    /// </summary>
    public decimal Cost(string model, long inputTokens, long outputTokens)
    {
        var prices = options.Value.Prices;
        var price = prices.TryGetValue(model, out var known)
            ? known
            : new ModelPrice(prices.Values.Max(p => p.InputPerMillionUsd), prices.Values.Max(p => p.OutputPerMillionUsd));
        var cost = (inputTokens * price.InputPerMillionUsd + outputTokens * price.OutputPerMillionUsd) / 1_000_000m;
        return Math.Round(cost, Decimals, MidpointRounding.AwayFromZero);
    }
}
