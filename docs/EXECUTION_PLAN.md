# RC IT Services — Phase-Gated Execution Plan

**Purpose:** This document is the controlled working plan for restructuring and extending RC IT Services without breaking the approved public website.

**Rule:** A phase is marked complete only after implementation, code review, automated checks and regression verification pass. Work does not advance merely because files were created.

---

## Working roles applied to every phase

Each phase is reviewed from all of these perspectives:

- Product Owner — business requirement and user value
- Product/Solution Architect — long-term structure and boundaries
- Senior Frontend Engineer — maintainability, accessibility and UX
- Backend Engineer — data integrity, APIs and operations
- Security Reviewer — abuse cases and trust boundaries
- QA Engineer — functional and regression risk
- End User — clarity and task completion
- Mobile User — responsive usability
- Admin User — operational efficiency
- SEO Reviewer — crawlability and search semantics
- Performance Reviewer — loading cost and Core Web Vitals

---

# Master execution checklist

- [x] ~~Phase 1 — Full architecture and regression baseline~~ — COMPLETED & VERIFIED
- [x] ~~Phase 2 — Structured project foundation~~ — COMPLETED & VERIFIED
- [x] ~~Phase 3 — Frontend page-by-page migration~~ — COMPLETED & VERIFIED
- [x] ~~Phase 4 — Shared components and design-system cleanup~~ — COMPLETED & VERIFIED
- [x] ~~Phase 5 — Performance optimization~~ — COMPLETED & VERIFIED
- [x] ~~Phase 6 — SEO architecture~~ — COMPLETED & VERIFIED
- [ ] Phase 7 — Backend foundation
- [ ] Phase 8 — Database and storage architecture
- [ ] Phase 9 — Admin authentication and security
- [ ] Phase 10 — Admin dashboard
- [ ] Phase 11 — Job-management CMS
- [ ] Phase 12 — Candidate application workflow
- [ ] Phase 13 — Email/notification architecture
- [ ] Phase 14 — Contact-enquiry administration
- [ ] Phase 15 — Admin candidate communication
- [ ] Phase 16 — Audit logging/security hardening
- [ ] Phase 17 — Domain/subdomain configuration
- [ ] Phase 18 — Full responsive/mobile QA
- [ ] Phase 19 — SEO/performance/accessibility QA
- [ ] Phase 20 — Production release verification

---

## Phase 1 — Full architecture and regression baseline

### Objective
Create a verified baseline of everything that currently works before structural migration begins.

### Tasks
- inventory repository tree
- inventory runtime/build/deployment architecture
- enumerate public routes
- enumerate redirects and API routes
- map navigation and mega menus
- map services, industries, careers, legal and utility pages
- inventory CSS/JS ownership
- inventory public imagery and source documentation
- verify existing smoke tests
- verify Cloudflare deep-route behaviour
- verify Vercel fallback behaviour where available
- capture known technical debt and risks
- create regression contract

### Acceptance criteria
- current route matrix documented
- build command documented
- deployment model documented
- existing automated tests run successfully
- known issues explicitly recorded
- no public behaviour changed during the phase

### Verification record
- repository and route inventories captured in project documentation
- regression baseline created before structural migration
- build/deployment model recorded
- existing smoke/build checks passed before Phase 2 closure
- no intentional public design or navigation changes introduced by Phase 1

### Status
`~~Phase 1 — Full architecture and regression baseline~~ — COMPLETED & VERIFIED`

---

## Phase 2 — Structured project foundation

### Objective
Introduce professional source directories and module boundaries without changing public output.

### Tasks
- create `src/frontend` and `src/backend` boundaries
- create page/component/layout/router/style/config/util directories
- create controlled export/index conventions
- move/copy shared configuration into source ownership
- update build pipeline to consume structured source
- preserve current public bundle and routes
- add architecture lint/check scripts where useful

### Acceptance criteria
- source tree exists and has documented ownership
- build succeeds from new structure
- existing smoke tests pass
- protected public DOM/interaction behaviour remains intact
- no duplicate source-of-truth ambiguity for migrated modules

