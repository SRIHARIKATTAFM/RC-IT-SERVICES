import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, getSeoForRoute, renderRobotsTxt, renderSitemapXml } from '../src/frontend/seo/seo-model.js';

const ACTIVE_ORIGIN = 'https://rc-it-consulting-services.rcitcservices.workers.dev';
const RETIRED_ORIGIN = 'https://rcitcservices.frsmkgit.workers.dev';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(SITE_ORIGIN, ACTIVE_ORIGIN, 'SEO source of truth must use the verified active Cloudflare production Worker until the custom-domain cutover.');

for (const route of ['/', '/about-us', '/careers', '/services/it/cyber-security']) {
  const seo = getSeoForRoute(route);
  assert.ok(seo?.canonical?.startsWith(ACTIVE_ORIGIN), `Canonical must use the active production origin: ${route}`);
  assert.ok(!seo.canonical.includes('frsmkgit.workers.dev'), `Retired canonical origin leaked into route: ${route}`);
}

const sitemap = renderSitemapXml();
assert.ok(sitemap.includes(`<loc>${ACTIVE_ORIGIN}/`), 'Sitemap must advertise the active Cloudflare production origin.');
assert.ok(!sitemap.includes(RETIRED_ORIGIN), 'Retired Worker origin must not appear in sitemap output.');

const robots = renderRobotsTxt();
assert.ok(robots.includes(`Sitemap: ${ACTIVE_ORIGIN}/sitemap.xml`), 'robots.txt must advertise the sitemap on the active production origin.');
assert.ok(!robots.includes(RETIRED_ORIGIN), 'Retired Worker origin must not appear in robots output.');

const seoConfig = await readFile(path.join(root, 'src/frontend/seo/seo-config.js'), 'utf8');
const domainCutover = await readFile(path.join(root, 'docs/DOMAIN_CUTOVER.md'), 'utf8');
assert.ok(seoConfig.includes(ACTIVE_ORIGIN), 'SEO config must explicitly retain the verified active Worker fallback.');
assert.ok(!seoConfig.includes(RETIRED_ORIGIN), 'SEO config must not retain the retired Worker origin.');
assert.ok(domainCutover.includes(ACTIVE_ORIGIN), 'Domain cutover documentation must identify the verified active production Worker.');

console.log('PASS: Phase 12 canonical, sitemap and robots output use the verified active Cloudflare production Worker and reject the retired origin.');
