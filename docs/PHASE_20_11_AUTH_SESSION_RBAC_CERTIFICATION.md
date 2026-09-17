# Phase 20.11 — Authentication / Authorization / Session / RBAC Certification

## Certification objective

Phase 20.11 certifies the existing administrator security architecture without introducing a second authentication provider or weakening the Phase 9 / Phase 16 controls.

The release boundary requires proof of:

- server-side authentication and authorization authority;
- the single approved active `super_admin` model;
- no public administrator registration path;
- eight-hour absolute session expiry;
- thirty-minute authoritative idle expiry;
- one unrevoked session per administrator with prior-session revocation;
- opaque 256-bit session and CSRF values with only SHA-256 hashes persisted;
- `HttpOnly`, `Secure`, `SameSite=Strict`, bounded session cookies;
- same-origin / Fetch Metadata request validation;
- CSRF verification for protected mutations;
- independent `super_admin` checks in Jobs, Applications and Contacts;
- browser-role denial for credential/session database helpers;
- unauthorized production access remaining private, non-indexable and non-mutating.

## Certified architecture

Authentication remains the custom private administrator boundary established in Phase 9 and hardened in Phase 16. The browser does not hold database authority. The Edge Function uses the trusted server credential to call `SECURITY INVOKER` PostgreSQL helpers whose execute privileges are denied to `anon` and `authenticated` and granted only where required to `service_role`.

A valid administrator session requires all of the following at the database authority layer:

`known hashed token -> unrevoked session -> future absolute expiry -> last_seen inside authoritative <=30 minute idle window -> active administrator -> super_admin role -> approved RC IT Services administrator identity`

A protected mutation additionally requires:

`enumerated POST route -> allowed form media type -> trusted browser/origin boundary -> bounded request body -> valid server-side session -> super_admin role -> CSRF hash match -> route-specific validation/database authority`

## Production reconciliation — 2026-09-17

Read-only inspection of the production `RCITCS` Supabase project found:

- administrators: 1 total;
- active administrators: 1;
- active super administrators: 1;
- active non-super administrators: 0;
- approved active RC IT Services super administrators: 1;
- administrators with a stored password hash: 1;
- historical sessions: 34;
- unrevoked sessions: 1;
- unrevoked and unexpired sessions: 0;
- currently valid sessions inside the 30-minute idle window: 0;
- sessions over the eight-hour absolute lifetime: 0;
- sessions with null `last_seen_at`: 0;
- sessions with `last_seen_at` outside creation/expiry bounds: 0;
- malformed stored network hashes: 0;
- overlong stored user agents: 0.

The single unrevoked historical session is already expired and therefore cannot satisfy `get_admin_session_context(...)`; it is not an active authenticated session.

Credential and session helper inspection confirmed:

- current password/session helpers are `SECURITY INVOKER`;
- `anon` execute: denied;
- `authenticated` execute: denied;
- required current helpers are executable by `service_role`;
- obsolete `rcitcs_verify_admin_password` and `rcitcs_change_admin_password` helpers are not executable by `service_role`;
- the `admins`, `sessions`, `password_reset_tokens`, and `admin_auth_rate_limits` tables expose no direct `anon` or `authenticated` table grants;
- Supabase security advisors reported zero findings at certification inspection.

No credential, raw session token, CSRF value, password hash, provider secret or reset token was read into the certification evidence.

## Automated gate

`tests/phase20-auth-session-rbac-certification.mjs` composes the established Phase 9 / Phase 16 / Phase 17 security regressions and adds a cross-phase certification contract for server authority, approved super-admin identity, session expiry, idle timeout, secure cookies, CSRF, role enforcement and browser-role database isolation.

`.github/workflows/phase20-auth-session-rbac-certification.yml` runs the full inherited repository verification first, then the dedicated 20.11 contract. Its production job is deliberately non-destructive: it verifies the exact deployed admin SHA, unauthenticated protected-route behavior, `/session` rejection, hostile-origin rejection, unsupported mutation media-type rejection and unknown mutation-route rejection without using production credentials or creating business records.

## Closure rule

Phase 20.11 may be marked closed only when:

1. the dedicated source/regression gate passes;
2. all inherited verification remains green;
3. the change is merged with an exact-head guard;
4. the post-merge workflow proves the exact new `main` SHA is deployed to `admin.rcitcs.com`;
5. the post-merge production-safe security acceptance passes on that same SHA.

Phase 20.12 must not begin before those conditions are satisfied.
