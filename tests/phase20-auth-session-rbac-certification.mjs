import assert from "node:assert/strict";
import fs from "node:fs";

// Re-run the established security modules instead of replacing them with a weaker
// Phase-20-only approximation. These modules execute their assertions on import.
for (const test of [
  "./admin-auth-security.mjs",
  "./phase16-authentication-hardening.mjs",
  "./phase16-session-security.mjs",
  "./phase16-request-integrity.mjs",
  "./phase17-origin-host-cors-hardening.mjs",
  "./phase17-public-admin-separation.mjs"
]) {
  await import(`${test}?phase20_11=${Date.now()}_${Math.random()}`);
}

const index = fs.readFileSync(new URL("../supabase/functions/admin-auth/index.ts", import.meta.url), "utf8");
const jobs = fs.readFileSync(new URL("../supabase/functions/admin-auth/job-routes.ts", import.meta.url), "utf8");
const applications = fs.readFileSync(new URL("../supabase/functions/admin-auth/applications.ts", import.meta.url), "utf8");
const contacts = fs.readFileSync(new URL("../supabase/functions/admin-auth/contacts.ts", import.meta.url), "utf8");
const sessionMigration = fs.readFileSync(new URL("../supabase/migrations/20260915060000_phase_16_session_security_hardening.sql", import.meta.url), "utf8");
const authMigration = fs.readFileSync(new URL("../supabase/migrations/20260915053500_phase_16_authentication_hardening.sql", import.meta.url), "utf8");

// Server-side authentication authority and approved administrator identity.
for (const fragment of [
  'const ADMIN_EMAIL = "rcitcservices@gmail.com";',
  "const SESSION_TTL = 8 * 60 * 60;",
  "const IDLE_TTL = 30 * 60;",
  "sessionContextByHash(await shaHex(cookie.token)",
  'context.session.admin.role !== "super_admin"',
  'authState.admin.role !== "super_admin"',
  "shaHex(submitted) === state.csrf_token_hash",
  "Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict; Priority=High"
]) assert.ok(index.includes(fragment), `Phase 20.11 server/session contract missing: ${fragment}`);

// No public self-registration boundary is permitted for the single-super-admin model.
for (const forbidden of ["/register", "/sign-up", "/signup"]) {
  assert.ok(!index.includes(`path === \"${forbidden}\"`), `unexpected public administrator registration route: ${forbidden}`);
}

// Every release-critical admin business module must independently enforce role + CSRF.
for (const [name, source] of [["jobs", jobs], ["applications", applications], ["contacts", contacts]]) {
  assert.ok(source.includes('authState.admin.role !== "super_admin"'), `${name} lost independent super-admin authorization`);
  assert.ok(source.includes("csrfOk"), `${name} lost independent CSRF verification`);
}

// Database authority must independently constrain session eligibility, lifetime and browser execution.
for (const fragment of [
  "and status = 'active'",
  "and role = 'super_admin'",
  "and lower(email) = 'rcitcservices@gmail.com'",
  "s.revoked_at is null",
  "s.expires_at > now()",
  "s.last_seen_at > v_idle_cutoff",
  "now() - interval '30 minutes'",
  "expires_at <= created_at + interval '8 hours'",
  "sessions_one_active_per_admin_uidx",
  "revoke execute on function public.create_admin_session",
  "revoke execute on function public.get_admin_session_context",
  "to service_role"
]) assert.ok(sessionMigration.includes(fragment), `Phase 20.11 DB session authority missing: ${fragment}`);

for (const fragment of [
  "and role = 'super_admin'",
  "lower(email) = 'rcitcservices@gmail.com'",
  "revoke execute on function public.rcitcs_verify_admin_password",
  "revoke execute on function public.rcitcs_change_admin_password"
]) assert.ok(authMigration.includes(fragment), `Phase 20.11 authentication authority missing: ${fragment}`);

assert.ok(!sessionMigration.includes("security definer"), "session authority must remain SECURITY INVOKER");
assert.ok(!authMigration.includes("security definer"), "credential authority must remain SECURITY INVOKER");
assert.ok(!index.includes("Access-Control-Allow-Origin: *"), "admin authentication must not expose wildcard CORS");

console.log("Phase 20.11 authentication / authorization / session / RBAC certification contract: PASS");