### Verification record
- `src/frontend` and `src/backend` ownership boundaries created
- production build consumes structured source
- architecture verification check added to CI
- smoke tests, source architecture check and production build completed successfully in GitHub Actions
- route behaviour remained under the regression contract

### Status
`~~Phase 2 — Structured project foundation~~ — COMPLETED & VERIFIED`

---

## Phase 3 — Frontend page-by-page migration

### Objective
Replace monolithic page-rendering ownership with explicit named page modules.

### Migration order
1. Home
2. About
3. Contact
4. Products
5. White Papers
6. Careers shell
7. Job detail/application surfaces
8. Services — IT
9. Services — Management
10. Services — Education
11. Industries
12. Legal/supporting pages

### Acceptance criteria per page
- explicit named page module exists
- route remains unchanged
- page content remains correct
- navigation state remains correct
- desktop and mobile rendering remain correct
- page-specific JS/CSS only loaded where justified
- existing interaction tests pass

### Verification record
- Home, About, Contact, Products, White Papers and Careers now have explicit route-level page modules
- Careers job-detail and job-application dynamic routes have explicit route-family modules
- every top-level IT, Management and Education service has an explicit named page module
- service capability Read More routes remain dedicated URLs and are owned by the shared service-detail route-family module rather than duplicate copy-pasted files
- every Industry route has an explicit named page module with shared industry composition isolated separately
- Blog, FAQs, Login, Privacy, Cookies, Terms and Not Found have explicit page ownership
- canonical routes and historical compatibility aliases are separated in configuration and routing
- stale standalone resume-upload and duplicate Consult our Expert page ownership were not reintroduced
- runtime mutation of Careers navigation/configuration was removed
- FAQ content was corrected to the consolidated job-specific application model and given a page-owned source
- legacy monolithic renderers and the old app router were deleted and are forbidden by the architecture check
- route rendering regression tests cover all canonical routes, compatibility aliases, every service capability route, every published job detail route and every job application route
- regression tests enforce unique canonical routes, aliases, service-capability slugs, published job slugs and published job codes
- Contact regression checks preserve Consultation topic, Email wording and optional Company / Organisation and Job Title fields
- final Phase 3 implementation head `2cebdc465f90e9b44e54535ddefb34a5d7c4c6a9` passed GitHub Actions run `34236130050`: architecture verification, smoke tests, page-render regression tests, optimized production build and Cloudflare bundle/config verification
- detailed evidence and multi-role review are recorded in `docs/PHASE_3_VERIFICATION.md`
- no intentional public redesign, navigation-flow change or responsive-layout change was introduced by the migration; full device-matrix visual QA remains the dedicated Phase 18 gate

### Status
`~~Phase 3 — Frontend page-by-page migration~~ — COMPLETED & VERIFIED`

---

## Phase 4 — Shared components and design-system cleanup

### Objective
Create reusable, deliberate UI primitives without changing the approved visual language.

### Scope
- header
- mega menus
- mobile navigation
- footer
- buttons
- cards
- section headings
- breadcrumbs
- forms
- field controls
- alerts/status messages
- modals/dialogs
- responsive containers
- spacing/type/design tokens

### Acceptance criteria
- duplicate markup/behaviour reduced
- shared component APIs are small and meaningful
- existing public appearance remains stable
- accessibility semantics improve or remain correct

