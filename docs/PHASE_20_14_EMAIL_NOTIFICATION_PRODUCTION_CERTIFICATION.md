# Phase 20.14 Email & Notification Production Certification

## Provider and domain reconciliation

Live Resend reconciliation was performed without changing provider configuration or exposing API-key token values.

Observed state:

- Sending domain: `rcitcs.com`
- Domain status: verified
- Region: `eu-west-1`
- Sending: enabled
- DKIM: verified
- Return-path MX/SPF: verified
- Tracking CNAME: verified
- Resend API-key inventory exists; only key names/metadata were inspected, never token values.

Aggregate provider delivery metrics for the available production history:

- sent: 22
- delivered: 22
- bounced: 0
- failed: 0
- suppressed: 0
- delivery delayed: 0
- delivery rate: 100%

Representative provider records confirm delivered production paths for:

- administrator password reset from `noreply@rcitcs.com`;
- internal application notification and candidate acknowledgement;
- internal contact notification and visitor acknowledgement;
- administrator contact reply.

Historical application messages predate the Phase 15.8 sender convergence and therefore show the former singular `career@rcitcs.com`. Current source authority resolves both compatibility aliases to the approved `careers@rcitcs.com` identity.

## Database delivery reconciliation

Current production `email_logs` contains only sent rows in the inspected state. Reconciliation found:

- zero non-Resend provider rows;
- zero current sender-contract mismatches since the careers identity convergence;
- zero sent rows missing provider message IDs;
- zero exhausted active retry rows;
- zero missing or duplicate idempotency keys;
- zero failed/error rows;
- zero acknowledgement recipient mismatches;
- zero internal application/contact recipient mismatches;
- zero password-reset recipient mismatches;
- zero candidate/contact admin-reply contract mismatches.

## Failure and retry authority

Non-reset transient provider failures are bounded to five attempts using 5, 15, 60 and 360 minute retry intervals. Permanent failures do not retry. Administrator password-reset delivery is excluded from automatic retry so a stale reset link is not regenerated automatically.

The dispatcher claims queue rows atomically, uses Resend idempotency keys, persists provider message IDs on success and generic bounded failure metadata on failure.

## Secret boundary

`RESEND_API_KEY` is loaded only from the Edge Function environment. Provider token values are not returned from the health endpoint, source-controlled configuration, monitoring snapshot, or browser/admin UI.

## Closure

20.14 closes only when the exact PR head is green, the PR merges with expected-head protection, the merged SHA reaches production, the dedicated health/auth acceptance passes on that merged SHA, and final live Resend/database reconciliation remains clean.
