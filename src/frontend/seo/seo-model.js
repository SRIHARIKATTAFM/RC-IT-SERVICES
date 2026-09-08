import { ALL_ROUTES, COMPANY, IMAGES } from '../app/site-config.js';
import { INDUSTRY_PAGES, SERVICE_PAGES, findServiceDetail } from '../app/pages.js';
import { getPublishedJob, getPublishedJobs } from '../app/career-job-catalog.js';
import {
  JOB_SEARCH_INDEXING_ENABLED,
  LEGACY_REDIRECTS,
  SITE_NAME,
  SITE_ORIGIN,
  STATIC_PAGE_SEO
} from './seo-config.js';

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function xmlEsc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function text(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normaliseSeoPath(value = '/') {
  const raw = String(value || '/').split('#')[0].split('?')[0] || '/';
  if (raw === '/index.php') return '/';
  return raw === '/' ? '/' : raw.replace(/\/+$/, '') || '/';
}

export function canonicalUrl(pathName = '/') {
  const path = normaliseSeoPath(pathName);
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
}

function descriptor(path, source, extras = {}) {
  return {
    path,
    title: text(source.title),
    description: text(source.description),
    label: source.label || text(source.title).split('|')[0].trim(),
    image: source.image || IMAGES.hero,
    index: source.index !== false,
    canonical: canonicalUrl(path),
    kind: extras.kind || 'page',
    ...extras
  };
}

function serviceDescriptor(path, page) {
  return descriptor(path, {
    label: page.title,
    title: `${page.title} | RC IT Services`,
    description: page.lead,
    image: page.image,
    index: true
  }, {
    kind: 'service',
    service: {
      name: page.title,
      serviceType: page.title,
      description: page.lead
    }
  });
}

function serviceDetailDescriptor(path, detail) {
  const { page, item, servicePath } = detail;
  return descriptor(path, {
    label: item.title,
    title: `${item.title} — ${page.title} | RC IT Services`,
    description: item.summary,
    image: page.secondaryImage || page.image,
    index: true
  }, {
    kind: 'service-detail',
    parentPath: servicePath,
    parentLabel: page.title,
    service: {
      name: `${item.title} — ${page.title}`,
      serviceType: item.title,
      description: item.summary
    }
  });
}

function industryDescriptor(path, page) {
  return descriptor(path, {
    label: page.title,
    title: `${page.title} | RC IT Services`,
    description: page.lead,
    image: page.image,
    index: true
  }, { kind: 'industry' });
}

function employmentType(value = '') {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('full')) return 'FULL_TIME';
  if (normalized.includes('part')) return 'PART_TIME';
  if (normalized.includes('contract')) return 'CONTRACTOR';
  if (normalized.includes('temporary')) return 'TEMPORARY';
  if (normalized.includes('intern')) return 'INTERN';
  return 'OTHER';
}

