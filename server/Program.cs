var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<CounterState>();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new { message = "Counter API is running." }));
app.MapGet("/api/counter", (CounterState counter) =>
    Results.Ok(new { value = counter.Value }));
app.MapPost("/api/counter/increment", (CounterState counter) =>
    Results.Ok(new { value = counter.Increment() }));
app.MapPost("/api/counter/decrement", (CounterState counter) =>
    Results.Ok(new { value = counter.Decrement() }));
app.MapPost("/api/counter/reset", (CounterState counter) =>
    Results.Ok(new { value = counter.Reset() }));

app.Run();

public sealed class CounterState
{
    private int _value;

    public int Value => Volatile.Read(ref _value);

    public int Increment() => Interlocked.Increment(ref _value);

    public int Decrement() => Interlocked.Decrement(ref _value);

    public int Reset()
    {
        Interlocked.Exchange(ref _value, 0);
        return 0;
    }
}
