---
name: dotnet-master
description: >
  You're a .NET and C# master skill. Load this skill whenever working on ANY .NET or C# task,
  including APIs, architecture decisions, code reviews, database work, testing, or cloud deployment.
  Trigger on any mention of .NET, C#, ASP.NET, EF Core, Minimal APIs, xUnit, Serilog, Azure, or any related .NET ecosystem topic. This skill encodes Nuno's exact standards, patterns, preferences, and anti-patterns to avoid — always code to these standards without being asked.
---

# .NET Master Skill — Nuno's Standards

## Core Principles
- **SOLID** — always, no exceptions
- **KISS** — simplest solution that works
- **YAGNI** — don't build what isn't needed yet
- **DRY** — with judgment; some duplication beats the wrong abstraction
- **Fail Fast** — validate inputs early, throw meaningful specific exceptions
- **Boy Scout Rule** — leave code cleaner than you found it

---

## Stack & Versions
- **.NET 10** — always use the latest
- **PostgreSQL 18** — preferred database
- **C# 14** — use latest language features

---

## Project Structure & Naming

### Naming Convention
Always derive project names from the `.sln`/`.slnx` filename:
```
CodeLab.HelloWorld.slnx
├── CodeLab.HelloWorld.Api
├── CodeLab.HelloWorld.Application
├── CodeLab.HelloWorld.Domain
├── CodeLab.HelloWorld.Infrastructure
└── CodeLab.HelloWorld.Tests
```

### Architecture Selection
Choose based on project complexity — never force one architecture everywhere:

| Complexity | Architecture |
|---|---|
| Simple CRUD | Minimal layering, direct service calls |
| Medium | Clean Architecture (Domain, Application, Infrastructure, Api) |
| Feature-heavy | Vertical Slice (plain/custom handlers — no mediator by default) |
| Large/distributed | Clean + DDD + CQRS |

Support for: **Clean Architecture, Vertical Slice, Hexagonal/Onion, DDD** — pick what fits.

Default VSA to plain handlers. Reach for **WolverineFx** only when you genuinely want its
messaging/mediator features — never as a default (KISS, and the same reasoning behind avoiding MediatR).

---

## C# Code Style

```csharp
// ✅ var preferred
var players = await _repository.GetAllAsync(cancellationToken);

// ✅ File-scoped namespaces
namespace CodeLab.HelloWorld.Api.Endpoints;

// ✅ Primary constructors
public class PlayerService(IPlayerRepository repository, ILogger<PlayerService> logger);

// ✅ Records for DTOs, request bodies, EF projections, Dapper results
public record CreatePlayerRequest(string Name, string Email);
public record PlayerDto(Guid Id, string Name, string Email);

// ✅ Pattern matching
var result = player switch
{
    { IsActive: true } => Results.Ok(player),
    _ => Results.NotFound()
};

// ✅ Nullable reference types enabled
<Nullable>enable</Nullable>

// ✅ Global usings + file-scoped namespaces — less noise
// ✅ readonly and init for immutability by default
// ✅ DateTimeOffset over DateTime
// ✅ DateOnly for date-only business fields (check-in/check-out) — no fake midnight times
// ✅ decimal for money
// ✅ Guid for IDs
```

**Never use:**
- `object` or `dynamic` types
- Magic numbers or strings — use a `Constants` class
- `async void` — always `async Task`
- `.Result` or `.Wait()` on async code
- Generic exceptions — always specific, always handled in global handler

---

## Async Rules
- **Async all the way down** — controller → service → repository → DB
- **Always pass `CancellationToken`** through the entire chain
- **No `ConfigureAwait(false)`** — unnecessary in ASP.NET Core
- **No `async void`** — use `async Task`
- **No `.Result` / `.Wait()`** — always `await`
- **No fire-and-forget** without proper exception handling

```csharp
// ✅ Correct async pattern
public async Task<PlayerDto?> GetPlayerAsync(Guid id, CancellationToken cancellationToken)
{
    return await _context.Players
        .AsNoTracking()
        .Where(p => p.Id == id)
        .Select(p => new PlayerDto(p.Id, p.Name, p.Email))
        .FirstOrDefaultAsync(cancellationToken);
}
```

