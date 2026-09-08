# RC IT Services — Shared UI and Design-System Contract

## Purpose

Phase 4 converts reusable public UI from app-level helper ownership into explicit component and layout modules while preserving the approved RC IT Services visual language.

This is a cleanup and maintainability phase, not a redesign.

## Ownership

`src/frontend/components/` owns reusable presentation markup.

`src/frontend/layouts/` owns composition of shared presentation around route-owned page output.

`src/frontend/pages/` owns route-specific content and page composition.

`src/frontend/app/` owns runtime binding, data/configuration integration and compatibility facades. New presentation markup should not be added to the old `app/components.js` facade.

## Component API principles

1. Prefer focused functions over large configurable template engines.
2. Escape external/configured text at the component boundary.
3. Keep route decisions and API behaviour outside presentation components.
4. Reuse established CSS classes so Phase 4 does not change the approved appearance.
5. Preserve keyboard, focus, landmark and form-error semantics.
6. Add a shared primitive only when at least one real public surface benefits from it or when it defines an explicit system contract used by tests.

## Shared modules

- Core: escaping, icons, class composition
- Brand: shared RC lock-up
- Navigation: utility bar, desktop navigation, mega menus and mobile navigation
- Footer: corporate/legal footer
- Buttons: variant/size class composition and link-button markup
- Layout: responsive containers and section wrappers
- Content: breadcrumbs, page hero, section heading and CTA panel
- Cards: action, capability, industry, trust, topic, service-help, product and delivery-step patterns
- Forms: text fields, select fields, textareas, consent fields and action/status rows
- Feedback: dialog, status-message and toast primitives

## Design tokens

The token layer is the source for:

- brand and semantic colours
- surfaces and borders
- shadows and radii
- spacing scale
- default/narrow/wide responsive container widths
- typography scale and base line height
- field/control heights
- focus treatment
- layering/z-index
- motion timing

Phase 4 intentionally retains existing pixel/rem values where those values are already part of the approved visual language. Consolidation does not imply visual restyling.

## Accessibility contract

- Active navigation links expose `aria-current="page"` where applicable.
- Mobile navigation remains a modal navigation surface with labelled controls.
- Breadcrumbs retain a labelled landmark and current-page semantics.
- Shared form controls connect inputs to their error containers with `aria-describedby`.
- Form status output is a polite live region.
- Error toasts use alert semantics; normal toasts use status semantics.
- Dialogs retain labelled modal semantics, Escape close, focus restoration and tab-loop containment.

## Responsive contract

The existing `.container` remains the default public container. Phase 4 adds `.container--narrow` and `.container--wide` as controlled variants without changing existing page widths. Full device-matrix responsive QA remains Phase 18.

## Compatibility

`src/frontend/app/components.js` remains temporarily as a re-export facade so Phase 1–3 route modules do not need a risky all-at-once import rewrite. New work must use `src/frontend/components/` directly. The facade contains no presentation implementation.

## Verification

Phase 4 is gated by:

- architecture ownership checks
- full route rendering regression tests
- API/server smoke tests
- dedicated shared design-system contract tests
- optimized production build
- Cloudflare bundle/configuration verification
- live production route verification only after an approved merge to `main`
