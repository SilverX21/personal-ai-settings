---
name: dotnet-master
description: >
  .NET and C# engineering standards. Load for any .NET or C# task — APIs, architecture,
  code review, EF Core, testing, project configuration, packaging, or deployment of a
  .NET application. Triggers on .NET, C#, ASP.NET Core, EF Core, Minimal APIs, MSBuild,
  NuGet, xUnit, or any .NET SDK topic, and on .NET project files (.cs, .csproj, .sln,
  .slnx, Directory.Build.props, Directory.Packages.props, global.json, NuGet.config).
  Not a general-purpose software-engineering skill — do not load it for work that is not
  .NET.
---

# .NET Master

Engineering standards for .NET applications and libraries.

## Scope

**In scope.** C#, F#/VB when part of a .NET solution, the .NET SDK and CLI, ASP.NET Core,
EF Core, MSBuild, NuGet, .NET analyzers, and the files that configure them: `*.cs`,
`*.csproj` / `*.fsproj` / `*.vbproj`, `*.sln` / `*.slnx`, `Directory.Build.props`,
`Directory.Build.targets`, `Directory.Packages.props`, `global.json`, `NuGet.config`, and
`.editorconfig` rules that apply to .NET.

**Out of scope.** A .NET repository legitimately contains TypeScript, SQL, Dockerfiles,
YAML, Terraform, and shell scripts. Read them when you need to understand how the .NET
project is built, configured, tested, or deployed — **never analyze, reformat, lint, or
"fix" them under these standards.** They have their own.

**Modification boundary.** Change a file only when the task requires it. Identify the
project first, then the files that matter. Never edit a file merely because it turned up
in a search, and never touch generated output (`bin/`, `obj/`, `*.g.cs`, `*.Designer.cs`).

---

## Version awareness — read this before recommending anything

These standards describe **.NET 10 / C# 14**. Projects on older versions are normal and
not defects.

1. **Check the target before advising.** Read `TargetFramework(s)` and `LangVersion` from
   the `.csproj`, plus `Directory.Build.props` and `global.json`. When they disagree, the
   project file wins for the project; `global.json` pins the SDK.
2. **Never recommend an API the target framework doesn't have.** `TimeProvider` needs
   net8.0+; `ExecuteUpdateAsync` needs EF Core 7+; C# 14 extension members need
   `LangVersion` 14.
3. **Don't propose a framework upgrade** unless the task asks for one or the target is out
   of support. Say what the upgrade would buy, then let the owner decide.
4. **Name the version** whenever guidance is version-sensitive ("EF Core 8+", "net9.0+").
5. **Never recommend anything prerelease.** Preview/experimental **APIs** ship inside the
   stable SDK and are opt-in per feature — flag them as preview and let the owner choose.
   Prerelease **NuGet packages** are a different matter: they are forbidden outright (see
   NuGet policy). Don't blur the two.
6. **Prefer official Microsoft documentation** for version-sensitive behavior over blog
   posts or memory.

---

## Core Principles

- **Separation of Concerns** — the primary structural principle. Each unit owns one
  responsibility: HTTP/transport, application/use-case logic, domain rules, persistence,
  external integrations, configuration, and cross-cutting concerns stay distinct and
  depend inward. SoC is about **boundaries, not folder count** — it does not mandate Clean
  Architecture, Vertical Slice, CQRS, or DDD. Achieve it with the least structure the
  problem needs.
- **SOLID** — with SRP and DIP doing most of the work in practice
- **KISS** — the simplest design that satisfies the requirement
- **YAGNI** — no speculative extensibility, no abstraction with one implementation
- **DRY** — with judgment; some duplication beats the wrong abstraction
- **Fail Fast** — validate at trust boundaries and reject bad input immediately. *How* you
  report the failure depends on the layer: expected/business failures return `ErrorOr`,
  programmer errors and broken invariants throw (see Error Handling).
- **Boy Scout Rule** — scoped to the files the task already touches

### Avoid over-engineering

Do not add an interface with one implementation, a repository that only wraps
`DbContext`, a mediator for in-process calls, a mapper for two properties, or a new
project to hold three classes. Each layer must earn its place by removing real coupling
or enabling a test you otherwise couldn't write.

---

## Stack defaults

Sensible defaults, **not requirements** — a project's existing choices win.

