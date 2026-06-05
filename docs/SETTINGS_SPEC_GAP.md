# Settings & platform spec — gap checklist

See [SPEC_18_IMAGES.md](./SPEC_18_IMAGES.md) and [../Things to do.md](../Things%20to%20do.md).

## Deferred (explicitly out of scope until requested)

- Live SAML / OAuth login
- ERP connectors, Slack/Teams
- API key REST authentication
- Full multi-module GDPR ZIP
- Live billing / Stripe
- Per-module notification event matrix + recipient rules

## Implemented in repo

Two-tier settings, org fields, users/invites/seats, webhooks, SMTP test, API keys storage, org notifications, digests, retention (manual + nightly), erasure workflow, holidays + business calendar, logo upload, global primary colour, org unit CSV, AI usage/limits/enforcement, `notifyUser` helper.

## SQL + env

See **Things to do.md** setup section.
