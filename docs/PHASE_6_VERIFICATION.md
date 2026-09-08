# Phase 6 Verification — SEO Architecture

## Result

**Phase 6 — SEO architecture: COMPLETED & VERIFIED.**

Phase 6 converts the public RC IT Services site from a client-rendered SPA shell into a build-time prerendered public site with centralized SEO ownership, route-specific metadata, structured data, sitemap/robots generation, permanent redirects and genuine 404 handling while preserving the approved public UX and Phase 5 performance boundaries.

Phase 7 backend foundation was not started as part of this work.

## Production implementation

Implementation PR: `#6 — Phase 6: SEO architecture`

Final reviewed PR head before merge:

`49d57ded7cb65977e5f464d303fb35dcbd01458c`

Production implementation commit on `main`:

`94f93d46efdf232476b95fd57e89e5428ce61e17`

Primary production origin verified:

`https://rcitcservices.frsmkgit.workers.dev`

Cloudflare Workers Build for the merged production commit:

- Build ID: `89dffb02-d561-4a6c-8f36-799f9e04d713`
- Version ID: `e8eb68f1-e893-4712-9f7a-bcfa4824be31`
- result: success

## Implemented SEO architecture

Phase 6 established:

- centralized metadata and indexability ownership in `src/frontend/seo/`
- build-time prerendering for all public route families
- route-specific titles and descriptions
- self-referencing canonical URLs
- Open Graph metadata
- Twitter/social metadata
- `Organization` structured data
- `WebSite` structured data
- `WebPage` structured data
- `Service` structured data
- `BreadcrumbList` structured data
- a complete candidate `JobPosting` schema builder
- generated `sitemap.xml`
- generated `robots.txt`
- generated permanent redirect rules
- genuine static 404 handling instead of an SPA HTTP-200 fallback
- clean no-trailing-slash HTML routing
- internal-link validation against the known route model
- explicit noindex handling for non-search surfaces
- deployment-level indexability isolation for non-main Cloudflare previews
- source-level noindex isolation for the secondary Vercel fallback
- production SEO, redirect, 404 and cache verification in CI

## Route and indexability result

The verified production build reports:

- **158 prerendered HTML routes**
- **65 currently eligible indexable URLs**
- **46 gated job-detail routes**
- **46 job-application routes** included in the prerender route model but excluded from search

The job count is deliberately not reported as 46 live Google JobPosting results. Individual role pages are currently directly reachable but remain `noindex,nofollow`, are excluded from the sitemap and do not emit `JobPosting` structured data until the real candidate application workflow is operational and the vacancy is confirmed genuinely active.

## Job-search eligibility correction

The first Phase 6 implementation treated the Careers catalogue's `published` UI status as sufficient for emitting `JobPosting` structured data. Review rejected that assumption.

The current job application page intentionally does not persist applications or uploaded documents yet. A user cannot complete a real production application until the later candidate workflow and private storage are implemented.

Phase 6 therefore introduced an explicit `JOB_SEARCH_INDEXING_ENABLED` gate. It remains `false` until both conditions are proven:

1. the vacancy is a genuine, currently open position; and
2. the application route provides a real working submission path with persistence or an explicit failure state.

While the gate is false:

- job-detail URLs remain directly reachable and prerendered
- job-detail URLs are `noindex,nofollow`
- job-detail URLs are excluded from `sitemap.xml`
- production HTML does not emit `JobPosting`
- job-application routes are `noindex,nofollow`
- neither route family is blocked by `robots.txt`, allowing crawlers to observe `noindex`

The pure `JobPosting` builder remains implemented and tested for completeness so it can be enabled later only after the application and active-vacancy acceptance criteria are satisfied.

## Deployment-indexing isolation

Cloudflare Workers Builds exposes the source branch to the build. Phase 6 uses that branch identity so non-main branch previews cannot become a second searchable copy of the production site.

Verified branch-preview policy:

- full route set still prerenders for QA
- every preview route is `noindex,nofollow`
- preview sitemap contains zero URL entries
- preview `robots.txt` advertises no sitemap
- preview `robots.txt` remains crawlable so `noindex` can be observed
- preview canonicals continue to reference the primary production origin

The exact final Phase 6 PR head also received a successful Cloudflare preview build before merge.

Vercel remains a secondary fallback. Its committed configuration applies a global `X-Robots-Tag: noindex, nofollow` response policy so a future deployment of that configuration does not compete with Cloudflare as another indexable origin. Automatic Vercel Git deployment remains disabled; Phase 6 production verification only claims current fallback reachability, not that the older live fallback has already received the newly committed header.

## Defects found during review

Phase 6 was not accepted on the first green CI run. Review found and corrected several substantive issues:

### 1. Incomplete JobPosting description

