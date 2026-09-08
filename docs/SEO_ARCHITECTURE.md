# RC IT Services — SEO Architecture Contract

## Purpose

Phase 6 converts the public website from a client-rendered SPA shell into a build-time prerendered public site while retaining the existing client-side components and interactions. Search engines and non-JavaScript clients must receive route-specific HTML content, metadata and semantics directly in the initial response.

## Source of truth

`src/frontend/seo/seo-config.js` owns:

- public production origin
- static-page metadata
- legacy redirect definitions
- the deployment search-indexing gate
- the explicit job-search eligibility gate

`src/frontend/seo/seo-model.js` owns:

- canonical URL generation
- service/industry metadata derived from route data
- service-detail metadata
- job-route metadata
- index/noindex policy
- Open Graph and social metadata
- Organization, WebSite, WebPage, Service, BreadcrumbList and eligible JobPosting JSON-LD
- sitemap route selection and XML rendering
- robots rules
- redirect output

The current canonical origin defaults to the active Cloudflare production hostname. Phase 17 must set `PUBLIC_ORIGIN` to the approved custom production domain when that domain is configured. Canonicals must not point to an unconfigured future domain.

## Production indexability policy

Indexable on the primary production build now:

- canonical public marketing pages
- service pages
- service capability detail pages
- industry pages
- Careers landing page
- legal/public information pages

Noindex now:

- Login
- individual job detail routes while application submission is unavailable
- job application form routes
- future private/admin routes
- 404 responses

Login, job-detail and job-application URLs remain crawlable while carrying `noindex` in the prerendered HTML. They are deliberately **not** disallowed in `robots.txt`; a crawler must be able to fetch a page to observe its `noindex` rule. These routes are excluded from the sitemap while they are not search-eligible. Future private/admin data must be protected by authentication/authorization rather than relying on robots directives as a security boundary.

Compatibility aliases are redirects and never sitemap entries.

## Deployment search-indexing gate

Cloudflare Workers Builds exposes `WORKERS_CI_BRANCH`. Phase 6 uses that build-time branch identity to distinguish the primary `main` deployment from non-main branch previews.

`DEPLOYMENT_SEARCH_INDEXING_ENABLED` is true only when:

- the Workers build branch is `main`; or
- no Workers branch variable is present, which allows local/GitHub CI to validate the production SEO model deterministically.

For a non-main Cloudflare branch preview:

- the full route set is still prerendered for QA;
- every route descriptor is `noindex`;
- every prerendered HTML route contains `noindex,nofollow`;
- `getIndexableRoutes()` returns zero routes;
- `sitemap.xml` contains no URL entries;
- `robots.txt` does not advertise a sitemap;
- `robots.txt` allows crawling so a crawler can observe the page-level `noindex` directive;
- canonical URLs continue to reference the approved primary production origin rather than the preview hostname.

This prevents branch-preview URLs from becoming an alternate searchable copy without creating the contradictory `robots.txt` + `noindex` combination.

The Vercel deployment is retained only as a secondary live fallback. Its configuration applies `X-Robots-Tag: noindex, nofollow` globally so it does not compete with Cloudflare as a second indexable origin. Automatic Vercel Git deployment remains disabled; a live Vercel deployment must not be reported as carrying the new header until that configuration is actually deployed and verified.

## Job-search eligibility gate

The repository currently contains role profiles marked `published` for the Careers UI, but the real candidate application workflow is intentionally disabled until the approved backend/private storage work is implemented in Phase 12. A visible catalogue status is therefore **not** sufficient evidence that a route is eligible for Google Job Search.

`JOB_SEARCH_INDEXING_ENABLED` remains `false` until both of these conditions are true:

1. the vacancy is confirmed as a genuine, currently open position; and
2. candidates have a real working way to apply, with submission persisted or visibly failed rather than silently accepted.

While the gate is false:

- job-detail pages remain directly reachable and prerendered;
- job-detail pages are `noindex,nofollow`;
- job-detail pages are excluded from `sitemap.xml`;
- production HTML does **not** emit `JobPosting` structured data;
- application pages remain `noindex,nofollow`;
- `robots.txt` does not block either route family.

The pure JobPosting builder remains implemented and tested so Phase 12 can enable the production output only after the application and vacancy-state acceptance criteria are proven. Enabling the flag without those proofs is a policy violation, not a launch shortcut.

## Structured data policy

Every prerendered route receives Organization, WebSite and WebPage structured data. Service routes additionally receive Service schema. Nested public routes receive BreadcrumbList where applicable.

Organization legal identity and registered-address data are derived from the existing centralized company configuration rather than being duplicated inside the SEO model.

The candidate JobPosting model is derived only from the approved job catalog. Its description is generated as structured HTML from the visible job summary, department, location, working arrangement, employment type, experience, technologies, industry context, responsibilities, qualifications, working-style detail and employment terms so it represents the same vacancy users can read on the page. Salary, sponsorship, credentials or other facts are never invented.

Job application forms never receive JobPosting schema. Once the eligibility gate is legitimately enabled, JobPosting may exist only on the canonical single-job description route.

## Sitemap policy

The generated production sitemap contains only routes whose centralized SEO descriptor is explicitly indexable. Legacy aliases, Login, gated job routes, application forms and unknown routes are excluded. Non-main Cloudflare preview builds deliberately produce a valid sitemap document with zero URL entries.

## Redirect and 404 policy

Historical compatibility URLs use permanent redirects to their canonical destinations. Production static-asset routing uses a real 404 page/status rather than returning the home SPA shell with HTTP 200 for unknown routes. Cloudflare uses a single no-trailing-slash HTML policy so extension and trailing-slash variants converge on the clean canonical route.

## Internal-link policy

Automated tests render every public route and reject links that point to legacy aliases or paths outside the known prerender route set.

## Phase boundary

This phase establishes public crawlability and SEO architecture only. Backend persistence, authentication, job CMS authority, candidate application persistence, CMS/database-driven SEO management and the final custom-domain cutover remain later phases.
