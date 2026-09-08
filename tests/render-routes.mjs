globalThis.document = { title: '' };

globalThis.location = { origin: 'https://rc-it-services.test' };

const { routeContent } = await import('../src/frontend/router/router.js');
const { ALL_ROUTES, LEGACY_ROUTE_ALIASES } = await import('../src/frontend/app/site-config.js');
const { SERVICE_PAGES } = await import('../src/frontend/app/pages.js');
const { getPublishedJobs } = await import('../src/frontend/app/career-job-catalog.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `${label} contains duplicate value: ${value}`);
    seen.add(value);
  }
}

function assertPage(route, html) {
  assert(typeof html === 'string', `${route} did not return HTML`);
  assert(html.includes('id="main-content"'), `${route} is missing the main content landmark`);
  assert(!html.includes('undefined'), `${route} rendered an undefined value`);
  assert(!html.includes('[object Object]'), `${route} rendered an object accidentally`);
}

assertUnique(ALL_ROUTES, 'Canonical routes');
assertUnique(LEGACY_ROUTE_ALIASES, 'Compatibility aliases');
for (const alias of LEGACY_ROUTE_ALIASES) {
  assert(!ALL_ROUTES.includes(alias), `Compatibility alias is also marked canonical: ${alias}`);
}

for (const route of ALL_ROUTES) {
  assertPage(route, await routeContent(route));
}

for (const route of LEGACY_ROUTE_ALIASES) {
  assertPage(route, await routeContent(route));
}

let serviceDetailCount = 0;
for (const [serviceRoute, page] of Object.entries(SERVICE_PAGES)) {
  const serviceHtml = await routeContent(serviceRoute);
  assertPage(serviceRoute, serviceHtml);
  assert(serviceHtml.includes(escapeHtml(page.title)), `${serviceRoute} does not render its configured service title`);

  const capabilitySlugs = (page.howWeHelp || []).map((capability) => capability.slug);
  assertUnique(capabilitySlugs, `${serviceRoute} capability slugs`);

  for (const capability of page.howWeHelp || []) {
    const route = `${serviceRoute}/${capability.slug}`;
    const html = await routeContent(route);
    assertPage(route, html);
    assert(html.includes(escapeHtml(capability.title)), `${route} does not render its configured capability title`);
    serviceDetailCount += 1;
  }
}

const jobs = getPublishedJobs();
assertUnique(jobs.map((job) => job.slug), 'Published job slugs');
assertUnique(jobs.map((job) => job.jobCode).filter(Boolean), 'Published job codes');

for (const job of jobs) {
  const detailRoute = `/careers/jobs/${job.slug}`;
  const applicationRoute = `/careers/jobs/${job.slug}/apply`;
  const detailHtml = await routeContent(detailRoute);
  const applicationHtml = await routeContent(applicationRoute);

  assertPage(detailRoute, detailHtml);
  assertPage(applicationRoute, applicationHtml);
  assert(detailHtml.includes(escapeHtml(job.title)), `${detailRoute} does not render the selected job title`);
  assert(applicationHtml.includes(`Apply for ${escapeHtml(job.title)}`), `${applicationRoute} lost job-specific application context`);
}

const careersHtml = await routeContent('/careers');
assert(careersHtml.includes('Current openings'), 'Careers page lost the current openings experience');
assert(!careersHtml.includes('Upload your Resume</a>'), 'Careers page regressed to the old standalone resume-upload journey');

const faqHtml = await routeContent('/faqs');
assert(faqHtml.includes('RC does not use a separate speculative resume-upload page.'), 'FAQ still describes the retired resume-upload workflow');

const contactHtml = await routeContent('/contact');
assert(contactHtml.includes('Consultation topic *'), 'Contact page lost the unified consultation topic field');
assert(contactHtml.includes('name="email"'), 'Contact page must use the Email field');
assert(!contactHtml.includes('Business Email'), 'Contact page regressed to Business Email wording');
assert(!contactHtml.includes('Company / Organisation *'), 'Company / Organisation must remain optional');
assert(!contactHtml.includes('Job Title *'), 'Job Title must remain optional');

const legacyCareerHtml = await routeContent('/careers/upload-your-resume');
assert(legacyCareerHtml.includes('Current openings'), 'Legacy resume URL no longer resolves to the consolidated Careers experience');

const legacyConsultHtml = await routeContent('/consult-expert');
assert(legacyConsultHtml.includes('Consultation topic *'), 'Legacy Consult our Expert URL no longer resolves to unified Contact');

const notFound = await routeContent('/route-that-does-not-exist');
assert(notFound.includes('Page not found'), 'Unknown route did not render the not-found page');

console.log(`PASS: ${ALL_ROUTES.length} canonical routes, ${LEGACY_ROUTE_ALIASES.length} compatibility aliases, ${serviceDetailCount} service detail routes and ${jobs.length * 2} career detail/application routes rendered successfully with async Phase 5 route splitting and Phase 3 content invariants.`);
