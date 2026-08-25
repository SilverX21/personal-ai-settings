# .NET Anti-Patterns Reference

## General OOP & Design
- ❌ **God Object/Class** — one class knows or does too much, violates SRP
- ❌ **Blob** — class with tons of attributes and procedural methods
- ❌ **Spaghetti Code** — tangled control flow, no clear structure
- ❌ **Lasagna Code** — excessive layering where every call passes through 10 useless layers
- ❌ **Ravioli Code** — too many tiny disconnected classes, no big picture
- ❌ **Golden Hammer** — using your favorite pattern for every problem
- ❌ **Magic Numbers/Strings** — use a Constants class
- ❌ **Copy-Paste Programming** — extract reusable methods, violates DRY
- ❌ **Cargo Cult Programming** — using patterns you don't understand
- ❌ **Premature Optimization** — optimize after measuring, not before
- ❌ **Reinventing the Wheel** — use the framework or NuGet
- ❌ **Boat Anchor** — unused code "just in case"
- ❌ **Dead Code** — delete it, Git remembers
- ❌ **Lava Flow** — old undocumented code nobody dares touch
- ❌ **Yo-Yo Problem** — inheritance hierarchies too deep

## SOLID Violations
- ❌ **SRP violation** — classes/methods doing more than one thing
- ❌ **OCP violation** — modifying existing classes instead of extending
- ❌ **LSP violation** — subclasses breaking base class contract (e.g. `NotImplementedException`)
- ❌ **ISP violation** — fat interfaces forcing unused method implementations
- ❌ **DIP violation** — high-level modules depending on concrete low-level classes

## C# Specific
- ❌ **async void** — use `async Task`, except event handlers
- ❌ **.Result / .Wait()** — always `await`, deadlock risk
- ❌ **Sync over Async** — calling async code synchronously
- ❌ **Fire-and-Forget Tasks** — silent failures
- ❌ **Not Disposing IDisposable** — use `using` or `await using`
- ❌ **String Concatenation in Loops** — use `StringBuilder`
- ❌ **Catching base Exception** — catch specific, log properly
- ❌ **Exception-Driven Flow Control** — don't use try/catch as if/else
- ❌ **Returning null instead of empty collections** — return `[]` or `Enumerable.Empty<T>()`
- ❌ **Multiple Enumeration of IEnumerable** — materialize with `.ToList()` if needed
- ❌ **Misusing IQueryable vs IEnumerable** — don't return IQueryable from repos
- ❌ **Static Everything** — makes testing hell, hidden coupling
- ❌ **Service Locator Pattern** — hides dependencies, use constructor injection
- ❌ **Anemic Domain Model** — entities as property bags, logic all in services
- ❌ **Primitive Obsession** — use value objects (Email, Money, TenantId)
- ❌ **object or dynamic types** — always use specific types
- ❌ **Leaky Abstractions** — interfaces exposing implementation details
- ❌ **Reinventing DI Containers** — use built-in IServiceCollection

## ASP.NET / Web API Specific
- ❌ **Fat Controllers** — move business logic to services/handlers
- ❌ **Returning Domain Entities from Controllers** — use DTOs/records
- ❌ **No Input Validation** — always use FluentValidation
- ❌ **Ignoring Cancellation Tokens** — pass them everywhere
- ❌ **N+1 Queries** — use Include or projections
- ❌ **Over-fetching with EF Core** — project to DTOs with Select + records
- ❌ **Secrets in appsettings.json** — use Azure Key Vault / User Secrets

## Database / EF Core
- ❌ **Lazy Loading by Default** — be explicit
- ❌ **Not using AsNoTracking()** — use on all read-only queries
- ❌ **Massive DbContext** — split by bounded context
- ❌ **Raw SQL Without Parameters** — SQL injection risk
- ❌ **Long-Lived DbContext** — scope per request/operation
- ❌ **Missing Indexes** — profile first, then add
- ❌ **SaveChanges Inside Loops** — batch and save once

## Testing Anti-Patterns
- ❌ **Testing Implementation Instead of Behavior** — tests break on refactor
- ❌ **Mocking Everything** — mock boundaries, not internals
- ❌ **No Tests** — always have unit + integration tests
- ❌ **Flaky Tests** — no time-dependent or order-dependent tests
- ❌ **Test Code Duplication** — use AutoFixture builders/fixtures

## Architecture / Process
- ❌ **Architecture Astronaut** — over-engineering with YAGNI violations
- ❌ **Vendor Lock-in by Accident** — be intentional about cloud coupling
- ❌ **Distributed Monolith** — microservices sharing a DB, worst of both worlds
- ❌ **Shotgun Surgery** — one change requires edits across dozens of files
- ❌ **Feature Envy** — method using another class's data more than its own
- ❌ **Shiny Object Syndrome** — chasing new frameworks instead of shipping