| Concern | Default | Note |
|---|---|---|
| Runtime / language | .NET 10 / C# 14 | Respect the project's actual target |
| Database | PostgreSQL or SQL Server | Whatever the project already uses |
| Logging | `Microsoft.Extensions.Logging` | Serilog when structured sinks are needed |
| Validation | FluentValidation, or `IValidatableObject` / DataAnnotations for simple cases | |
| Result type | `ErrorOr` | Or a minimal hand-rolled `Result<T>` if the dependency isn't allowed — one type per solution |
| Resilience | `Microsoft.Extensions.Http.Resilience` | Wraps Polly; prefer it over raw Polly for HTTP |
| Testing | xUnit + NSubstitute + Testcontainers | See Testing |

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

Separation of Concerns is the requirement. A named architecture is one way to get it, not
the goal. Start at the smallest structure that separates the concerns this project
actually has, and add structure only when a concrete pressure demands it.

| Pressure you actually have | Structure that answers it |
|---|---|
| CRUD over a few tables | One project. Separate endpoint / service / data access as classes, not projects. |
| Business rules worth protecting from EF and HTTP | Split the domain out; keep infrastructure behind interfaces it defines |
| Many independent features, low shared logic | Vertical slices — one folder per feature, plain handlers |
| Read and write models genuinely diverge | CQRS on the paths where they diverge, not repo-wide |
| A rich, invariant-heavy domain | DDD tactical patterns where the invariants live |

Clean Architecture, Hexagonal/Onion, Vertical Slice and DDD are all acceptable. What is
not acceptable is adopting one wholesale before the pressure exists.

**Signals you have over-engineered:** projects that only pass calls through, an interface
per class, a mediator dispatching to a single handler, DTOs that mirror entities field for
field. Collapse them.

**Mediator libraries** (MediatR, WolverineFx): use only for what they uniquely provide —
messaging, queuing, out-of-process dispatch, or pipeline behaviors you actually use.
In-process request/response is a method call.

---

## Project & Build Configuration

Repo-wide settings belong in repo-wide files. Copy-pasting the same property into twenty
`.csproj` files is the MSBuild equivalent of not having a constant.

| File | Scope | Holds |
|---|---|---|
| `global.json` | Repo | SDK version pin + `rollForward` policy |
| `Directory.Build.props` | All projects below it | `TargetFramework`, `LangVersion`, `Nullable`, analyzers |
| `Directory.Build.targets` | All projects below it | Custom targets, conditional tweaks |
| `Directory.Packages.props` | Repo | Central Package Management — every package version, once |
| `NuGet.config` | Repo | Feeds and `packageSourceMapping` |
| `.editorconfig` | Repo | Style rules + analyzer severity |
| `*.csproj` | One project | Only what is genuinely project-specific |

### The common baseline

```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
  </PropertyGroup>
</Project>
```

Each `.csproj` then carries only what differs — its `OutputType`, its `ProjectReference`s,
its `IsPackable`.

### Test projects relax the warning gate

`TreatWarningsAsErrors` belongs on production code. In test projects it mostly fires on
things tests do deliberately — nullability in arrange blocks, unused locals, deliberately
obsolete APIs under test — so it costs time without catching bugs. Turn it off there, and
keep the analyzers running as warnings.

```xml
<!-- tests/Directory.Build.props — sits beside the test projects -->
<Project>
  <!-- Import the root file first, then override it. -->
  <Import Project="$([MSBuild]::GetPathOfFileAbove($(MSBuildThisFileFile), $(MSBuildThisFileDirectory)..))" />

  <PropertyGroup>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <IsPackable>false</IsPackable>
    <!-- Common in tests and not worth failing a build over. -->
    <NoWarn>$(NoWarn);CS1591;CA1707;xUnit1041</NoWarn>
  </PropertyGroup>
</Project>
```

> **Why a folder-scoped file and not `Condition="'$(IsTestProject)' == 'true'"` in the root
> props:** `IsTestProject` is set by `Microsoft.NET.Test.Sdk`, which is imported *after*
> `Directory.Build.props` is evaluated — so that condition is silently false at the moment
> it's read. Either scope by folder as above, or put the override in
> `Directory.Build.targets`, which MSBuild evaluates late enough for `IsTestProject` to
> exist.

### Central Package Management

`Directory.Packages.props` removes version drift between projects — the most common cause
of "builds in the API, fails in Tests".

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="ErrorOr" Version="2.0.1" />
  </ItemGroup>