---

## API Design — Minimal APIs

### Auto-registration via IEndpoint
```csharp
// Interface
public interface IEndpoint
{
    void MapEndpoints(IEndpointRouteBuilder app);
}

// Implementation
public class GetPlayerEndpoint : IEndpoint
{
    public void MapEndpoints(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/players/{id:guid}", HandleAsync)
           .WithName("GetPlayer")
           .WithTags("Players")
           .Produces<PlayerDto>()
           .ProducesProblem(404);
    }

    private static async Task<IResult> HandleAsync(
        Guid id,
        IPlayerService service,
        CancellationToken cancellationToken)
    {
        var player = await service.GetPlayerAsync(id, cancellationToken);
        return player is null ? Results.NotFound() : Results.Ok(player);
    }
}

// Registration at startup
builder.Services.AddEndpoints(typeof(Program).Assembly);
app.MapEndpoints();
```

### URL Versioning
Always with the `/api` prefix:
```
GET /api/v1/players
GET /api/v2/players
```

### HTTP Status Codes — be precise
- `200 OK`, `201 Created`, `204 No Content`
- `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`
- `500 Internal Server Error`

### Always
- Return `ProblemDetails` for errors (RFC 7807)
- Use `FluentValidation` for input validation — never trust the client
- Document with **OpenAPI + Scalar**
- Use **records** for all request bodies
- Implement `/health` and `/ready` health checks
- Apply rate limiting (built-in .NET 7+)

---

## Error Handling — ErrorOr

Business/domain failures are **values, not exceptions**. Use `ErrorOr<T>` end-to-end.

```csharp
// ✅ Domain errors as static definitions
public static class PlayerErrors
{
    public static readonly Error NotFound =
        Error.NotFound("Player.NotFound", "Player was not found.");
}

// ✅ Use cases return ErrorOr<T>
public async Task<ErrorOr<PlayerDto>> GetAsync(Guid id, CancellationToken cancellationToken)
{
    var player = await repository.GetAsync(id, cancellationToken);
    return player is null ? PlayerErrors.NotFound : player.ToDto();
}

// ✅ Endpoints map ErrorOr → ProblemDetails via the shared ToProblem() extension
return result.Match(Results.Ok, errors => errors.ToProblem());
```

- **`ErrorOr` is the one result type** — never hand-roll a custom `Result<T>`
- **Never throw for business flow control** — no `PlayerNotFoundException`, no `DuplicateEmailException`
- Exceptions are for the **unexpected only** — infrastructure failures and bugs

### Global Exception Middleware
Catches the unexpected only — everything business-level already returned an `Error`.

- One middleware handles all unhandled exceptions
- Per-type handling — each exception type maps to a specific HTTP response
- Never catch base `Exception` and swallow it
- Never throw generic `Exception` — always specific types

```csharp
// ✅ Specific, and only for the genuinely exceptional
throw new ArgumentNullException(nameof(player));
ArgumentNullException.ThrowIfNull(param);

// ❌ Never
throw new Exception("something went wrong");
```

---

## Database & EF Core

### Always
```csharp
// ✅ AsNoTracking for reads
var players = await _context.Players.AsNoTracking().ToListAsync(cancellationToken);

// ✅ Project to records — never return full entities
.Select(p => new PlayerDto(p.Id, p.Name, p.Email))

// ✅ Async always
await _context.SaveChangesAsync(cancellationToken);

// ✅ Batch operations (EF 7+)
await _context.Players
    .Where(p => p.IsInactive)
    .ExecuteDeleteAsync(cancellationToken);
```

### Never
```csharp
// ❌ SaveChanges inside loops
foreach (var player in players)
{
    _context.Players.Add(player);
    await _context.SaveChangesAsync(cancellationToken); // ← NEVER
}

// ✅ Save once after loop
_context.Players.AddRange(players);
await _context.SaveChangesAsync(cancellationToken);
```

### EF Core + Dapper Together
- **EF Core** — writes, simple reads, CRUD, change tracking
- **Dapper** — complex reporting queries, bulk reads, raw performance
- Both use **records** for projections/results