The initial structured description was too abbreviated. The candidate schema builder now derives a complete description from the same approved role data visible to candidates, including department, location, working arrangement, employment type, experience, technologies, industry context, responsibilities, qualifications, preferred qualifications, working-style detail and employment terms.

No salary, sponsorship promise, credential or other unapproved fact is invented.

### 2. Contradictory robots/noindex handling

Login and application routes were initially both blocked in `robots.txt` and marked `noindex`. That prevents a crawler from fetching the page to observe the noindex directive.

The final model keeps those routes crawlable, excludes them from the sitemap and applies `noindex,nofollow` in the page/output policy.

### 3. Application canonical handling

Application routes initially risked treating the materially different job-detail page as their canonical duplicate. They now use self-referencing canonicals while remaining noindex.

### 4. Live CI robots assertion was stale

The production workflow still expected `/login` to be disallowed after the SEO model had been corrected. The workflow gate was repaired so implementation and verification enforce the same policy.

### 5. Unrelated formatting churn

Review found formatting-only compression in existing Worker and architecture-checker code. That scope pollution was removed so the Phase 6 diff remains maintainable and focused on actual SEO behavior.

### 6. JobPosting production eligibility

Review found that a syntactically valid JobPosting would still be inappropriate while the application workflow is intentionally disabled. Production JobPosting emission and job indexing were therefore gated until Phase 12 and active-vacancy verification provide the missing operational conditions.

### 7. Preview duplicate-indexing risk

Non-main Cloudflare previews needed their own explicit search-isolation policy. Phase 6 added a branch-aware deployment gate and automated preview regression test.

### 8. Vercel duplicate-origin risk

The secondary fallback configuration could otherwise act as another searchable copy. The committed Vercel configuration now has a global noindex response-header contract, enforced by architecture/build tests.

## Exact-SHA pre-merge verification