</Project>
```

Projects then reference without a version: `<PackageReference Include="ErrorOr" />`.

### Pin the SDK

```json
// global.json
{ "sdk": { "version": "10.0.100", "rollForward": "latestFeature" } }
```

Without it, CI and each developer machine can silently build on different SDKs.

### NuGet policy

- **Pin an exact version** — `10.0.1`, never a wildcard (`*`, `2.*`, `10.0.*`)
- **Prereleases are forbidden.** No `-preview`, `-rc`, `-beta`, `-alpha`, `-dev`, or
  nightly — production **and** test projects alike. This is not a default to weigh against
  other factors; it is a hard rule.
  - A package whose only release is a prerelease is **not adoptable**. Use the last stable
    major, or a different package, or write the few lines yourself.
  - "The stable version is old" is not an exception. "The prerelease fixes my bug" is not
    an exception — pin the stable version and work around the bug.
  - The only way in is an explicit, recorded decision by the repo owner in an ADR, naming
    the package, the version, and the removal trigger.
  - Enforce it: `<CentralPackageFloatingVersionsEnabled>false</CentralPackageFloatingVersionsEnabled>`,
    and fail CI on any `-` in a resolved version.
- **`packageSourceMapping`** in `NuGet.config` whenever you use a feed besides nuget.org —
  it is the defense against dependency-confusion attacks
- Update deliberately, not automatically; record intentional pins where the team finds them
- `dotnet list package --vulnerable --include-transitive` in CI

### Analyzers and formatting

- `EnableNETAnalyzers` + `AnalysisLevel` are built in — no package required
- `.editorconfig` carries style and per-rule severity. Escalate a rule to `error` only when
  the team will actually fix it, or `TreatWarningsAsErrors` becomes noise people suppress.
- `dotnet format --verify-no-changes` in CI catches drift
- SonarAnalyzer / Roslynator / Husky.NET / BenchmarkDotNet are optional additions, never
  requirements — add one when it answers a problem you have

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

## Async

- **Async all the way down** — endpoint → service → repository → DB
- **Always flow `CancellationToken`** through the entire chain
- **No `async void`** — use `async Task`. The one exception is an event handler, which
  must then catch everything inside; an escaping exception there kills the process.
- **No `.Result` / `.Wait()` / `.GetAwaiter().GetResult()`** — always `await`
- **No fire-and-forget** without exception handling. Background work belongs in an
  `IHostedService` / `BackgroundService`, not a discarded `Task`.

### `ConfigureAwait` — depends on the project type

| Project | Guidance |
|---|---|
| ASP.NET Core app | Omit it. There is no synchronization context, so it does nothing. |
| **Class library** | Use `ConfigureAwait(false)` — the library cannot know its caller has no context. This is Microsoft's guidance and is **not** an anti-pattern. |

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

### Parallel and hot paths

```csharp
// ✅ Independent work in parallel — start both, then await
var playersTask = _playerRepo.GetAllAsync(cancellationToken);
var teamsTask   = _teamRepo.GetAllAsync(cancellationToken);
await Task.WhenAll(playersTask, teamsTask);
var players = await playersTask;
var teams   = await teamsTask;

// ✅ ValueTask<T> for hot paths that usually complete synchronously (e.g. a cache hit).
//    Await it exactly once, never store it.
public ValueTask<Player?> GetCachedPlayerAsync(Guid id, CancellationToken cancellationToken);

// ✅ await using for IAsyncDisposable
await using var stream = new FileStream(path, FileMode.Open);
```

`Task.WhenAll` surfaces only the first exception when awaited directly — inspect
`task.Exception` or await each task when you need all of them.

---

## Time — `DateTime`, `DateTimeOffset`, `TimeProvider`

### Choosing the type

| Use | Type |
|---|---|
| An instant in time (created, expires, logged) | `DateTimeOffset` — carries the offset, unambiguous |
| A calendar date with no time (birthday, check-in) | `DateOnly` — no fake midnight |
| A wall-clock time with no date (opening hours) | `TimeOnly` |
| A duration | `TimeSpan` |
| A future local time in a named zone (scheduling, recurrence) | Store the local time **plus the IANA zone id**, resolve with `TimeZoneInfo` |

Persist instants in **UTC**. Convert to a user's zone only at the presentation edge.
`DateTime` with `Kind` is legacy — prefer `DateTimeOffset` for new code, and never let a
`DateTime.Kind` of `Unspecified` cross a boundary.

A UTC instant is not enough for future events: "09:00 next March in Lisbon" must survive a
DST rule change, which only the zone id preserves.

### `TimeProvider` (net8.0+) — inject the clock

Reading `DateTime.UtcNow` directly inside business logic makes that logic untestable —
you cannot write a test for "expires after 30 days" without waiting or hacking the system
clock. Depend on `TimeProvider` instead.

```csharp
// ✅ Injected clock — testable
public class SubscriptionService(TimeProvider timeProvider)
{
    public bool IsExpired(Subscription subscription) =>
        subscription.ExpiresAt <= timeProvider.GetUtcNow();
}