### Migrations
- EF Core migrations only
- Never hand-edit production schema
- Always backup before migrating production
- Scope `DbContext` per request (ASP.NET Core default)

### Repository Pattern
- Use when it adds real value (testing, swappable source, bounded context)
- Skip when it's just a 1:1 wrapper over `DbContext`
- Never return `IQueryable` from repositories — leaks DB concerns

---

## Configuration & Secrets

```csharp
// ✅ IOptions with startup validation
builder.Services.AddOptions<DatabaseOptions>()
    .BindConfiguration("Database")
    .ValidateDataAnnotations()
    .ValidateOnStart(); // ← always validate on start

// ✅ Never hardcode secrets in appsettings.json
// Production secrets — match the target cloud:
//   Azure → Azure Key Vault + Azure App Configuration
//   AWS   → AWS Secrets Manager + Systems Manager Parameter Store
// Local → User Secrets
```

---

## Logging — Serilog

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Level:u3}] {Timestamp:yyyy-MM-dd HH:mm:ss} - {Message:lj}{NewLine}{Exception}")
    .WriteTo.Seq("http://localhost:5341") // structured JSON
    .CreateLogger();

// ✅ Structured logging always
Log.Information("Player {PlayerId} created with email {Email}", id, email);

// ❌ Never log sensitive data
// No tokens, passwords, or PII in logs
```

- Console → human-readable plain text (local dev): `[LEVEL] yyyy-MM-dd HH:mm:ss - message`, exception on a new line
  - e.g. `[ERR] 2026-06-26 13:30:31 - Failed to load player` followed by the exception on the next line
- Seq → structured JSON (queryable)
- **OpenTelemetry** for distributed tracing
- Always log **Correlation IDs**
- Use correct log levels: Trace/Debug/Info/Warning/Error/Critical

---

## Testing

**Stack:** xUnit v3, NSubstitute, AutoFixture, AutoFixture.AutoNSubstitute, Testcontainers, Shouldly

```csharp
// ✅ Arrange-Act-Assert always
public async Task GetPlayer_WhenExists_ReturnsPlayerDto()
{
    // Arrange
    var playerId = Guid.NewGuid();
    var expected = new PlayerDto(playerId, "Silver", "silver@test.com");
    _repository.GetByIdAsync(playerId, Arg.Any<CancellationToken>())
               .Returns(expected);

    // Act
    var result = await _service.GetPlayerAsync(playerId, CancellationToken.None);

    // Assert
    result.ShouldNotBeNull();
    result.Name.ShouldBe("Silver");
}
```

### Rules
- Test **behavior**, not implementation — tests must survive refactors
- **Unit tests** — mock boundaries (external APIs), not internals
- **Integration tests** — `WebApplicationFactory` + Testcontainers (real PostgreSQL in Docker)
- Use **AutoFixture** to reduce setup duplication
- No flaky tests — no time-dependent or order-dependent tests
- Tests written **after** implementation

---

## Security

- **JWT** preferred for auth (project-dependent)
- **HMACSHA256** or stronger for token hashing
- **Never** hardcode secrets — Azure Key Vault **or** AWS Secrets Manager in prod, User Secrets locally
- **Always** parameterize SQL (EF Core / Dapper handle this)
- **HTTPS** everywhere — redirect HTTP, set HSTS
- **CORS whitelist** — never `AllowAnyOrigin()` in production
- **Sanitize logs** — no tokens, passwords, PII
- Keep dependencies updated: `dotnet list package --vulnerable`
- Principle of least privilege — users and app credentials

---

## Packages Reference

| Purpose | Package |
|---|---|
| Validation | FluentValidation |
| API Docs | Scalar.AspNetCore |
| Vertical Slice | Plain/custom handlers (WolverineFx only if you need messaging/mediator) |
| Logging | Serilog |
| Tracing | OpenTelemetry |
| Testing | xUnit v3, NSubstitute, AutoFixture, AutoFixture.AutoNSubstitute, Testcontainers, Shouldly |
| Resilience | Polly |
| Mapping | Facet |
| Fake data | Bogus |
| Result pattern | **ErrorOr** — the one result type, never hand-rolled |

### NuGet Policy
- **Pin the latest specific version** — `10.0.1`, never wildcards (`*`, `2.*`, `10.0.*`)
- **Stable releases only**, runtime *and* test — never `rc` / `preview` / `beta`
- Staying one version behind beats shipping a prerelease
- Check for updates periodically, not automatically; record deliberate pins in an ADR

---

## Constants — Never Magic Values

```csharp
// ✅ Always
public static class PlayerConstants
{
    public const int MaxNameLength = 100;
    public const string DefaultRole = "Player";
    public const int MaxPageSize = 50;
}

