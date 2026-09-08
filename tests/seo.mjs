globalThis.document = { title: '' };
globalThis.location = { origin: 'https://rcitcservices.frsmkgit.workers.dev' };

const { routeContent } = await import('../src/frontend/router/router.js');
const { ALL_ROUTES, COMPANY, LEGACY_ROUTE_ALIASES } = await import('../src/frontend/app/site-config.js');
const { SERVICE_PAGES } = await import('../src/frontend/app/pages.js');
const { getPublishedJobs } = await import('../src/frontend/app/career-job-catalog.js');
const {
  SITE_ORIGIN,
  getIndexableRoutes,
  getPrerenderRoutes,
  getSeoForRoute,
  normaliseSeoPath,
  renderRedirectsFile,
  renderRobotsTxt,
  renderSeoHead,
  renderSitemapXml,
  schemaGraphForRoute
} = await import('../src/frontend/seo/seo-model.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlEsc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `${label} is duplicated: ${value}`);
    seen.add(value);
  }
}

const prerenderRoutes = getPrerenderRoutes();
const indexableRoutes = getIndexableRoutes();
const publishedJobs = getPublishedJobs();

for (const route of ALL_ROUTES) {
  assert(prerenderRoutes.includes(route), `Canonical route is not in the SEO prerender set: ${route}`);
  assert(getSeoForRoute(route), `Canonical route is missing SEO metadata: ${route}`);
}

for (const route of prerenderRoutes) {
  const seo = getSeoForRoute(route);
  assert(seo, `Prerender route is missing SEO metadata: ${route}`);
  assert(seo.title.length >= 12, `SEO title is too weak: ${route}`);
  assert(seo.description.length >= 40, `SEO description is too weak: ${route}`);
  assert(seo.canonical.startsWith(`${SITE_ORIGIN}/`) || seo.canonical === SITE_ORIGIN, `Canonical origin is invalid: ${route}`);
  const head = renderSeoHead(route);
  assert(head.includes('<link rel="canonical"'), `Canonical tag missing: ${route}`);
  assert(head.includes('property="og:title"'), `Open Graph title missing: ${route}`);
  assert(head.includes('name="twitter:card"'), `Twitter card metadata missing: ${route}`);
  assert(head.includes('application/ld+json'), `JSON-LD missing: ${route}`);
}

unique(indexableRoutes.map((route) => getSeoForRoute(route).title), 'Indexable SEO title');
unique(indexableRoutes.map((route) => getSeoForRoute(route).description), 'Indexable SEO description');

assert(getSeoForRoute('/login').index === false, 'Login must remain noindex.');
assert(renderSeoHead('/login').includes('noindex,nofollow'), 'Login noindex metadata is missing.');

const organization = schemaGraphForRoute('/').find((node) => node['@type'] === 'Organization');
const [streetAddress, addressLocality, addressRegion, postalCode] = COMPANY.registeredOffice.split(',').map((part) => part.trim());
assert(organization?.legalName === COMPANY.legalName, 'Organization legal name is not sourced from COMPANY.');
assert(organization?.identifier === COMPANY.companyNumber, 'Organization company number is not sourced from COMPANY.');
assert(organization?.address?.streetAddress === streetAddress, 'Organization street address diverged from COMPANY.registeredOffice.');
assert(organization?.address?.addressLocality === addressLocality, 'Organization locality diverged from COMPANY.registeredOffice.');
assert(organization?.address?.addressRegion === addressRegion, 'Organization region diverged from COMPANY.registeredOffice.');
assert(organization?.address?.postalCode === postalCode, 'Organization postcode diverged from COMPANY.registeredOffice.');
assert(organization?.address?.addressCountry === 'GB', 'Organization country must be GB.');

