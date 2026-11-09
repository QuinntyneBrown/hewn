using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Hewn.Infrastructure.Persistence;

internal sealed class DateTimeOffsetToTicksConverter()
    : ValueConverter<DateTimeOffset, long>(
        v => v.UtcTicks,
        v => new DateTimeOffset(v, TimeSpan.Zero));