// ❌ Never
if (name.Length > 100) // what is 100?
```

---

## Anti-Patterns — Never Do These

See full list in references/antipatterns.md

**Critical ones:**
- ❌ God Service / Fat Controller — one thing does too much
- ❌ Anemic Domain Model — entities as property bags
- ❌ N+1 queries — use `Include` or projections
- ❌ `SaveChanges` inside loops
- ❌ Magic numbers/strings
- ❌ `object` or `dynamic`
- ❌ Generic exceptions
- ❌ `.Result` / `.Wait()`
- ❌ `async void`
- ❌ Secrets in `appsettings.json`
- ❌ `new HttpClient()` — use `IHttpClientFactory`
- ❌ Returning domain entities from controllers — use DTOs/records
- ❌ Lazy loading by default in EF Core
- ❌ Long-lived `DbContext`
- ❌ Static everything — makes testing hell
- ❌ Service Locator pattern — use constructor injection
- ❌ Hand-rolled `Result<T>` — `ErrorOr` is the one result type
- ❌ Exceptions for business flow control — return an `Error`
- ❌ Wildcard or prerelease NuGet versions — pin the latest stable

---

## CI/CD & DevOps

- **GitHub Actions** for CI/CD
- **Docker** for containerization
- **Docker Compose** for multi-container local dev
- **.NET Aspire** for microservices orchestration when needed
- **Cloud** — Azure (Key Vault, App Configuration, App Service) **or** AWS (ECS, Secrets Manager, Parameter Store); pick per project
- Conventional commits: `feat:`, `fix:`, `refactor:`
- Small PRs, code reviews with security + perf checklist
- ADRs for architecture decisions
- README with how to run, test, deploy

---

## Naming & Style

- **PascalCase** for Types, Methods, Properties — standard .NET conventions
- **camelCase** for locals and parameters
- **`_camelCase`** for private fields
- **`I` prefix** for interfaces — `IUserRepository`, not `UserRepositoryInterface`
- **No Hungarian Notation** — no `strName`, `intCount`
- **Async methods end with `Async`** — `GetUserAsync`, not `GetUser`
- **Booleans read like questions** — `IsActive`, `HasPermission`, `CanExecute`
- **Avoid abbreviations** — write `user`, not `usr`; `manager`, not `mgr`
- **Don't encode type in name** — `users`, not `userList`

---

## Method & Class Design

- **Methods ~20 lines max** — longer means it's doing too much
- **Max 3-4 parameters** — more than that, use a parameter object/record
- **Return early** — guard clauses beat nested ifs
- **One level of abstraction per method** — don't mix high-level and low-level
- **No output parameters** — use tuples or records for multiple return values
- **No boolean flags as parameters** — `Save(user, true, false)` is unreadable; split methods or use enums
- **Constructor should just assign** — no heavy logic, no I/O, no side effects
- **Prefer immutability** — `readonly` fields, `init` setters, records

```csharp
// ✅ Guard clauses
public async Task<ErrorOr<PlayerDto>> UpdatePlayerAsync(Guid id, UpdatePlayerRequest request, CancellationToken cancellationToken)
{
    if (id == Guid.Empty) return PlayerErrors.InvalidId;
    if (request is null) return PlayerErrors.RequestRequired;

    var player = await _context.Players.FindAsync([id], cancellationToken);
    if (player is null) return PlayerErrors.NotFound;

    // happy path here
}
```

---

## Exception Handling

Exceptions cover the **unexpected only**. Anything a caller could reasonably expect is an `ErrorOr` value — see [Error Handling](#error-handling--erroror).

```csharp
// ✅ Specific, and only for genuine programmer/infrastructure errors
throw new ArgumentNullException(nameof(user));