### Verification record
- canonical shared presentation ownership established under `src/frontend/components/`
- shared public shell established under `src/frontend/layouts/site-shell.js`
- legacy `src/frontend/app/components.js` reduced to a compatibility re-export facade with architecture checks preventing it from regaining header/footer implementation ownership
- Home, Products, service-family pages and Contact migrated across representative repeated card/content/form patterns
- explicit design-system tokens added for spacing, responsive containers, typography, controls, focus treatment and layering while retaining approved visual baseline values
- active-navigation, breadcrumb, form-error, toast/status and dialog accessibility contracts preserved or improved
- dialog keyboard-handler lifetime and shared brand accessibility-label escaping were hardened during review
- dedicated design-system regression tests protect shared CSS hooks, semantics, visual baseline tokens and default responsive-container behaviour
- verified implementation head `e0123b8d1806eb21e23a30e4a907cea967fdf457` passed GitHub Actions run `34242305192` (run #76): architecture verification, API/server smoke tests, full route-render regression, design-system contract tests, optimized production build and Cloudflare bundle/config verification
- route regression remained green for 26 canonical routes, 3 compatibility aliases, 40 service-capability detail routes and 92 career detail/application routes
- live production route verification is intentionally deferred until an approved merge to `main`; the PR workflow correctly skips that production-only job
- detailed evidence and the all-role review are recorded in `docs/PHASE_4_VERIFICATION.md`
- Phase 5 work was not started

### Status
`~~Phase 4 — Shared components and design-system cleanup~~ — COMPLETED & VERIFIED`

---

## Phase 5 — Performance optimization

### Objective
Reduce page weight and work performed on routes that do not need it.

### Scope
- route/page code splitting
- dynamic imports
- dead-code removal
- CSS splitting/minification
- image sizing/compression/modern formats
- lazy loading
- font optimization
- immutable asset caching
- Cloudflare cache behaviour
- avoid loading job/admin data on unrelated routes

### Targets
- LCP < 2.5 s target
- INP < 200 ms target
- CLS < 0.1 target
- Lighthouse Performance 90+ target where reproducible

### Verification record
- route-level JavaScript and route-specific CSS splitting implemented
- route-specific interaction loading implemented
- responsive image and immutable hashed-asset caching contracts implemented
- production HTML revalidation verified
- compressed production bundle budgets enforced in CI
- final live Cloudflare verification passed after the production-verification race was corrected
- detailed implementation, production evidence and all-role review are recorded in `docs/PHASE_5_VERIFICATION.md`

### Status
`~~Phase 5 — Performance optimization~~ — COMPLETED & VERIFIED`

---

## Phase 6 — SEO architecture

### Objective
Make public content consistently crawlable, indexable and semantically clear.

### Scope
- centralized SEO metadata model
- unique titles/descriptions
- canonical URLs
- Open Graph/social metadata
- Organization/WebSite/WebPage schema
- Service schema
- BreadcrumbList
- JobPosting schema with production eligibility gating
- sitemap generation
- robots rules
- redirect and 404 hygiene
- internal-link checks
- non-main preview indexing isolation
- secondary-origin indexing isolation

### Acceptance criteria
- every currently indexable public route has explicit metadata
- private/non-search routes are noindex without using robots as a security boundary
- job-detail routes have canonical URLs; JobPosting output is enabled only when the vacancy is genuinely active and the real application workflow is operational
- sitemap contains only currently intended indexable public routes
- legacy aliases redirect permanently to canonical routes
- unknown routes return a genuine HTTP 404 rather than a SPA 200 fallback
- Cloudflare branch previews cannot become a second indexable copy
- Phase 5 performance boundaries remain intact

### Verification record
- `src/frontend/seo/seo-config.js` and `src/frontend/seo/seo-model.js` established as the SEO source of truth
- 158 build-time prerendered route HTML files generated
- 65 URLs currently eligible for the production sitemap/indexing model
- 46 job-detail routes deliberately gated from indexing and JobPosting output until the real application workflow and active-vacancy criteria are satisfied
- Login, job detail/application and 404 surfaces use explicit noindex behavior while remaining crawlable where noindex must be observed
- Organization, WebSite, WebPage, Service and BreadcrumbList JSON-LD verified
- candidate JobPosting builder implemented and regression-tested for complete approved vacancy content without premature production emission
- sitemap, robots, permanent redirects, real 404 handling, clean URL policy and internal-link validation implemented
- non-main Cloudflare builds are protected by a deployment search-indexing gate; preview tests verified zero indexable URLs
- secondary Vercel fallback source configuration is globally noindex to prevent duplicate-origin competition
- final Phase 6 PR head `49d57ded7cb65977e5f464d303fb35dcbd01458c` passed GitHub Actions run `34257448690` (run #113), including exact log review
- verified Phase 6 build measured main JS 2.3 KiB gzip, global CSS 13.2 KiB gzip and 15.5 KiB combined initial JS + global CSS
- PR #6 merged to production commit `94f93d46efdf232476b95fd57e89e5428ce61e17`
- Cloudflare Workers production build `89dffb02-d561-4a6c-8f36-799f9e04d713`, version `e8eb68f1-e893-4712-9f7a-bcfa4824be31`, completed successfully
- post-merge GitHub Actions run `34258146123` (run #114) passed both the build/test job and live production verification job
- live production verification proved prerendered deep routes, metadata, Service/Breadcrumb schema, gated-job noindex behavior, sitemap/robots policy, permanent redirect behavior, genuine 404 status, immutable split-asset caching, HTML revalidation, API health and Vercel fallback reachability
- detailed defect history, production evidence and all-role review are recorded in `docs/PHASE_6_VERIFICATION.md`
- Phase 7 work was not started

### Status
`~~Phase 6 — SEO architecture~~ — COMPLETED & VERIFIED`

---

## Phase 7 — Backend foundation

### Objective
Create backend layers independent of UI rendering.

### Scope
- API router/handlers
- validation layer
- service layer
- repositories/storage interfaces
- standardized API responses
- error model
- request IDs/logging hooks
- environment configuration
- provider interfaces for email/storage/database

### Acceptance criteria
- backend business logic no longer lives in public UI modules
- APIs have validation and predictable status codes
- no fake success responses for unconfigured persistence

---

## Phase 8 — Database and storage architecture

### Objective
Prepare persistent data and private document storage.

### Data domains
- admins
- sessions
- password reset tokens
- jobs/categories
- applications/documents
- application history
- contact enquiries
- candidate messages
- notifications
- email logs
- audit logs

### Storage
- private candidate documents
- signed/authorized admin retrieval
- max 20 MB resume
- max 20 MB cover letter document
- file type/MIME validation

### External dependency
Live completion requires approved production database/object-storage resources.

---

## Phase 9 — Admin authentication and security

### Objective
Protect the private administration application.

### Scope
- login/logout
- secure sessions
- change password
- forgot password
- reset password
- expiry/single-use reset tokens
- throttling
- security headers
- authorization middleware
- noindex/private caching rules
- session invalidation

### External dependency
Live password recovery requires outbound email configuration.

---

## Phase 10 — Admin dashboard

### Objective
Give administrators a concise operational overview.

### Dashboard modules
- open jobs
- drafts
- closed jobs
- new applications
- applications by status
- contact enquiries
- unread notifications
- recent activity

---

## Phase 11 — Job-management CMS

### Objective
Remove code edits from normal vacancy publishing.

### Capabilities
- create/edit
- draft/preview
- publish/unpublish
- close/archive/delete according to policy
- duplicate
- job category
- location
- work model
- employment type
- experience
- technologies
- description
- responsibilities
- qualifications
- benefits
- opening/closing dates

### Acceptance criteria
Published jobs automatically appear on public Careers and their canonical job route.

---

## Phase 12 — Candidate application workflow

### Objective
Implement a real job-specific application journey.

### Flow
`Job → Apply → Candidate form → documents → validation → persistence → notification → acknowledgement`

### Requirements
- job context cannot be lost
- 20 MB per supported document
- consent captured
- private document storage
- duplicate/invalid submission handling
- candidate confirmation
- admin notification

---

## Phase 13 — Email/notification architecture

### Objective
Centralize and professionalize transactional communication.

### Planned identities
- `info@rcitcs.com`
- `contact@rcitcs.com`
- `support@rcitcs.com`
- `career@rcitcs.com`
- `legal@rcitcs.com`
- `noreply@rcitcs.com`

### Provider model
- inbound may use Cloudflare Email Routing → Gmail
- outbound provider adapter supports Gmail API / Resend / approved alternative

### Templates
- contact acknowledgement
- internal contact alert
- application acknowledgement
- internal application alert
- status update
- interview invitation
- admin reply
- password reset
- password changed

### External dependency
Live completion requires the domain and approved sending provider credentials.

---

## Phase 14 — Contact-enquiry administration

### Objective
Persist and manage public enquiries.

### Capabilities
- enquiry list
- unread/read state
- topic/category
- contact details
- enquiry body
- assignment/status
- reply history where enabled
- internal notes

---

## Phase 15 — Admin candidate communication

### Objective
Allow authorized administrators to communicate with applicants from the application record.

### Capabilities
- reply composition
- professional RC email template
- status-based templates
- communication history
- delivery log
- sender identity `career@rcitcs.com`

### External dependency
Live delivery requires email provider configuration.

---

## Phase 16 — Audit logging/security hardening

### Objective
Make privileged operations accountable and reduce abuse risk.

### Scope
- audit admin login/logout
- job create/edit/publish/close actions
- candidate status changes
- document access
- outbound candidate messages
- password changes
- rate limits
- validation review
- security-header review
- dependency review
- secrets/configuration review

---

## Phase 17 — Domain/subdomain configuration

### Objective
Move from temporary provider URLs to the RC production domain.

### Planned DNS
- `www.rcitcs.com`
- `rcitcs.com`
- `admin.rcitcs.com`
- optional `api.rcitcs.com`
- staging hosts if approved

### Email DNS
- MX / forwarding as selected
- SPF
- DKIM
- DMARC

### External dependency
**Blocked until the domain is purchased and available.**

---

## Phase 18 — Full responsive/mobile QA

### Objective
Verify the complete public and admin product across supported viewport classes.

### Viewports
- 320–374 px
- 375–767 px
- 768–1023 px
- 1024–1279 px
- 1280+ px

### Scope
- navigation
- mega menus/mobile menu
- footer
- forms
- careers split view
- job application
- admin tables/forms
- dialogs
- legal pages
- touch targets
- horizontal overflow

---

## Phase 19 — SEO/performance/accessibility QA

### Objective
Run final non-functional quality gates.

### SEO
- metadata completeness
- schema validation
- sitemap
- robots
- canonicals
- crawlable links
- 404/redirects

### Performance
- production asset size
- Core Web Vitals-oriented review
- critical route Lighthouse runs where available
- caching/compression verification

### Accessibility
- semantics
- keyboard navigation
- visible focus
- form labels/errors
- contrast
- dialog/menu behaviour
- image alt text

---

## Phase 20 — Production release verification

### Objective
Verify the finished product in production before declaring release readiness.

### Production checks
- public root
- every navigation route
- every service route
- every industry route
- careers/search/grouping
- canonical job routes
- application submission
- contact submission
- admin login/reset/change password
- job publishing
- application visibility
- admin reply
- transactional email
- legal pages
- sitemap/robots
- Cloudflare health/API
- error behaviour
- mobile smoke suite

### Completion condition
Phase 20 can only close when all external production dependencies are configured and tested.

---

# Phase status protocol

The checklist in this file is the source of truth for project execution status.

A phase in progress remains unchecked:

`- [ ] Phase X — Name`

A phase that is genuinely implemented and verified is changed to:

`- [x] ~~Phase X — Name~~ — COMPLETED & VERIFIED`

If external infrastructure blocks live verification, record:

`- [ ] Phase X — Name — BLOCKED: <specific dependency>`

Never mark a blocked or partially implemented phase as complete.

---

# Regression protection rule

Before closing every phase:

1. review the diff/code again
2. run automated tests
3. run/build production output
4. verify impacted routes
5. inspect error and edge states
6. inspect desktop/mobile behaviour where affected
7. check that unrelated pages did not regress
8. update this plan only after verification

---

# Current status

Phase 1 through Phase 6 are completed and verified. Phase 7 has not been started.
