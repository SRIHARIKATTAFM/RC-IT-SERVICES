# RC IT Services — SEO Architecture Contract

## Purpose

Phase 6 converts the public website from a client-rendered SPA shell into a build-time prerendered public site while retaining the existing client-side components and interactions. Search engines and non-JavaScript clients must receive route-specific HTML content, metadata and semantics directly in the initial response.

## Source of truth

`src/frontend/seo/seo-config.js` owns:

- public production origin
- static-page metadata
- legacy redirect definitions

`src/frontend/seo/seo-model.js` owns:

- canonical URL generation
- service/industry metadata derived from route data
- service-detail metadata
- published-job metadata
- index/noindex policy
- Open Graph and social metadata
- Organization, WebSite, WebPage, Service, BreadcrumbList and JobPosting JSON-LD
- sitemap route selection and XML rendering
- robots rules
- redirect output

The current canonical origin defaults to the active Cloudflare production hostname. Phase 17 must set `PUBLIC_ORIGIN` to the approved custom production domain when that domain is configured. Canonicals must not point to an unconfigured future domain.

## Indexability policy

Indexable:

- canonical public marketing pages
- service pages
- service capability detail pages
- industry pages
- Careers landing page
- published job detail pages
- legal/public information pages

Noindex:

- Login
- job application form routes
- future private/admin routes
- 404 responses

Login and job-application URLs remain crawlable while carrying `noindex` in the prerendered HTML and response-header policy. They are deliberately **not** disallowed in `robots.txt`; a crawler must be able to fetch a page to observe its `noindex` rule. They are excluded from the sitemap. Future private/admin data must be protected by authentication/authorization rather than relying on robots directives as a security boundary.

Compatibility aliases are redirects and never sitemap entries.

## Structured data policy

Every prerendered route receives Organization, WebSite and WebPage structured data. Service routes additionally receive Service schema. Nested public routes receive BreadcrumbList where applicable.

Published job detail routes receive JobPosting derived only from the approved job catalog. The JobPosting description is generated as structured HTML from the visible job summary, description, responsibilities, qualifications, skills, working style, location and employment terms so it represents the same vacancy users can read on the page. Salary, sponsorship, qualifications or other facts are never invented.

Job application forms do not receive JobPosting schema. JobPosting exists only on the canonical job-description route.

## Sitemap policy

The generated sitemap contains only routes whose centralized SEO descriptor is explicitly indexable. Legacy aliases, Login, application forms and unknown routes are excluded.

## Redirect and 404 policy

Historical compatibility URLs use permanent redirects to their canonical destinations. Production static-asset routing uses a real 404 page/status rather than returning the home SPA shell with HTTP 200 for unknown routes. Cloudflare uses a single no-trailing-slash HTML policy so extension and trailing-slash variants converge on the clean canonical route.

## Internal-link policy

Automated tests render every public route and reject links that point to legacy aliases or paths outside the known prerender route set.

## Phase boundary

This phase establishes public crawlability and SEO architecture only. Backend persistence, authentication, CMS/database-driven SEO management and the final custom-domain cutover remain later phases.
