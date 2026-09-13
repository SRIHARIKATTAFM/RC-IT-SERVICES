import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerPath = path.join(root, 'src/backend/runtime/worker.js');
const workerSource = await readFile(workerPath, 'utf8');
const primaryConfig = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const stagingConfig = JSON.parse(await readFile(path.join(root, 'wrangler.admin-staging.jsonc'), 'utf8'));
const productionAdminConfig = JSON.parse(await readFile(path.join(root, 'wrangler.admin-production.jsonc'), 'utf8'));
const publicEntrypointSource = await readFile(path.join(root, 'worker/index.js'), 'utf8');
const adminOnlySource = await readFile(path.join(root, 'worker/admin-only.js'), 'utf8');
const domainWorkflow = await readFile(path.join(root, '.github/workflows/admin-domain-live-smoke.yml'), 'utf8');
const { adminOriginAllowed, buildAdminUpstreamRequest, enhanceAdminNavigation, isDedicatedAdminHost } = await import(pathToFileURL(workerPath).href);

for (const required of [
  "const ADMIN_PRODUCTION_ORIGIN = 'https://admin.rcitcs.com'",
  "new Set(['admin.rcitcs.com', 'admin-staging.rcitcs.com'])",
  "const ADMIN_UPSTREAM_BASE = '/functions/v1/admin-auth'",
  "upstreamRequest.headers.set('x-rcitcs-admin-proxy', 'cloudflare')",
  "upstreamRequest.headers.set('sec-fetch-user', '?1')",
  "upstreamRequest.headers.delete('host')",
  "upstreamRequest.headers.delete('content-length')",
  "request.headers.get('referer')",
  "fetch(upstreamRequest, { redirect: 'manual' })",
  "headers.set('cache-control', 'no-store, no-transform, max-age=0, must-revalidate')",
  "headers.set('x-robots-tag', 'noindex, nofollow, noarchive')",
  "if (isDedicatedAdminHost(url.hostname)) return handleAdminRequest(request)",
  "if (isAdminPath(url.pathname)) return redirectPublicAdminAlias(request, url)",
  'function enhanceAdminNavigation',
  '<span>Applications</span>'
]) assert.ok(workerSource.includes(required), `Admin proxy security/navigation contract missing: ${required}`);

assert.equal(isDedicatedAdminHost('admin.rcitcs.com'), true);
assert.equal(isDedicatedAdminHost('ADMIN-STAGING.RCITCS.COM'), true);
assert.equal(isDedicatedAdminHost('rcitcs.com'), false);
assert.equal(isDedicatedAdminHost('rcitcservices.frsmkgit.workers.dev'), false);

const productionLogin = new URL('https://admin.rcitcs.com/login');
const stagingLogin = new URL('https://admin-staging.rcitcs.com/login');
const navHeaders = { 'sec-fetch-site':'same-origin', 'sec-fetch-mode':'navigate', 'sec-fetch-dest':'document' };
const requestWith = (headers) => ({ headers: new Headers(headers) });
assert.equal(adminOriginAllowed(requestWith({ origin:productionLogin.origin }), productionLogin), true);
assert.equal(adminOriginAllowed(requestWith({ origin:stagingLogin.origin }), stagingLogin), true);
assert.equal(adminOriginAllowed(requestWith({ origin:'https://example.invalid', referer:`${productionLogin.origin}/`, ...navHeaders }), productionLogin), false);
assert.equal(adminOriginAllowed(requestWith({ origin:'null', ...navHeaders }), productionLogin), true);
assert.equal(adminOriginAllowed(requestWith({ origin:'null', referer:`${productionLogin.origin}/` }), productionLogin), true);
assert.equal(adminOriginAllowed(requestWith({ origin:'null', referer:'https://example.invalid/', ...navHeaders }), productionLogin), false);
assert.equal(adminOriginAllowed(requestWith({ origin:'null', ...navHeaders, 'sec-fetch-site':'cross-site' }), productionLogin), false);

const browserPost = new Request(productionLogin, { method:'POST', headers:{ origin:productionLogin.origin, ...navHeaders, 'content-type':'application/x-www-form-urlencoded' }, body:'email=admin%40example.invalid&password=placeholder' });
const upstream = new URL('https://chsizmffzpxcqhaptjeu.supabase.co/functions/v1/admin-auth/login');
const proxied = buildAdminUpstreamRequest(browserPost, upstream);
assert.equal(proxied.url, upstream.href);
assert.equal(proxied.headers.get('x-rcitcs-admin-proxy'), 'cloudflare');
assert.equal(proxied.headers.get('host'), null);
assert.equal(proxied.headers.get('content-length'), null);
assert.equal(proxied.headers.get('sec-fetch-site'), 'same-origin');
assert.equal(proxied.headers.get('sec-fetch-mode'), 'navigate');
assert.equal(proxied.headers.get('sec-fetch-dest'), 'document');
assert.equal(proxied.headers.get('sec-fetch-user'), '?1');
assert.equal(await proxied.text(), 'email=admin%40example.invalid&password=placeholder');