// Registration
builder.Services.AddSingleton(TimeProvider.System);

// Test — Microsoft.Extensions.TimeProvider.Testing
var time = new FakeTimeProvider(DateTimeOffset.Parse("2026-01-01T00:00:00Z"));
var sut  = new SubscriptionService(time);
time.Advance(TimeSpan.FromDays(31));
sut.IsExpired(subscription).ShouldBeTrue();
```

`TimeProvider` also abstracts the things that are otherwise untestable:

```csharp
await Task.Delay(TimeSpan.FromMinutes(5), timeProvider, cancellationToken);
using var timer = timeProvider.CreateTimer(callback, state, dueTime, period);
```

**Use `TimeProvider` for:** expiry and TTL logic, scheduling, retry/backoff, timers,
delays, audit timestamps, and any time-dependent branch you want to test.

**Don't bother for:** logging timestamps (the logger stamps them), `[CreatedAt]` columns
the database defaults, or one-off scripts. `TimeProvider` replaces *ambient clock reads in
logic under test* — it does not replace `DateTime`/`DateTimeOffset` as types.

For a project below net8.0, use a small `IClock` interface with the same shape, and
migrate to `TimeProvider` when the target moves.

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

- **Never throw for business flow control** — no `PlayerNotFoundException`, no `DuplicateEmailException`
- Exceptions are for the **unexpected only** — infrastructure failures and bugs
- **One result type per solution.** The rule is consistency, not the brand.

### When `ErrorOr` isn't available

Some projects can't take the dependency — an approval process, an air-gapped feed, a
policy against third-party packages. That's a legitimate reason to hand-roll, and the
fallback is a **minimal** result type, not a framework.

```csharp
public readonly record struct Error(string Code, string Description);

public readonly struct Result<T>
{
    private readonly T? _value;
    private Result(T value)   { _value = value; Error = null; IsError = false; }
    private Result(Error err) { _value = default; Error = err; IsError = true; }

    public bool IsError { get; }
    public Error? Error { get; }
    public T Value => IsError
        ? throw new InvalidOperationException("No value on a failed result.")
        : _value!;

    public static Result<T> Ok(T value)     => new(value);
    public static Result<T> Fail(Error err) => new(err);

    public static implicit operator Result<T>(T value)   => Ok(value);
    public static implicit operator Result<T>(Error err) => Fail(err);

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<Error, TOut> onError) =>
        IsError ? onError(Error!.Value) : onSuccess(_value!);
}
```

Keep it to that shape: implicit conversions so returns stay terse, and `Match` so
endpoints map to `ProblemDetails` the same way. **Don't** grow it into a full monad —
no `Bind`, `Then`, `Tap`, or `Map` chains unless the codebase genuinely uses them.

**Decide once, at the solution level.** Two result types in one codebase is worse than
either alone. If `ErrorOr` is already present, use it and delete the hand-rolled one.

### Exceptions — the unexpected only

Anything a caller could reasonably expect is an `Error` value. Exceptions are for
programmer mistakes, broken invariants, and infrastructure failures.

```csharp
// ✅ Specific, and only for the genuinely exceptional
ArgumentNullException.ThrowIfNull(player);
ArgumentOutOfRangeException.ThrowIfNegative(quantity);

// ✅ Preserve the stack trace when rethrowing
catch (DbUpdateException ex)
{
    _logger.LogError(ex, "Failed to persist player {PlayerId}", id);
    throw;              // not `throw ex;`
}

