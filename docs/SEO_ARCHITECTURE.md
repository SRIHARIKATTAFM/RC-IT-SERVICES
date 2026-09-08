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

Compatibility aliases are redirects and never sitemap entries.

## Structured data policy

Every prerendered route receives Organization, WebSite and WebPage structured data. Service routes additionally receive Service schema. Nested public routes receive BreadcrumbList where applicable. Published job detail routes receive JobPosting based only on approved job-catalog fields; salary, sponsorship, benefits or other facts are not invented.

## Sitemap policy

The generated sitemap contains only routes whose centralized SEO descriptor is explicitly indexable. Legacy aliases, Login, application forms and unknown routes are excluded.

## Redirect and 404 policy

Historical compatibility URLs use permanent redirects to their canonical destinations. Production static-asset routing uses a real 404 page/status rather than returning the home SPA shell with HTTP 200 for unknown routes.

## Internal-link policy

Automated tests render every public route and reject links that point to legacy aliases or paths outside the known prerender route set.

## Phase boundary

This phase establishes public crawlability and SEO architecture only. Backend persistence, authentication, CMS/database-driven SEO management and the final custom-domain cutover remain later phases.