for (const job of publishedJobs) {
  const detailPath = `/careers/jobs/${job.slug}`;
  const applicationPath = `${detailPath}/apply`;
  const jobSeo = getSeoForRoute(detailPath);
  const appSeo = getSeoForRoute(applicationPath);
  const jobPosting = schemaGraphForRoute(detailPath).find((node) => node['@type'] === 'JobPosting');

  assert(jobSeo?.index === true, `Published job is not indexable: ${detailPath}`);
  assert(jobSeo.canonical === `${SITE_ORIGIN}${detailPath}`, `Published job canonical is wrong: ${detailPath}`);
  assert(jobPosting, `JobPosting schema missing: ${detailPath}`);
  assert(jobPosting.description.includes('<p>') && jobPosting.description.includes('<ul>'), `JobPosting description must contain structured HTML: ${detailPath}`);
  assert(jobPosting.description.includes('Responsibilities') && jobPosting.description.includes('Qualifications'), `JobPosting description is incomplete: ${detailPath}`);

  for (const [label, value] of [
    ['Department', job.department],
    ['Location', job.location],
    ['Working arrangement', job.workStyle],
    ['Employment type', job.employmentType],
    ['Experience', job.experience]
  ]) {
    if (value) {
      assert(jobPosting.description.includes(`${label}: ${htmlEsc(value)}`), `JobPosting description is missing visible ${label.toLowerCase()}: ${detailPath}`);
    }
  }
  for (const industry of job.industries || []) {
    assert(jobPosting.description.includes(`<li>${htmlEsc(industry)}</li>`), `JobPosting description is missing visible industry context: ${detailPath}`);
  }

  assert(jobPosting.datePosted === job.postedDate, `JobPosting datePosted changed: ${detailPath}`);
  assert(jobPosting.jobLocation?.address?.addressCountry === 'GB', `JobPosting country missing: ${detailPath}`);

  assert(appSeo?.index === false, `Job application route must be noindex: ${applicationPath}`);
  assert(appSeo.canonical === `${SITE_ORIGIN}${applicationPath}`, `Job application route should use a self canonical while remaining noindex: ${applicationPath}`);
}

for (const servicePath of Object.keys(SERVICE_PAGES)) {
  assert(schemaGraphForRoute(servicePath).some((node) => node['@type'] === 'Service'), `Service schema missing: ${servicePath}`);
}

const sitemap = renderSitemapXml();
for (const route of indexableRoutes) {
  assert(sitemap.includes(`<loc>${SITE_ORIGIN}${route === '/' ? '/' : route}</loc>`), `Sitemap is missing indexable route: ${route}`);
}
for (const alias of LEGACY_ROUTE_ALIASES) {
  assert(!sitemap.includes(`${SITE_ORIGIN}${alias}`), `Legacy alias leaked into sitemap: ${alias}`);
}
assert(!sitemap.includes(`${SITE_ORIGIN}/login`), 'Login leaked into sitemap.');
assert(!sitemap.includes('/apply</loc>'), 'Application route leaked into sitemap.');

const robots = renderRobotsTxt();
for (const rule of ['Disallow: /api/', 'Disallow: /admin/', `Sitemap: ${SITE_ORIGIN}/sitemap.xml`]) {
  assert(robots.includes(rule), `Robots rule missing: ${rule}`);
}
assert(!robots.includes('Disallow: /login'), 'Login must stay crawlable so crawlers can observe its noindex directive.');
assert(!robots.includes('Disallow: /careers/jobs/*/apply'), 'Application pages must stay crawlable so crawlers can observe their noindex directive.');

const redirects = renderRedirectsFile();
for (const alias of [...LEGACY_ROUTE_ALIASES, '/index.php']) {
  assert(redirects.includes(alias), `SEO redirect is missing: ${alias}`);
}

const knownPaths = new Set(prerenderRoutes);
const legacyPaths = new Set([...LEGACY_ROUTE_ALIASES, '/index.php']);
for (const route of prerenderRoutes) {
  const html = await routeContent(route);
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const target = normaliseSeoPath(href);
    assert(!legacyPaths.has(target), `${route} links internally to legacy URL ${target}`);
    assert(knownPaths.has(target), `${route} contains broken internal link ${href}`);
  }
}

console.log(`PASS: Phase 6 SEO model verified for ${prerenderRoutes.length} prerender routes, ${indexableRoutes.length} indexable routes and ${publishedJobs.length} published JobPosting routes.`);
