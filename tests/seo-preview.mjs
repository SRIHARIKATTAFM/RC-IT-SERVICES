process.env.WORKERS_CI_BRANCH = 'phase-6/seo-architecture';

globalThis.document = { title: '' };
globalThis.location = { origin: 'https://phase-6-seo-architecture-rcitcservices.frsmkgit.workers.dev' };

const {
  DEPLOYMENT_SEARCH_INDEXING_ENABLED,
  SITE_ORIGIN,
  getIndexableRoutes,
  getPrerenderRoutes,
  getSeoForRoute,
  renderRobotsTxt,
  renderSitemapXml
} = await import('../src/frontend/seo/seo-model.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(DEPLOYMENT_SEARCH_INDEXING_ENABLED === false, 'Cloudflare branch preview must disable search indexing.');

const prerenderRoutes = getPrerenderRoutes();
assert(prerenderRoutes.length > 0, 'Preview build must still prerender the public route set.');
assert(getIndexableRoutes().length === 0, 'Cloudflare branch preview must expose zero indexable routes.');

for (const route of prerenderRoutes) {
  const seo = getSeoForRoute(route);
  assert(seo?.index === false, `Preview route unexpectedly remained indexable: ${route}`);
  assert(seo?.canonical.startsWith(`${SITE_ORIGIN}/`), `Preview canonical must continue to reference the production origin: ${route}`);
}

const robots = renderRobotsTxt();
assert(robots === 'User-agent: *\nDisallow: /\n', 'Preview robots.txt must disallow the complete branch-preview deployment.');
assert(!robots.includes('Sitemap:'), 'Preview robots.txt must not advertise the production sitemap.');

const sitemap = renderSitemapXml();
assert(!sitemap.includes('<url>'), 'Preview sitemap must not expose indexable URLs.');
assert(sitemap.includes('<urlset'), 'Preview sitemap must remain valid XML output.');

console.log(`PASS: Cloudflare branch-preview SEO gate verified across ${prerenderRoutes.length} prerender routes with zero indexable URLs.`);