const legacyDashboardNavigation = '<header><nav class="primary-nav" aria-label="Administration"><a href="/">Overview</a><a href="/jobs">Jobs</a><a href="/change-password">Security</a></nav><details><div class="mobile-menu"><a href="/">Overview</a><a href="/jobs">Jobs</a><a href="/change-password">Security</a></div></details></header>';
const enhancedNavigation = enhanceAdminNavigation(legacyDashboardNavigation, '');
assert.equal((enhancedNavigation.match(/href="\/applications"/g) || []).length, 2);
assert.equal((enhancedNavigation.match(/<span>Applications<\/span>/g) || []).length, 1);
assert.equal((enhancedNavigation.match(/>Applications<\/a>/g) || []).length, 1);
assert.equal(enhanceAdminNavigation(enhancedNavigation, ''), enhancedNavigation);

const partiallyNativeNavigation = '<header><nav class="primary-nav"><a href="/applications"><span>Applications</span></a><a href="/change-password">Security</a></nav><div class="mobile-menu"><a href="/change-password">Security</a></div></header>';
const completedNavigation = enhanceAdminNavigation(partiallyNativeNavigation, '');
assert.equal((completedNavigation.match(/href="\/applications"/g) || []).length, 2);

assert.equal(primaryConfig.main, './worker/index.js');
assert.equal(primaryConfig.workers_dev, true);
assert.equal(Object.hasOwn(primaryConfig, 'route'), false);
assert.equal(primaryConfig.routes?.length, 2, 'The connected company Worker must own the public apex Custom Domain and one explicit admin edge Route.');
const publicDomain = primaryConfig.routes.find((route) => route.pattern === 'rcitcs.com');
const adminRoute = primaryConfig.routes.find((route) => route.pattern === 'admin.rcitcs.com/*');
assert.equal(publicDomain?.custom_domain, true, 'Public rcitcs.com must be provisioned as the corporate-site Worker Custom Domain.');
assert.equal(adminRoute?.zone_name, 'rcitcs.com');
assert.notEqual(adminRoute?.custom_domain, true, 'The working admin hostname remains on the explicit zone route.');
assert.deepEqual(primaryConfig.assets?.run_worker_first, ['/*']);
assert.deepEqual(primaryConfig.triggers?.crons, ['*/15 * * * *']);

for (const required of ["import adminWorker from './admin-only.js'", 'if (DEDICATED_ADMIN_HOSTS.has(host))', 'return adminWorker.fetch(request, env, ctx)']) assert.ok(publicEntrypointSource.includes(required));

assert.equal(stagingConfig.name, 'rcitcs-admin-staging');
assert.equal(stagingConfig.main, './worker/admin-only.js');
assert.equal(stagingConfig.workers_dev, false);
assert.equal(stagingConfig.routes?.length, 1);
assert.equal(stagingConfig.routes?.[0]?.pattern, 'admin-staging.rcitcs.com');
assert.equal(stagingConfig.routes?.[0]?.custom_domain, true);

assert.equal(productionAdminConfig.name, 'rcitcs-admin-production');
assert.equal(productionAdminConfig.main, './worker/admin-only.js');
assert.equal(productionAdminConfig.workers_dev, false);
assert.equal(productionAdminConfig.routes?.[0]?.pattern, 'admin.rcitcs.com');
assert.equal(productionAdminConfig.routes?.[0]?.custom_domain, true);

assert.ok(adminOnlySource.includes("new Set(['admin.rcitcs.com', 'admin-staging.rcitcs.com'])"));
assert.ok(adminOnlySource.includes("return new Response('Not Found'"));
assert.ok(adminOnlySource.includes('const response = await runtime.fetch(request, env, ctx);'));
assert.ok(adminOnlySource.includes('return enhanceAdminResponse(response, request.method);'));
assert.ok(adminOnlySource.includes("import { injectAdminResponsiveHtml } from './admin-responsive.js';"));
assert.ok(adminOnlySource.includes("ADMIN_EDGE_RELEASE = 'phase12-job-authoring-v1'"));
assert.ok(adminOnlySource.includes('ADMIN_INTERACTION_PATH'));
assert.ok(adminOnlySource.includes("script-src 'self'"));
assert.ok(adminOnlySource.includes("connect-src 'self'"));
for (const forbidden of ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS','ADMIN_BOOTSTRAP_PASSWORD_VERIFIER']) {
  assert.equal(workerSource.includes(forbidden), false);
  assert.equal(adminOnlySource.includes(forbidden), false);
}

for (const expected of [
  "ADMIN='https://admin.rcitcs.com'",
  "ADMIN_STAGING='https://admin-staging.rcitcs.com'",
  "PUBLIC='https://rcitcs.com'",
  '${ADMIN}/applications',
  '${ADMIN}/session',
  'Production admin routes remain private and host-local',
  'Public rcitcs.com corporate-site separation verified.'
]) assert.ok(domainWorkflow.includes(expected), `Admin domain release gate missing: ${expected}`);

console.log('PASS: Phase 12 production routing serves the public apex and the hardened dedicated admin hostname independently while preserving responsive UI, CSRF/origin protection and modal interactions.');
