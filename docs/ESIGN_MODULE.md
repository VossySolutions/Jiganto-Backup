# e-Sign Module (Module 18)

Jiganto e-Sign (`/modules/e-sign` or `/esign`) manages document sign-off requests, signing portals, audit trails, and signed PDFs.

## Environment variables

See `.env.example` — e-Sign section. Minimum for local dev:

```env
APP_URL=http://localhost:5000
QTSP_PROVIDER=mock          # enables AdES in compose UI + mock QTSP audit events
# RESEND_API_KEY=re_xxxx    # real signing emails (else console log in dev)
```

Run `npm run db:patch-esign` after pulling schema changes.

## Setup

```bash
npm run db:patch-esign    # apply schema patches
npm run db:seed-esign     # demo data (needs users + projects)
npm run smoke:esign       # API smoke test (dev server running)
```

## Features

- **Compose wizard** — upload (incl. DOCX→PDF), Jiganto doc, inline HTML, or system template
- **Sequential / parallel** signing with email invitations
- **Signing portal** — draw, type, or upload signature; read-to-bottom; acknowledgements
- **Phase 2** — OTP email verification (eIDAS SES), eIDAS consent checkbox, field-level PDF placement
- **Signature levels** — SES (default) or AdES when QTSP is configured
- **In-flight add signer**, remove unsigned signer, remind, void, duplicate, save as template
- **Audit trail** + downloadable audit PDF and signed PDF (incl. partial progress PDF)
- **Daily jobs** — expiry + 48h auto-reminder

## Routes

| Path | Purpose |
|------|---------|
| `/modules/e-sign` | Main dashboard (canonical) |
| `/esign` | Alias to dashboard |
| `/sign/:token` | Public signing portal |

## Deep-link query params

Open compose pre-filled from other modules:

| Param | Source | Example |
|-------|--------|---------|
| `compose=1` | Required | |
| `request={id}` | Any module | `/modules/e-sign?request=42` |
| `jigantoDocId` + `jigantoDocTitle` | Documents | `?compose=1&jigantoDocId=5&jigantoDocTitle=SOW` |
| `crmContractId` + `crmContractTitle` | CRM Contracts | `?compose=1&crmContractId=3&crmContractTitle=MSA` |
| `projectId` + `deliverableId` + `deliverableTitle` | Deliverables | `?compose=1&projectId=1&deliverableId=4&deliverableTitle=UAT` |
| `testCycleId` + `testCycleName` + metrics | Test Management | `?compose=1&testCycleId=7&testCycleName=UAT+Sprint+3` |

When all signers complete a request linked to a **deliverable**, the deliverable status is set to **Completed** automatically.

## Integrations

- **Documents** — Sign-off tab + “Send for Sign-off” from editor
- **CRM Contracts** — Send for sign-off action + status badge
- **Projects / Deliverables** — Request e-Sign on Sign-off deliverables
- **Finance / Timesheets** — E-Sign approval from pending timesheets
- **Test Management** — Request e-Sign from completed UAT cycles (UAT template pre-filled)
- **Tasks** — sign-off task type (backend)

## QTSP / AdES (Phase 3)

Advanced Electronic Signatures require a Qualified Trust Service Provider:

```env
QTSP_PROVIDER=mock          # dev: logs mock timestamp in audit trail
# QTSP_PROVIDER=docusign    # production: wire provider + credentials below
QTSP_API_KEY=...
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_ACCOUNT_ID=...
DOCUSIGN_USER_ID=...
```

Set signature level to **AdES** in compose settings (enabled when `GET /api/esign/qtsp-status` returns `adesAvailable: true`). On completion, a `qtsp_timestamp` audit event is recorded.

**Note:** `docusign` / `globalsign` providers are scaffolded — production AdES requires completing the provider API integration in `server/signoff/qtsp.ts`.

## Email

Invitations and reminders use `sendOrgEmail`. Configure `RESEND_API_KEY` or SMTP in production; dev falls back to console logging.

## API smoke test

```bash
npm run smoke:esign
```

Covers create, fields, send, sign, OTP, void, templates, signed PDF, and filters.