// ❌ Never
throw new Exception("something went wrong");        // always a specific type
throw new PlayerNotFoundException(id);              // business flow → PlayerErrors.NotFound
catch (Exception ex) { /* swallowed */ }
```

- **No custom exceptions for domain errors** — "not found" is an `Error`, not a `throw`
- **Don't catch what you can't handle** — let it reach the global handler
- **Log then rethrow, OR handle** — never both, or you double-log

### Global exception middleware

Use `IExceptionHandler` (net8.0+) registered via `AddExceptionHandler`, or
`UseExceptionHandler` on older targets.

- One place maps unhandled exceptions to `ProblemDetails`
- Map per exception type; never leak stack traces or internal detail to clients
- Return `500` for the genuinely unexpected — a handled business failure never gets here

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

| Package | Role |
|---|---|
| `xunit.v3` | Test framework |
| `NSubstitute` | Substitutes for boundaries |
| `AutoFixture` | Generates anonymous test data — kills Arrange boilerplate |
| `AutoFixture.AutoNSubstitute` | Turns AutoFixture into an auto-mocking container (NSubstitute-backed) |
| `AutoFixture.Xunit3` | `[Theory, AutoData]` / `[InlineAutoData]` for **xUnit v3** |
| `Testcontainers` | Real dependencies in Docker for integration tests |
| `Shouldly` | Assertions |

> **Pick the adapter that matches your xUnit major version.** `AutoFixture.Xunit2` is for
> xUnit v2; **`AutoFixture.Xunit3` is the one for xUnit v3**. Mixing them gives a test
> project that compiles but discovers no theories.
>
> **Stay on AutoFixture 4.x.** As of August 2026, 4.x is the stable line
> (`AutoFixture` / `AutoFixture.AutoNSubstitute` 4.18.1, `AutoFixture.Xunit3` 4.19.0);
> **5.0.0 has only ever shipped as `-preview`**, so it is barred by the NuGet policy above.
> Minor-version skew *between* AutoFixture family packages is normal — don't force them to
> a single version. 4.x targets netstandard2.0/net8.0 and runs fine on .NET 10.

### Auto-mocking with AutoFixture + NSubstitute

```csharp
// Option A — explicit fixture, full control
var fixture = new Fixture().Customize(new AutoNSubstituteCustomization
{
    ConfigureMembers = true   // substitute members return AutoFixture-generated values
});
var repository = fixture.Freeze<IPlayerRepository>();  // same instance the SUT receives
var sut = fixture.Create<PlayerService>();             // dependencies auto-substituted

// Option B — declarative, via a reusable attribute
public class AutoNSubstituteDataAttribute()
    : AutoDataAttribute(() => new Fixture().Customize(new AutoNSubstituteCustomization()));

