import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [worker, publicEntrypoint, wrangler, domainWorkflow] = await Promise.all([
  readFile(path.join(root, 'src/backend/runtime/worker.js'), 'utf8'),
  readFile(path.join(root, 'worker/index.js'), 'utf8'),
  readFile(path.join(root, 'wrangler.jsonc'), 'utf8'),
  readFile(path.join(root, '.github/workflows/admin-portal-domain-smoke.yml'), 'utf8')
]);

for (const contract of [
  "const ADMIN_PRODUCTION_ORIGIN = 'https://admin.rcitcs.com'",
  "new Set(['admin.rcitcs.com', 'admin-staging.rcitcs.com'])",
  'function enhanceAdminNavigation',
  '<span>Applications</span>',
  "if (isDedicatedAdminHost(url.hostname)) return handleAdminRequest(request)",
  "if (isAdminPath(url.pathname)) return redirectPublicAdminAlias(request, url)",
  "headers.set('location', target.toString())"
]) assert.ok(worker.includes(contract), `Dedicated admin routing contract missing: ${contract}`);

for (const contract of [
  "import adminWorker from './admin-only.js'",
  'if (DEDICATED_ADMIN_HOSTS.has(host))',
  'return adminWorker.fetch(request, env, ctx)'
]) assert.ok(publicEntrypoint.includes(contract), `Connected production Worker must delegate the admin hostname through the hardened admin entrypoint: ${contract}`);

const config = JSON.parse(wrangler);
assert.ok(Array.isArray(config.assets?.run_worker_first));
assert.ok(config.assets.run_worker_first.includes('/*'));
assert.equal(config.workers_dev, true);
assert.equal(Object.hasOwn(config, 'route'), false);
assert.equal(config.routes?.length, 2, 'Production must provision the public apex and preserve the dedicated admin edge route.');
const publicDomain = config.routes.find((route) => route.pattern === 'rcitcs.com');
const adminRoute = config.routes.find((route) => route.pattern === 'admin.rcitcs.com/*');
assert.equal(publicDomain?.custom_domain, true, 'Public apex must be a Worker Custom Domain so DNS and TLS are provisioned by Cloudflare.');
assert.equal(adminRoute?.zone_name, 'rcitcs.com');
assert.notEqual(adminRoute?.custom_domain, true, 'The existing working admin route must not be converted while restoring the public apex.');

for (const expected of [
  "ADMIN='https://admin.rcitcs.com'",
  "PUBLIC='https://rcitcs.com'",
  'Production admin routes remain private and host-local'
]) assert.ok(domainWorkflow.includes(expected), `Admin/public domain release gate missing: ${expected}`);

assert.ok(!worker.includes("ADMIN_PRODUCTION_ORIGIN = 'https://rcitcservices.frsmkgit.workers.dev"));
console.log('PASS: the production Worker exposes rcitcs.com as the public Custom Domain while keeping admin.rcitcs.com on the hardened dedicated admin route.');