// ✅ .NET 6+ null guard
ArgumentNullException.ThrowIfNull(param);

// ✅ Preserve stack trace
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to process player {PlayerId}", id);
    throw; // not throw ex;
}

// ❌ Never
throw new Exception("something went wrong");
throw new PlayerNotFoundException(id);   // ← business flow, use PlayerErrors.NotFound
catch (Exception ex) { /* swallowed */ }
```

- **No custom exceptions for domain errors** — `PlayerNotFoundException` is an `Error`, not a `throw`
- **Don't catch what you can't handle** — let it bubble to global handler
- **Never use exceptions for flow control** — return `ErrorOr<T>` instead
- **Log then re-throw OR handle** — never both (double-logging)

---

## Null Handling

```csharp
// ✅ Nullable reference types — project-wide
<Nullable>enable</Nullable>
<TreatWarningsAsErrors>true</TreatWarningsAsErrors>

// ✅ Null-coalescing
var name = player?.Name ?? "Unknown";
player ??= new Player();

// ✅ is not null reads better
if (player is not null) { }

// ❌ Avoid default! — silences compiler but lies to your team
Player player = default!;
```

---

## Collections & LINQ

```csharp
// ✅ Right collection for the job
List<T>              // ordered, index access
HashSet<T>           // uniqueness
Dictionary<K,V>      // lookups

// ✅ Read-only on public APIs
IReadOnlyList<T>
IReadOnlyDictionary<K,V>

// ✅ Any() over Count() > 0 — short-circuits
if (players.Any()) { }

// ✅ Materialize when iterating twice
var list = query.ToList();

// ✅ SingleOrDefault when "exactly one" is a contract
var player = await _context.Players.SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

// ✅ Collection expressions (.NET 8+)
int[] ids = [1, 2, 3];
```

- **Avoid LINQ in hot paths** — allocations and delegate overhead; use `for`/`foreach`
- **Break long LINQ chains** into named variables for readability
- **Select projections in EF** — never load full entities you don't need

---

## Dependency Injection

```csharp
// ✅ Constructor injection by default (primary constructors)
public class PlayerService(IPlayerRepository repository, ILogger<PlayerService> logger);

// ✅ Right lifetime
services.AddSingleton<ITokenHasher, TokenHasher>();   // stateless
services.AddScoped<IPlayerService, PlayerService>();  // per request
services.AddTransient<IEmailSender, EmailSender>();   // cheap, stateless

// ❌ Never inject Scoped into Singleton — captive dependency
// Use IServiceScopeFactory if needed

// ✅ IOptions for config
services.AddOptions<JwtOptions>()
    .BindConfiguration("Jwt")
    .ValidateDataAnnotations()
    .ValidateOnStart();

// ✅ IOptionsSnapshot<T> when you need config reload without restart
```

---

## Advanced Async

```csharp
// ✅ Task.WhenAll for independent parallel operations
var (players, teams) = await (
    _playerRepo.GetAllAsync(cancellationToken),
    _teamRepo.GetAllAsync(cancellationToken)
);

// ✅ ValueTask<T> for hot paths with cached/sync results
public ValueTask<Player?> GetCachedPlayerAsync(Guid id, CancellationToken cancellationToken);

// ✅ await using for IAsyncDisposable
await using var stream = new FileStream(...);
```

---

## Advanced EF Core Patterns

```csharp
// ✅ HasQueryFilter for multi-tenancy — auto-filter by TenantId
protected override void OnModelCreating(ModelBuilder builder)
{
    builder.Entity<Player>().HasQueryFilter(p => p.TenantId == _tenantId);
}

// ✅ Compiled queries for hot read paths
private static readonly Func<AppDbContext, Guid, Task<PlayerDto?>> GetPlayerQuery =
    EF.CompileAsyncQuery((AppDbContext ctx, Guid id) =>
        ctx.Players
           .Where(p => p.Id == id)
           .Select(p => new PlayerDto(p.Id, p.Name, p.Email))
           .FirstOrDefault());

// ✅ Owned types for value objects
builder.Entity<Player>().OwnsOne(p => p.Address);

