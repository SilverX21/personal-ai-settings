# C# 14 Language Features

Reference material — load on demand when writing or reviewing code that could use
these features. **Requires `LangVersion` 14** (see the Version awareness section of
`SKILL.md`); on an older target these do not compile. Existing pre-C#-14 code that
works is not a defect — don't churn it to the new syntax without a reason.

---

### Extension Members (C# 14 headline feature)

Extension blocks add properties, indexers and statics — not just methods. They must live
inside a **static class**, exactly like classic extension methods.

```csharp
public static class PlayerExtensions
{
    // Instance extension members — the receiver is named
    extension(Player player)
    {
        public bool IsEligibleForPromotion =>
            player.IsActive && player.Score > 1000;

        public string GetDisplayName() =>
            $"{player.Name} ({player.Email})";
    }

    // Static extension members — the receiver is the type itself
    extension(Player)
    {
        public static Player CreateGuest() =>
            new(Guid.NewGuid(), "Guest", "guest@example.com");
    }
}

// Use like native members
if (player.IsEligibleForPromotion) { }
var guest = Player.CreateGuest();
```

Requires `LangVersion` 14. Classic `this`-parameter extension methods still compile and
remain correct — don't churn existing code to the new syntax without a reason.

### `field` Keyword (C# 14)
```csharp
// ✅ Validate in setter without a manual backing field
public class PlayerProfile
{
    public string Name
    {
        get;
        set => field = value?.Trim()
            ?? throw new ArgumentNullException(nameof(value));
    }

    public int Score
    {
        get;
        set => field = value >= 0
            ? value
            : throw new ArgumentOutOfRangeException(nameof(value));
    }
}
// ❌ Old way — manual backing field boilerplate
// private string _name;
// public string Name { get => _name; set => _name = value ?? throw ...; }
```

### Null-Conditional Assignment (C# 14)
```csharp
// ✅ Assign only when not null — cleaner null guards
customer?.Order = GetCurrentOrder();
player?.Score += bonusPoints;

// ❌ Old way
if (customer is not null) customer.Order = GetCurrentOrder();
```

### Partial Constructors & Events (C# 14)
```csharp
// ✅ Clean source generator integration
// Hand-written file
public partial class Player
{
    public partial Player(string name, string email);
    public string Name { get; }
    public string Email { get; }
}

// Source-generated file
public partial class Player
{
    public partial Player(string name, string email)
    {
        Name = name;
        Email = email;
    }
}
```

### Lambda Parameter Modifiers Without Types (C# 14)
```csharp
// ✅ Cleaner lambda signatures — no need to repeat types
TryParse<int> parse = (text, out result) => int.TryParse(text, out result);

// ❌ Old way — types required when using modifiers
TryParse<int> parse = (string text, out int result) => int.TryParse(text, out result);
```

### Implicit Span Conversions (C# 14)
```csharp
// ✅ Arrays, spans and read-only spans convert implicitly — less ceremony
void Process(ReadOnlySpan<byte> data) { }

byte[] bytes = [1, 2, 3];
Process(bytes); // ← implicit conversion, no .AsSpan() needed
```

### `nameof` on Unbound Generics (C# 14)
```csharp
// ✅ No need for a closed generic type just to get the name
var name = nameof(List<>); // "List"

// ❌ Old way
var name = nameof(List<int>); // "List" — needed a type arg just for the name
```

### Everything from Before — Still Apply
```csharp
// ✅ nameof() — refactor-safe
throw new ArgumentNullException(nameof(user));

// ✅ Target-typed new()
List<Player> players = new();

// ✅ Collection expressions (.NET 8+)
int[] ids = [1, 2, 3];

// ✅ is not null
if (player is not null) { }

// ✅ Pattern matching
var result = player switch
{
    { IsActive: true, Score: > 1000 } => "Elite",
    { IsActive: true } => "Active",
    _ => "Inactive"
};

// ✅ Source generators — logging, JSON, regex, mapping
[LoggerMessage(Level = LogLevel.Information, Message = "Player {PlayerId} created")]
partial void LogPlayerCreated(Guid playerId);

[GeneratedRegex(@"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")]
private static partial Regex EmailRegex();
```

---