function htmlListSection(label, items = []) {
  const values = items.filter(Boolean);
  if (!values.length) return '';
  return `<p>${esc(label)}</p><ul>${values.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function jobDescriptionHtml(job) {
  const parts = [
    `<p>${esc(job.summary)}</p>`,
    ...(job.description || []).map((paragraph) => `<p>${esc(paragraph)}</p>`),
    job.department ? `<p>Department: ${esc(job.department)}</p>` : '',
    job.location ? `<p>Location: ${esc(job.location)}</p>` : '',
    job.workStyle ? `<p>Working arrangement: ${esc(job.workStyle)}</p>` : '',
    job.employmentType ? `<p>Employment type: ${esc(job.employmentType)}</p>` : '',
    job.experience ? `<p>Experience: ${esc(job.experience)}</p>` : '',
    htmlListSection('Technology and skills', job.technologies),
    htmlListSection('Industry context', job.industries),
    htmlListSection('Responsibilities', job.responsibilities),
    htmlListSection('Qualifications', job.qualifications),
    htmlListSection('Preferred qualifications', job.preferredQualifications),
    htmlListSection('Working style', job.workingStyle),
    job.locationDetails ? `<p>Location details: ${esc(job.locationDetails)}</p>` : '',
    htmlListSection('Employment terms', job.benefits)
  ];
  return parts.filter(Boolean).join('');
}

function jobDescriptor(path, job) {
  return descriptor(path, {
    label: job.title,
    title: `${job.title} | Careers | RC IT Services`,
    description: job.summary,
    image: IMAGES.careersJob || IMAGES.careers,
    index: JOB_SEARCH_INDEXING_ENABLED
  }, { kind: 'job', job });
}

function applicationDescriptor(path, job) {
  const jobPath = `/careers/jobs/${job.slug}`;
  return descriptor(path, {
    label: `Apply for ${job.title}`,
    title: `Apply for ${job.title} | RC IT Services`,
    description: `Application route for the published ${job.title} vacancy at RC IT Services.`,
    image: IMAGES.careersResume || IMAGES.careers,
    index: false
  }, { kind: 'job-application', job, parentPath: jobPath, parentLabel: job.title });
}

export function getSeoForRoute(pathName) {
  const path = normaliseSeoPath(pathName);
  if (STATIC_PAGE_SEO[path]) return descriptor(path, STATIC_PAGE_SEO[path]);
  if (SERVICE_PAGES[path]) return serviceDescriptor(path, SERVICE_PAGES[path]);
  if (INDUSTRY_PAGES[path]) return industryDescriptor(path, INDUSTRY_PAGES[path]);

  const detail = findServiceDetail(path);
  if (detail) return serviceDetailDescriptor(path, detail);

  const applicationMatch = path.match(/^\/careers\/jobs\/([^/]+)\/apply$/);
  if (applicationMatch) {
    const job = getPublishedJob(applicationMatch[1]);
    return job ? applicationDescriptor(path, job) : null;
  }

  const jobMatch = path.match(/^\/careers\/jobs\/([^/]+)$/);
  if (jobMatch) {
    const job = getPublishedJob(jobMatch[1]);
    return job ? jobDescriptor(path, job) : null;
  }

  return null;
}

export function getPrerenderRoutes() {
  const serviceDetails = Object.entries(SERVICE_PAGES).flatMap(([servicePath, page]) =>
    (page.howWeHelp || []).map((item) => `${servicePath}/${item.slug}`)
  );
  const jobs = getPublishedJobs().flatMap((job) => [
    `/careers/jobs/${job.slug}`,
    `/careers/jobs/${job.slug}/apply`
  ]);
  return [...new Set([...ALL_ROUTES, ...serviceDetails, ...jobs])];
}

export function getIndexableRoutes() {
  return getPrerenderRoutes().filter((route) => getSeoForRoute(route)?.index === true);
}

export function breadcrumbsForRoute(pathName) {
  const seo = getSeoForRoute(pathName);
  if (!seo || seo.path === '/') return [{ name: 'Home', path: '/' }];

  const crumbs = [{ name: 'Home', path: '/' }];
  if (seo.kind === 'service-detail') crumbs.push({ name: seo.parentLabel, path: seo.parentPath });
  if (seo.kind === 'job' || seo.kind === 'job-application') crumbs.push({ name: 'Careers', path: '/careers' });
  if (seo.kind === 'job-application') crumbs.push({ name: seo.parentLabel, path: seo.parentPath });
  crumbs.push({ name: seo.label, path: seo.path });
  return crumbs;
}

function organizationPostalAddress() {
  const parts = String(COMPANY.registeredOffice || '').split(',').map(text).filter(Boolean);
  if (parts.length !== 4) {
    throw new Error('COMPANY.registeredOffice must contain street, locality, region and postcode for Organization structured data.');
  }
  const [streetAddress, addressLocality, addressRegion, postalCode] = parts;
  return {
    '@type': 'PostalAddress',
    streetAddress,
    addressLocality,
    addressRegion,
    postalCode,
    addressCountry: 'GB'
  };
}

function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    legalName: COMPANY.legalName,
    identifier: COMPANY.companyNumber,
    url: `${SITE_ORIGIN}/`,
    description: 'Technology consulting, engineering and managed delivery across software, cloud, data, cyber security and business transformation.',
    address: organizationPostalAddress()
  };
}

function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: `${SITE_ORIGIN}/`,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    inLanguage: 'en-GB'
  };
}

function breadcrumbSchema(pathName) {
  const crumbs = breadcrumbsForRoute(pathName);
  if (crumbs.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl(pathName)}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path)
    }))
  };
}

function serviceSchema(seo) {
  return {
    '@type': 'Service',
    '@id': `${seo.canonical}#service`,
    name: seo.service.name,
    serviceType: seo.service.serviceType,
    description: seo.service.description,
    url: seo.canonical,
    provider: { '@id': `${SITE_ORIGIN}/#organization` },
    areaServed: { '@type': 'Country', name: 'United Kingdom' }
  };
}