// ✅ Specifications or IQueryable extension methods for reusable queries
public static IQueryable<Player> ActivePlayers(this IQueryable<Player> query)
    => query.Where(p => p.IsActive);
```

---

## Multi-Tenancy

- **Tenant resolution middleware** — extract `X-Tenant-Id` once, store in scoped service
- **Tenant-aware DbContext** — inject tenant, apply global query filters
- **Tenant validation in auth** — token must match tenant header
- **Audit everything tenant-scoped** — like `API.TokenAudit`
- **Per-tenant rate limiting** — don't let one tenant DoS another

```csharp
// ✅ Scoped tenant context
public class TenantContext(IHttpContextAccessor accessor)
{
    public Guid TenantId => Guid.Parse(
        accessor.HttpContext!.Request.Headers["X-Tenant-Id"].ToString());
}
```

---

## Logging Patterns

```csharp
// ✅ Structured logging — named properties
_logger.LogInformation("Token created for {TenantId} by {UserId}", tenantId, userId);

// ❌ Never string interpolation in logs — breaks structured logging
_logger.LogInformation($"Token created for {tenantId}"); // wrong

// ✅ Log scopes for contextual correlation
using (_logger.BeginScope(new { RequestId, TenantId }))
{
    // all logs inside carry RequestId + TenantId
}

// ✅ Source generators for zero-allocation high-perf logging
[LoggerMessage(Level = LogLevel.Information, Message = "Player {PlayerId} created")]
partial void LogPlayerCreated(Guid playerId);
```

---

## Code Smells to Watch

- **Long parameter lists** — group into a record/object
- **Switch on type** — probably needs polymorphism or pattern matching
- **Comments explaining *what*** — code should be self-explanatory; comments explain *why*
- **TODOs older than a sprint** — do it or delete it
- **Methods that lie** — `GetUser()` that also updates state; name it honestly
- **Temporal coupling** — methods that must be called in order without compiler enforcement
- **Train wrecks** — `obj.A().B().C().D()` — Law of Demeter violation

---

## Tooling & Quality

```xml
<!-- .csproj — treat warnings as errors -->
<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
<Nullable>enable</Nullable>
```

- **`.editorconfig`** — enforce style across the team
- **`Microsoft.CodeAnalysis.NetAnalyzers`** + `SonarAnalyzer` + `Roslynator`
- **`dotnet format`** in CI to catch drift
- **Husky.NET** for pre-commit hooks
- **BenchmarkDotNet** for performance — measure, don't guess

---

## Concurrency & Threading

```csharp
// ✅ SemaphoreSlim for async-friendly locking
private readonly SemaphoreSlim _lock = new(1, 1);
await _lock.WaitAsync(cancellationToken);
try { /* critical section */ }
finally { _lock.Release(); }

// ✅ Interlocked for simple counters
Interlocked.Increment(ref _count);

// ✅ Channel<T> for producer/consumer
var channel = Channel.CreateUnbounded<PlayerEvent>();

// ❌ Never lock public objects
lock (this) { } // wrong
lock (_publicList) { } // wrong

// ✅ Private lock object
private readonly object _lock = new();
```

- **Prefer async over threads** — `Task` over `Thread` for I/O
- **Immutability beats locks** — when you can

---

## Modern C# Goodies — C# 14

### Extension Members (C# 14 headline feature)
```csharp
// ✅ Extension blocks — add properties, operators, statics to any type
// Previously only extension methods were possible
extension(Player player)
{
    // Extension property
    public bool IsEligibleForPromotion =>
        player.IsActive && player.Score > 1000;

    // Extension method alongside property
    public string GetDisplayName() =>
        $"{player.Name} ({player.Email})";
}

// Static extension members
extension(Player)
{
    public static Player CreateGuest() =>
        new(Guid.NewGuid(), "Guest", "guest@example.com");
}

// Use like native members
if (player.IsEligibleForPromotion) { }
var guest = Player.CreateGuest();
```

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

### `.csproj` — Always Set
```xml
<PropertyGroup>
  <TargetFramework>net10.0</TargetFramework>
  <LangVersion>14</LangVersion>
  <Nullable>enable</Nullable>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup>
```

---

## References
- `references/antipatterns.md` — Full anti-patterns list (load when doing code review)