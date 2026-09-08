import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublishedJobs } from '../src/frontend/app/career-job-catalog.js';
import {
  SITE_ORIGIN,
  getIndexableRoutes,
  getPrerenderRoutes,
  getSeoForRoute
} from '../src/frontend/seo/seo-model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function outputPath(route) {
  return route === '/' ? path.join(dist, 'index.html') : path.join(dist, `${route.replace(/^\//, '')}.html`);
}

function escaped(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const prerenderRoutes = getPrerenderRoutes();
for (const route of prerenderRoutes) {
  const file = outputPath(route);
  await access(file);
  const html = await readFile(file, 'utf8');
  const seo = getSeoForRoute(route);
  assert(html.includes('id="main-content"'), `Prerendered main content missing: ${route}`);
  assert(html.includes(`data-prerendered-path="${route}"`), `Prerender marker missing: ${route}`);
  assert(html.includes(`<title>${escaped(seo.title)}</title>`), `SEO title missing from prerendered HTML: ${route}`);
  assert(html.includes(`rel="canonical" href="${seo.canonical}"`), `Canonical missing from prerendered HTML: ${route}`);
  assert(html.includes('property="og:title"'), `Open Graph metadata missing: ${route}`);
  assert(html.includes('application/ld+json'), `JSON-LD missing: ${route}`);
  assert(!html.includes('src="/js/app.js"'), `Development JS leaked into production route: ${route}`);
  assert(!html.includes('href="/css/'), `Development CSS leaked into production route: ${route}`);
  if (seo.index) assert(html.includes('name="robots" content="index,follow"'), `Index directive missing: ${route}`);
  else assert(html.includes('name="robots" content="noindex,nofollow"'), `Noindex directive missing: ${route}`);
}

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(sitemapLocations.length === getIndexableRoutes().length, 'Generated sitemap route count does not match centralized indexability policy.');
assert(new Set(sitemapLocations).size === sitemapLocations.length, 'Generated sitemap contains duplicate URLs.');
assert(!sitemap.includes('/login</loc>'), 'Login leaked into generated sitemap.');
assert(!sitemap.includes('/apply</loc>'), 'Application route leaked into generated sitemap.');

const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
assert(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), 'Generated robots.txt has the wrong sitemap origin.');
assert(robots.includes('Disallow: /admin/'), 'Admin robots rule missing.');
assert(robots.includes('Disallow: /careers/jobs/*/apply'), 'Application robots rule missing.');

const redirects = await readFile(path.join(dist, '_redirects'), 'utf8');
for (const alias of ['/consult-expert', '/careers/job-opportunities', '/careers/upload-your-resume', '/index.php']) {
  assert(redirects.includes(alias), `Generated redirect missing: ${alias}`);
}

const notFound = await readFile(path.join(dist, '404.html'), 'utf8');
assert(notFound.includes('Page Not Found | RC IT Services'), 'Custom 404 title missing.');
assert(notFound.includes('noindex,nofollow'), 'Custom 404 is not noindex.');
assert(notFound.includes('Page not found'), 'Custom 404 user-facing content missing.');

const firstJob = getPublishedJobs()[0];
assert(firstJob, 'At least one published job is required for JobPosting build verification.');
const jobHtml = await readFile(outputPath(`/careers/jobs/${firstJob.slug}`), 'utf8');
assert(jobHtml.includes('JobPosting'), 'Published job HTML is missing JobPosting structured data.');

const serviceHtml = await readFile(outputPath('/services/it/cyber-security'), 'utf8');
assert(serviceHtml.includes('"@type":"Service"'), 'Service page HTML is missing Service structured data.');
assert(serviceHtml.includes('BreadcrumbList'), 'Service page HTML is missing BreadcrumbList structured data.');

console.log(`PASS: ${prerenderRoutes.length} prerendered HTML routes, ${sitemapLocations.length} sitemap URLs, robots directives, redirects, structured data and real 404 output verified.`);