export function createJobPostingSchema(seo) {
  const job = seo.job;
  const locality = /london/i.test(job.location || '') ? 'London' : undefined;
  const posting = {
    '@type': 'JobPosting',
    '@id': `${seo.canonical}#job`,
    title: job.title,
    description: jobDescriptionHtml(job),
    datePosted: job.postedDate,
    employmentType: employmentType(job.employmentType),
    identifier: {
      '@type': 'PropertyValue',
      name: SITE_NAME,
      value: job.jobCode || job.slug
    },
    hiringOrganization: { '@id': `${SITE_ORIGIN}/#organization` },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(locality ? { addressLocality: locality } : {}),
        addressCountry: 'GB'
      }
    },
    url: seo.canonical
  };

  if (job.responsibilities?.length) posting.responsibilities = text(job.responsibilities.join(' '));
  if (job.qualifications?.length) posting.qualifications = text(job.qualifications.join(' '));
  if (job.technologies?.length) posting.skills = text(job.technologies.join(', '));
  if (job.experience) posting.experienceRequirements = text(job.experience);
  if (job.closingDate) posting.validThrough = job.closingDate;
  return posting;
}

export function schemaGraphForRoute(pathName) {
  const seo = getSeoForRoute(pathName);
  if (!seo) return [];

  const graph = [organizationSchema(), websiteSchema(), {
    '@type': 'WebPage',
    '@id': `${seo.canonical}#webpage`,
    url: seo.canonical,
    name: seo.title,
    description: seo.description,
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    about: { '@id': `${SITE_ORIGIN}/#organization` },
    inLanguage: 'en-GB'
  }];

  const breadcrumb = breadcrumbSchema(seo.path);
  if (breadcrumb) graph.push(breadcrumb);
  if (seo.service) graph.push(serviceSchema(seo));
  if (seo.kind === 'job' && seo.index) graph.push(createJobPostingSchema(seo));
  return graph;
}

export function renderSeoHead(pathName) {
  const seo = getSeoForRoute(pathName);
  if (!seo) return '';
  const graph = schemaGraphForRoute(pathName);
  const robots = seo.index ? 'index,follow' : 'noindex,nofollow';
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');

  return [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="en_GB" />',
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    `<meta property="og:image" content="${esc(seo.image)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${esc(seo.image)}" />`,
    `<script type="application/ld+json">${json}</script>`
  ].join('\n  ');
}

export function renderNotFoundSeoHead() {
  return [
    '<title>Page Not Found | RC IT Services</title>',
    '<meta name="description" content="The requested RC IT Services page could not be found." />',
    '<meta name="robots" content="noindex,nofollow" />'
  ].join('\n  ');
}

export function renderSitemapXml() {
  const urls = getIndexableRoutes().map((route) => `  <url><loc>${xmlEsc(canonicalUrl(route))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    ''
  ].join('\n');
}

export function renderRedirectsFile() {
  return `${LEGACY_REDIRECTS.map(({ source, destination, status }) => `${source} ${destination} ${status}`).join('\n')}\n`;
}

export { JOB_SEARCH_INDEXING_ENABLED, LEGACY_REDIRECTS, SITE_NAME, SITE_ORIGIN };
