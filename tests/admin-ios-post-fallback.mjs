import assert from 'node:assert/strict';
import { ADMIN_EDGE_RELEASE, normalizeAdminBrowserPost } from '../worker/admin-only.js';

assert.equal(ADMIN_EDGE_RELEASE, 'phase12-job-authoring-v1', 'Live admin verification must distinguish the Phase 12 job-authoring/modal release from stale edge code.');

const loginUrl = 'https://admin.rcitcs.com/login';
const jobUrl = 'https://admin.rcitcs.com/jobs/00000000-0000-4000-8000-000000000001/transition';
const formHeaders = { 'content-type': 'application/x-www-form-urlencoded' };

const iosLogin = new Request(loginUrl, {
  method: 'POST',
  headers: formHeaders,
  body: 'email=rcitcservices%40gmail.com&password=placeholder'
});
const normalizedLogin = await normalizeAdminBrowserPost(iosLogin);
assert.equal(normalizedLogin.headers.get('origin'), 'https://admin.rcitcs.com', 'Header-sparse iOS/WebKit login POST must be normalized only on the dedicated admin host.');
assert.equal(await normalizedLogin.text(), 'email=rcitcservices%40gmail.com&password=placeholder');

const iosForgot = new Request('https://admin.rcitcs.com/forgot-password', {
  method: 'POST',
  headers: formHeaders,
  body: 'email=rcitcservices%40gmail.com'
});
assert.equal((await normalizeAdminBrowserPost(iosForgot)).headers.get('origin'), 'https://admin.rcitcs.com');

const explicitCrossOrigin = new Request(loginUrl, {
  method: 'POST',
  headers: { ...formHeaders, origin: 'https://example.invalid' },
  body: 'email=rcitcservices%40gmail.com&password=placeholder'
});
assert.equal((await normalizeAdminBrowserPost(explicitCrossOrigin)).headers.get('origin'), 'https://example.invalid', 'Explicit cross-origin evidence must never be rewritten as trusted.');

const crossSiteMetadata = new Request(loginUrl, {
  method: 'POST',
  headers: { ...formHeaders, 'sec-fetch-site': 'cross-site' },
  body: 'email=rcitcservices%40gmail.com&password=placeholder'
});
assert.equal((await normalizeAdminBrowserPost(crossSiteMetadata)).headers.get('origin'), null, 'Cross-site Fetch Metadata must remain rejected by the shared gateway.');

const partialSameOriginMetadata = new Request(loginUrl, {
  method: 'POST',
  headers: { ...formHeaders, 'sec-fetch-site': 'same-origin' },
  body: 'email=rcitcservices%40gmail.com&password=placeholder'
});
assert.equal((await normalizeAdminBrowserPost(partialSameOriginMetadata)).headers.get('origin'), 'https://admin.rcitcs.com', 'Partial but authoritative same-origin Fetch Metadata is sufficient for WebKit normalization.');

const csrf = 'csrf-token-value';
const authenticatedIosPost = new Request(jobUrl, {
  method: 'POST',
  headers: { ...formHeaders, cookie: `rcitcs_admin_session=session; rcitcs_admin_csrf=${encodeURIComponent(csrf)}` },
  body: `csrf=${encodeURIComponent(csrf)}&action=close`
});
const normalizedAuthenticated = await normalizeAdminBrowserPost(authenticatedIosPost);
assert.equal(normalizedAuthenticated.headers.get('origin'), 'https://admin.rcitcs.com', 'Authenticated iOS forms may fall back only when form CSRF matches the secure admin CSRF cookie.');

const mismatchedCsrf = new Request(jobUrl, {
  method: 'POST',
  headers: { ...formHeaders, cookie: `rcitcs_admin_session=session; rcitcs_admin_csrf=${encodeURIComponent(csrf)}` },
  body: 'csrf=wrong-token&action=close'
});
assert.equal((await normalizeAdminBrowserPost(mismatchedCsrf)).headers.get('origin'), null, 'Mismatched authenticated CSRF must remain rejected.');

const recoveryCsrf = 'recovery-csrf-value';
const resetPost = new Request('https://admin.rcitcs.com/reset-password', {
  method: 'POST',
  headers: { ...formHeaders, cookie: `rcitcs_admin_recovery=token; rcitcs_admin_recovery_csrf=${encodeURIComponent(recoveryCsrf)}` },
  body: `csrf=${encodeURIComponent(recoveryCsrf)}&next=Password123%21&confirm=Password123%21`
});
assert.equal((await normalizeAdminBrowserPost(resetPost)).headers.get('origin'), 'https://admin.rcitcs.com', 'Recovery POST uses the existing recovery CSRF cookie as the compatibility authority.');

const foreignHost = new Request('https://example.invalid/login', {
  method: 'POST', headers: formHeaders, body: 'email=x%40example.invalid&password=x'
});
assert.equal((await normalizeAdminBrowserPost(foreignHost)).headers.get('origin'), null, 'Compatibility normalization is restricted to dedicated admin hostnames.');

console.log('PASS: iPhone/iPad WebKit POST compatibility remains limited to safe unauthenticated forms or server-issued CSRF evidence while explicit cross-origin requests stay rejected and the current admin edge release is externally distinguishable.');
