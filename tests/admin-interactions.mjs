import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ADMIN_INTERACTION_PATH,
  ADMIN_INTERACTION_SCRIPT,
  ADMIN_INTERACTION_STYLE,
  ADMIN_SOFT_SUBMIT_HEADER,
  injectAdminInteractionHtml
} from '../worker/admin-interactions.js';
import { normalizeAdminBrowserPost } from '../worker/admin-only.js';

assert.equal(ADMIN_INTERACTION_PATH, '/__rc-admin/interactions.js');
assert.equal(ADMIN_SOFT_SUBMIT_HEADER, 'x-rc-admin-soft-submit');

for (const contract of [
  'history.pushState',
  'history.replaceState',
  "window.addEventListener('popstate'",
  'document.startViewTransition',
  'showModal()',
  'refreshCurrentView',
  "new RegExp(`^/jobs/${UUID}/(?:edit|preview|delete)$`",
  "new RegExp(`^/applications/${UUID}$`",
  'x-rc-admin-soft-submit',
  "location.pathname === '/jobs'",
  'trigger.focus(',
  "link.target = '_blank'",
  'data-rc-admin-modal',
  'renderModalError',
  'explicitModal'
]) assert.ok(ADMIN_INTERACTION_SCRIPT.includes(contract), `Admin interaction contract missing: ${contract}`);

assert.ok(!ADMIN_INTERACTION_SCRIPT.includes('location.reload('), 'The enhanced admin shell must never force a page reload for normal in-portal navigation.');

for (const contract of [
  'data-rc-admin-interactions',
  '.rc-admin-dialog::backdrop',
  'max-height:calc(100dvh - 40px)',
  '@media(max-width:640px)',
  'width:100vw;height:100dvh',
  '.rc-admin-dialog-close'
]) assert.ok(ADMIN_INTERACTION_STYLE.includes(contract), `Admin modal style contract missing: ${contract}`);

const page = '<!doctype html><html><head></head><body><main>Admin</main></body></html>';
const once = injectAdminInteractionHtml(page);
assert.ok(once.includes('data-rc-admin-interactions'), 'Admin interaction shell must be injected into private admin HTML.');
assert.ok(once.includes(`src="${ADMIN_INTERACTION_PATH}"`), 'Private admin HTML must load the same-origin interaction script.');
assert.equal((once.match(/data-rc-admin-interactions/g) || []).length, 2, 'One style marker and one script marker must be injected exactly once each.');
assert.equal(injectAdminInteractionHtml(once), once, 'Admin interaction injection must be idempotent.');

const csrf = 'soft-navigation-csrf';
const softRequest = new Request('https://admin.rcitcs.com/jobs/00000000-0000-4000-8000-000000000001/transition', {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    origin: 'https://admin.rcitcs.com',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    cookie: `rcitcs_admin_session=session; rcitcs_admin_csrf=${encodeURIComponent(csrf)}`,
    [ADMIN_SOFT_SUBMIT_HEADER]: '1'
  },
  body: `csrf=${encodeURIComponent(csrf)}&action=close`
});
const normalizedSoft = await normalizeAdminBrowserPost(softRequest);
assert.equal(normalizedSoft.headers.get('origin'), 'https://admin.rcitcs.com');
assert.equal(normalizedSoft.headers.get('sec-fetch-site'), 'same-origin');
assert.equal(normalizedSoft.headers.get('sec-fetch-mode'), 'navigate');
assert.equal(normalizedSoft.headers.get('sec-fetch-dest'), 'document');
assert.equal(normalizedSoft.headers.get('sec-fetch-user'), '?1');
assert.equal(normalizedSoft.headers.get(ADMIN_SOFT_SUBMIT_HEADER), null, 'The browser-only soft-submit marker must not be trusted downstream after edge normalization.');

const badCsrf = new Request('https://admin.rcitcs.com/jobs/00000000-0000-4000-8000-000000000001/transition', {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    origin: 'https://admin.rcitcs.com',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    cookie: `rcitcs_admin_session=session; rcitcs_admin_csrf=${encodeURIComponent(csrf)}`,
    [ADMIN_SOFT_SUBMIT_HEADER]: '1'
  },
  body: 'csrf=forged&action=close'
});
const rejectedSoft = await normalizeAdminBrowserPost(badCsrf);
assert.equal(rejectedSoft.headers.get('sec-fetch-mode'), 'cors', 'Soft POST without matching server-issued CSRF evidence must not be upgraded to trusted navigation evidence.');
assert.equal(rejectedSoft.headers.get(ADMIN_SOFT_SUBMIT_HEADER), '1');

const foreignSoft = new Request('https://admin.rcitcs.com/jobs/00000000-0000-4000-8000-000000000001/transition', {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    origin: 'https://example.invalid',
    'sec-fetch-site': 'cross-site',
    cookie: `rcitcs_admin_session=session; rcitcs_admin_csrf=${encodeURIComponent(csrf)}`,
    [ADMIN_SOFT_SUBMIT_HEADER]: '1'
  },
  body: `csrf=${encodeURIComponent(csrf)}&action=close`
});
const rejectedForeign = await normalizeAdminBrowserPost(foreignSoft);
assert.equal(rejectedForeign.headers.get('origin'), 'https://example.invalid', 'Explicit cross-origin evidence must remain rejected even when the soft-submit marker is present.');
assert.notEqual(rejectedForeign.headers.get('sec-fetch-mode'), 'navigate');

const edgeSource = await readFile(new URL('../worker/admin-only.js', import.meta.url), 'utf8');
assert.ok(edgeSource.includes("script-src 'self'"), 'Admin CSP must permit only the same-origin interaction script.');
assert.ok(edgeSource.includes("connect-src 'self'"), 'Admin CSP must permit same-origin fetch navigation without opening cross-origin connections.');
assert.ok(edgeSource.includes('hasMatchingAdminCsrf(request)'), 'Soft POST trust must remain bound to the existing server-issued CSRF authority.');

console.log('PASS: Phase 12 admin navigation is progressively enhanced with same-document History API routing, native modal actions, refresh-stable canonical URLs, and CSRF-gated fetch submissions without weakening cross-origin protections.');
