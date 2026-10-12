var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<CounterState>();
builder.Services.AddSingleton<TargetGameState>();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new { message = "Counter Studio & Target Match API is running." }));

// Classic Counter endpoints (backward compatible)
app.MapGet("/api/counter", (CounterState counter) =>
    Results.Ok(new { value = counter.Value }));
app.MapPost("/api/counter/increment", (CounterState counter) =>
    Results.Ok(new { value = counter.Increment() }));
app.MapPost("/api/counter/decrement", (CounterState counter) =>
    Results.Ok(new { value = counter.Decrement() }));
app.MapPost("/api/counter/reset", (CounterState counter) =>
    Results.Ok(new { value = counter.Reset() }));

// Target Match Game endpoints
app.MapGet("/api/game", (TargetGameState game) =>
    Results.Ok(game.GetSnapshot()));

app.MapPost("/api/game/new", (TargetGameState game, NewGameRequest? req) =>
    Results.Ok(game.StartNewGame(req?.Level)));

app.MapPost("/api/game/op", (TargetGameState game, OpRequest req) =>
    Results.Ok(game.ApplyOperation(req.Op)));

app.MapPost("/api/game/undo", (TargetGameState game) =>
    Results.Ok(game.Undo()));

app.MapPost("/api/game/reset", (TargetGameState game) =>
    Results.Ok(game.ResetRound()));

app.Run();

public record NewGameRequest(int? Level);
public record OpRequest(string Op);

public record GameSnapshot(
    int CurrentValue,
    int Target,
    int Moves,
    int ParMoves,
    int Level,
    int CurrentStreak,
    int BestStreak,
    bool IsWon,
    int GamesWon,
    string[] History,
    string[] AllowedOps
);

public sealed class TargetGameState
{
    private readonly object _lock = new();
    private readonly Random _random = new();

    public int CurrentValue { get; private set; }
    public int Target { get; private set; }
    public int Moves { get; private set; }
    public int ParMoves { get; private set; }
    public int Level { get; private set; } = 1;
    public int CurrentStreak { get; private set; }
    public int BestStreak { get; private set; }
    public bool IsWon { get; private set; }
    public int GamesWon { get; private set; }
    public List<string> History { get; private set; } = new();

    private static readonly string[] DefaultOps = ["+1", "+5", "+10", "-1", "-5", "*2", "*3", "/2"];

    public TargetGameState()
    {
        StartNewGame(1);
    }

    public GameSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            return new GameSnapshot(
                CurrentValue,
                Target,
                Moves,
                ParMoves,
                Level,
                CurrentStreak,
                BestStreak,
                IsWon,
                GamesWon,
                History.ToArray(),
                DefaultOps
            );
        }
    }

    public GameSnapshot StartNewGame(int? requestedLevel = null)
    {
        lock (_lock)
        {
            if (requestedLevel.HasValue && requestedLevel.Value >= 1 && requestedLevel.Value <= 5)
            {
                Level = requestedLevel.Value;
            }

            int min = Level switch
            {
                1 => 15,
                2 => 41,
                3 => 91,
                4 => 201,
                _ => 351
            };
            int max = Level switch
            {
                1 => 40,
                2 => 90,
                3 => 200,
                4 => 350,
                _ => 500
            };

            Target = _random.Next(min, max + 1);
            CurrentValue = 0;
            Moves = 0;
            IsWon = false;
            History.Clear();
            History.Add("0");
            ParMoves = CalculatePar(Target);

            return GetSnapshot();
        }
    }

    public GameSnapshot ApplyOperation(string? op)
    {
        lock (_lock)
        {
            if (IsWon || string.IsNullOrWhiteSpace(op))
            {
                return GetSnapshot();
            }

            string cleanOp = op.Trim();
            int next = CurrentValue;

            switch (cleanOp)
            {
                case "+1": next += 1; break;
                case "+5": next += 5; break;
                case "+10": next += 10; break;
                case "-1": next -= 1; break;
                case "-5": next -= 5; break;
                case "*2" or "x2": next *= 2; break;
                case "*3" or "x3": next *= 3; break;
                case "/2":
                    if (next % 2 == 0)
                    {
                        next /= 2;
                    }
                    else
                    {
                        return GetSnapshot();
                    }
                    break;
                default:
                    return GetSnapshot();
            }

            CurrentValue = next;
            Moves++;
            History.Add($"{cleanOp} \u2794 {CurrentValue}");

            if (CurrentValue == Target)
            {
                IsWon = true;
                GamesWon++;
                CurrentStreak++;
                if (CurrentStreak > BestStreak)
                {
                    BestStreak = CurrentStreak;
                }
            }

            return GetSnapshot();
        }
    }

    public GameSnapshot Undo()
    {
        lock (_lock)
        {
            if (History.Count > 1 && !IsWon)
            {
                History.RemoveAt(History.Count - 1);
                Moves = Math.Max(0, Moves - 1);

                string lastEntry = History[^1];
                if (lastEntry.Contains('\u2794'))
                {
                    var parts = lastEntry.Split('\u2794');
                    if (int.TryParse(parts[^1].Trim(), out int val))
                    {
                        CurrentValue = val;
                    }
                }
                else
                {
                    CurrentValue = 0;
                }
            }
            return GetSnapshot();
        }
    }

    public GameSnapshot ResetRound()
    {
        lock (_lock)
        {
            CurrentValue = 0;
            Moves = 0;
            IsWon = false;
            History.Clear();
            History.Add("0");
            return GetSnapshot();
        }
    }

    private static int CalculatePar(int target)
    {
        if (target <= 0) return 0;
        var queue = new Queue<(int val, int steps)>();
        var visited = new HashSet<int>();

        queue.Enqueue((0, 0));
        visited.Add(0);

        int maxBound = Math.Max(1000, target * 2 + 20);

        while (queue.Count > 0)
        {
            var (curr, steps) = queue.Dequeue();
            if (curr == target) return steps;
            if (steps >= 12) continue;

            int[] nextCandidates = [
                curr + 1,
                curr + 5,
                curr + 10,
                curr - 1,
                curr - 5,
                curr * 2,
                curr * 3,
                (curr % 2 == 0 ? curr / 2 : curr)
            ];

            foreach (var next in nextCandidates)
            {
                if (next == curr) continue;
                if (next < -20 || next > maxBound) continue;
                if (visited.Add(next))
                {
                    if (next == target) return steps + 1;
                    queue.Enqueue((next, steps + 1));
                }
            }
        }

        return 5;
    }
}

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