[Theory, AutoNSubstituteData]
public async Task GetPlayer_WhenMissing_ReturnsNotFound(
    [Frozen] IPlayerRepository repository,   // [Frozen] = the instance the SUT gets
    PlayerService sut,                        // built with the frozen substitute
    Guid playerId)                            // anonymous data, no hand-written setup
{
    repository.GetAsync(playerId, Arg.Any<CancellationToken>()).Returns((Player?)null);

    var result = await sut.GetAsync(playerId, CancellationToken.None);

    result.IsError.ShouldBeTrue();
}
```

`[Frozen]` is the piece that matters: it pins one instance for a type so the substitute you
configure is the same one injected into the SUT. Without it you configure a different
object than the code under test uses.

**Where AutoFixture pays off:** wide constructors, DTOs with many properties, and values the
test doesn't care about. **Where to skip it:** when the specific value *is* the point —
write the literal, so the test reads as its own documentation.

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
- Use **AutoFixture** for values the test doesn't care about; write literals for the ones it does
- No flaky tests — no time-dependent or order-dependent tests. Inject `TimeProvider`
  instead of reading the clock, and never `Thread.Sleep` to wait for something.
- **When** tests get written (before, after, alongside) is a team choice, not a rule here.
  What matters is that the failure paths are covered before the change ships.

---

## Security

- **Use the platform's auth**, don't build your own — ASP.NET Core Identity, an OIDC
  provider, or JWT bearer, whichever fits. Never hand-roll password hashing or token
  signing.
- **Passwords:** ASP.NET Core Identity's hasher, or Argon2/PBKDF2 with a per-user salt.
  Plain `HMACSHA256` is for signing/HMAC, **not** for storing passwords.
- **Never** hardcode secrets — a managed secret store in prod (Azure Key Vault, AWS
  Secrets Manager, or the platform equivalent), User Secrets locally
- **Always** parameterize SQL (EF Core / Dapper handle this)
- **HTTPS** everywhere — redirect HTTP, set HSTS
- **CORS whitelist** — never `AllowAnyOrigin()` in production
- **Sanitize logs** — no tokens, passwords, PII
- Keep dependencies updated: `dotnet list package --vulnerable`
- Principle of least privilege — users and app credentials

---

## Packages Reference

Starting points, not mandates. **Prefer what the platform already gives you** — a package
must earn its place. An existing project's choices always win over this table.

| Purpose | Default | In the box already? |
|---|---|---|
| Result pattern | **ErrorOr**; a minimal hand-rolled `Result<T>` when it can't be referenced | no |
| Validation | FluentValidation | DataAnnotations covers simple cases |
| Logging | `Microsoft.Extensions.Logging`; Serilog for richer sinks | yes |
| Tracing / metrics | OpenTelemetry | yes (`System.Diagnostics`) |
| HTTP resilience | `Microsoft.Extensions.Http.Resilience` (wraps Polly) | yes, as a MS package |
| Serialization | `System.Text.Json` + source generation | yes |
| API docs | `Microsoft.AspNetCore.OpenApi`, rendered by Scalar or Swagger UI | yes (OpenAPI) |
| Testing | xUnit, NSubstitute, Testcontainers, Shouldly/`Assert` | no |
| Fake data | Bogus | no |
| Mapping | Hand-written, or a source-generated mapper (Mapperly, Facet) | — |

**Mapping:** a record projection written by hand is usually clearer and faster than any
mapper. Reach for a source-generated mapper only when the mappings are numerous and dull.
Avoid reflection-based mappers — they defeat trimming and hide breaking changes.

### Serialization

```csharp
// ✅ Source-generated context — faster, allocation-free, and trim/AOT-safe
[JsonSerializable(typeof(PlayerDto))]
internal partial class AppJsonContext : JsonSerializerContext;

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));
```

Reflection-based `System.Text.Json` still works, but source generation is the default for
new code and is **required** under trimming or Native AOT.

### Trimming and Native AOT

Only relevant if you actually publish trimmed or AOT (small containers, fast cold start,
CLI tools). When you do: set `<PublishTrimmed>` / `<PublishAot>`, use source-generated
JSON and logging, and expect reflection-heavy libraries (many mappers, some ORMs and DI
extensions) to break. Minimal APIs support AOT; MVC does not. Don't enable it
speculatively — it constrains every library choice downstream.

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
- ❌ *Two* result types in one solution — pick one (`ErrorOr`, else a minimal custom `Result<T>`)
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

// ✅ IOptionsSnapshot<T> (scoped) for reload without restart;
//    IOptionsMonitor<T> when a singleton needs to observe changes
```

### Keyed services (net8.0+)

Several implementations of one interface, chosen by key — replaces the hand-rolled
factory/switch that used to be necessary.

```csharp
services.AddKeyedScoped<IPaymentProvider, StripeProvider>("stripe");
services.AddKeyedScoped<IPaymentProvider, PayPalProvider>("paypal");

public class CheckoutService([FromKeyedServices("stripe")] IPaymentProvider provider);
```

Use it when the key is genuinely static. When the key is chosen at runtime from data,
inject `IServiceProvider` and call `GetRequiredKeyedService`, or keep a small explicit
factory — that stays easier to test.

### Validate the container

`ValidateOnBuild` + `ValidateScopes` turn captive dependencies and missing registrations
into startup failures instead of production surprises. Both are on by default in
Development; enable them everywhere.

```csharp
builder.Host.UseDefaultServiceProvider(o =>
{
    o.ValidateOnBuild = true;
    o.ValidateScopes  = true;
});
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


## Code Smells to Watch

- **Long parameter lists** — group into a record/object
- **Switch on type** — probably needs polymorphism or pattern matching
- **Comments explaining *what*** — code should be self-explanatory; comments explain *why*
- **TODOs older than a sprint** — do it or delete it
- **Methods that lie** — `GetUser()` that also updates state; name it honestly
- **Temporal coupling** — methods that must be called in order without compiler enforcement
- **Train wrecks** — `obj.A().B().C().D()` — Law of Demeter violation

---

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

## Modern C# — C# 14

Extension members, the `field` keyword, null-conditional assignment, partial
constructors, implicit span conversions, `nameof` on unbound generics.

Full detail with examples: `references/csharp-14.md` — load it when the task calls for
these features. Gate every one on `LangVersion` 14.


## References

Load on demand — not part of the baseline context.

- `references/antipatterns.md` — full anti-patterns list (load for code review)
- `references/csharp-14.md` — C# 14 language features (load when using them)
