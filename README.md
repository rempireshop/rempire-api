# rempire-api

**Not used — kept as a research archive.** The planned separate commerce
backend (ASP.NET Core on .NET 10) was never built. The REMPIRE shop that went
live on `https://rempireshop.com` on 08.10.2026 runs entirely in
[`rempire-web`](https://github.com/rempireshop/rempire-web): Next.js 15 on
Vercel, its API as ~70 route handlers under `src/app/api/**`, Postgres on
Railway, Montonio for payments and shipping, Resend for e-mail. Start with
`rempire-web/README.md` and `rempire-web/docs/SYSTEM-MAP.md`.

## What is still worth reading here

- `docs/PAYMENT-PROVIDERS.md`, `docs/COST-COMPARISON.md` — the payment and
  point-of-sale research from August 2026 (Montonio, Stripe, Revolut, SumUp,
  Nexi, the restricted-business check).
- `docs/BARCODE-SCANNING.md` — hardware wedge first, camera as the companion;
  the admin's stock scanner at `/admin/scan` followed it.
- `docs/SHIPPING-RATES.md` — carrier tariffs read on 27.08.2026 (superseded
  by the Montonio contract prices in `rempire-web`).
- `docs/SHOPIFY-CATALOGUE-AUDIT.md`, `docs/PORTABILITY-AND-HANDOVER.md`,
  `data/urls`, `tools/` — the Shopify catalogue and URL inventory used to plan
  the move.

Nothing in this repository is deployed, and no environment reads it.