The final reviewed Phase 6 head `49d57ded7cb65977e5f464d303fb35dcbd01458c` passed GitHub Actions run `34257448690` (run #113).

The actual job log was reviewed rather than relying only on a green status indicator.

The log recorded:

- architecture ownership: **70 required paths verified**
- smoke tests: **26 routes plus API/server contracts passed**
- route rendering: **26 canonical routes, 3 compatibility aliases, 40 service-detail routes and 92 career detail/application routes passed**
- shared design-system regression: passed
- performance-routing regression: passed
- SEO model: **158 prerender routes, 65 currently eligible indexable routes, 46 gated job routes**
- Cloudflare preview SEO model: **158 prerender routes, zero indexable preview URLs**
- production prerender build: **158 route HTML files plus sitemap, robots and 404 output**
- SEO build verification: **65 eligible sitemap URLs**, crawler directives, redirects, structured data, fallback isolation and real 404 output passed

### Performance preservation

The final Phase 6 build remained inside the Phase 5 performance contract:

- main JavaScript: **2.3 KiB gzip**
- global CSS: **13.2 KiB gzip**
- initial main JS + global CSS: **15.5 KiB gzip**
- lazy JavaScript chunks: **58**
- largest lazy chunk: **20.3 KiB gzip**

This improved the main JavaScript transfer size relative to the verified Phase 5 baseline rather than regressing it.

## Cloudflare branch-preview verification

The exact final PR head received a successful Cloudflare Workers Build before merge:

- PR head: `49d57ded7cb65977e5f464d303fb35dcbd01458c`
- Cloudflare build ID: `e4173a57-e4ee-442e-b1c2-feec2948f92d`
- preview version ID: `d7adbe99-5672-4872-a095-e72f04b308e3`
- result: success

The preview SEO regression suite separately proved zero indexable URLs for non-main builds.

## Post-merge production verification

After PR #6 was merged, `main` triggered GitHub Actions run `34258146123` (run #114) against production commit `94f93d46efdf232476b95fd57e89e5428ce61e17`.

Both production jobs passed:

- Architecture, test and production build — **success**
- Verify live production routes — **success**

Cloudflare Workers Build for that exact production commit also completed successfully.

The production job directly queried `https://rcitcservices.frsmkgit.workers.dev` and verified the new Phase 6 deployment rather than accepting an earlier build.

### Live route verification

The production job verified HTTP 200 plus prerendered main content on:

- `/`
- `/careers`
- `/contact`
- `/services/it/cyber-security`
- `/services/it/consultancy-services/agile`
- `/careers/jobs/senior-data-engineer`
- `/privacy`

`/api/health` returned HTTP 200 with the expected healthy response.

### Live metadata and schema verification

Production checks proved:

- `/about-us` has the expected self canonical
- `/about-us` exposes Open Graph metadata and JSON-LD
- `/services/it/cyber-security` exposes `Service` structured data
- the service page exposes `BreadcrumbList`
- the Senior Data Engineer route uses its self canonical
- the gated job route is `noindex,nofollow`
- the gated job route does **not** emit `JobPosting`
- Login is `noindex,nofollow`

### Live sitemap and robots verification

Production checks proved:

- `sitemap.xml` is valid and contains eligible service URLs
- Login is absent from the sitemap
- application routes are absent from the sitemap
- gated job-detail URLs are absent from the sitemap
- `robots.txt` does not block Login or job routes from observing their noindex rules
- `robots.txt` disallows `/api/` and `/admin/`
- `robots.txt` advertises the production sitemap

### Live redirect and 404 verification

Production checks proved:

- a deliberately unknown route returns a genuine HTTP **404**
- the 404 output is `noindex,nofollow`
- the 404 page contains the user-facing Page not found state
- `/careers/job-opportunities` returns a permanent redirect to `/careers`

### Live cache/performance verification

Production checks proved:

- hashed application JavaScript has one-year immutable caching
- Careers, Services and Legal route stylesheets are present and return HTTP 200
- those hashed route stylesheets have immutable caching
- prerendered HTML uses `max-age=0, must-revalidate`

The secondary Vercel fallback's Home, Careers, Contact, Cyber Security and Privacy routes also remained reachable during the production gate.

## Multi-role review

### Product Owner

The phase improves search visibility architecture without changing the approved public navigation, content hierarchy or user journey. It deliberately avoids claiming the generated Careers catalogue as Google-ready vacancies until a genuine application workflow exists.

### Product/Solution Architect

SEO now has explicit ownership under `src/frontend/seo/`. Rendering, routing, metadata, indexability and deployment boundaries are deterministic and covered by architecture checks. The Cloudflare primary origin, preview builds and secondary fallback have distinct search responsibilities.

### Senior Frontend Engineer

Prerendered content is delivered in the initial HTML while the client-side application recognizes matching prerendered markup and binds existing interactions instead of unnecessarily re-rendering the page. Route-specific styles and lazy interaction loading remain intact.

### Backend Engineer

Phase 6 does not invent persistence or application success. API behavior remains within the existing phase boundary. API responses are explicitly noindex, and real candidate storage/application work remains deferred to the backend/database/application phases.

### Security Reviewer

`robots.txt` is not treated as an authorization boundary. Future private/admin data remains protected by the later authentication/authorization architecture. APIs and private/future admin paths are excluded from search semantics without confusing search directives with security controls.

### QA Engineer

Architecture, smoke, route-render, design-system, performance-routing, SEO-model, preview-indexing, build-output and live-production tests all passed. Production verification tested actual HTTP responses, redirects, 404 behavior and cache headers.

### SEO Reviewer

Titles, descriptions, canonicals, social metadata, structured data, sitemap, robots, noindex behavior, redirects, internal links, true 404 behavior, preview isolation and JobPosting eligibility have explicit contracts and automated protection.

### Performance Reviewer

Prerendering did not regress the Phase 5 asset budgets. Main JavaScript decreased to 2.3 KiB gzip while the combined initial JS and global CSS measured 15.5 KiB gzip. Immutable split-asset caching and HTML revalidation were verified live.

### End User

Public routes, navigation and interactions remain available while pages now arrive with useful initial HTML. Career role profiles remain readable, but the application submission is not falsely presented as operational until the later persistence workflow exists.

### Mobile User

Phase 6 did not redesign responsive layouts. Existing mobile-responsive and route-performance contracts stayed green; the full physical/device visual matrix remains the dedicated Phase 18 gate.

### Admin User

No admin CMS/authentication capability was invented in this phase. Job authority, application management and administrative operations remain correctly assigned to Phases 9–15.

## Deferred dependencies and phase boundaries

The following are intentionally not Phase 6 completion blockers because they belong to later approved phases:

- backend foundation — Phase 7
- database and private object storage — Phase 8
- admin authentication — Phase 9
- job-management CMS authority — Phase 11
- real candidate application persistence and document upload — Phase 12
- outbound transactional email/notifications — Phase 13
- final custom domain and email DNS — Phase 17
- final SEO/performance/accessibility audit — Phase 19

The intended later candidate journey remains:

`Job → Apply → candidate details → resume/CV + cover letter → validation → private persistence → internal recruitment/product-owner notification → candidate acknowledgement`

Resume/CV and cover-letter documents remain planned for supported PDF/DOC/DOCX formats with a maximum of 20 MB per document. A private storage provider such as the later approved Supabase/object-storage implementation can satisfy the storage boundary. Inbound aliases can use Cloudflare Email Routing to Gmail, while outbound notifications can use the approved Resend/Gmail/provider adapter after domain/sending configuration is available.

No part of that later workflow was faked to make Phase 6 appear complete.

## Closure

No open Phase 6 blocker remains after final code review, exact-SHA CI, Cloudflare preview build, all-role review, merge, Cloudflare production deployment and live production verification.

**Phase 6 — SEO architecture is COMPLETED & VERIFIED.**

**Phase 7 has not been started.**
