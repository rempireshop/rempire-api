# rempire-api

REMPIRE shop rebuild — the commerce backend. Skeleton for now; implementation
starts once Renat's questionnaire answers (see `rempire-web` → `/qa`) fix the
scope.

## Planned stack

Per `REMPIRE Commerce Platform — Claude Code Master Build Prompt.md`:

- ASP.NET Core on .NET 10 LTS, EF Core, PostgreSQL (Npgsql)
- OpenAPI, structured validation/logging, health endpoints, rate limiting
- Hosting: Railway (API + PostgreSQL), Cloudflare R2 for media/documents
- Payment abstraction (Montonio/Stripe candidates), shipping abstraction
  (Montonio Shipping first candidate), Resend for email
- Migration tooling from the existing Shopify shop (rempireshop.com)

Reference projects: `Estoria` (backend patterns), `estoria-luxury-builders`.

## Structure (planned)

```
src/Rempire.Api/          ASP.NET Core host
src/Rempire.Domain/       commerce domain model
src/Rempire.Infrastructure/  EF Core, providers, integrations
tests/
docs/
```

Nothing here is scaffolded yet on purpose — the domain model follows the
answers, not the other way round.
