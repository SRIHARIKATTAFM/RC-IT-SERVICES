# Phase 11 Post-Merge Release Gate

Phase 11 implementation PR #28 merged successfully, but the first post-merge release audit found stale Phase 10 assumptions in the live-production workflow. This closure branch corrects only release verification and the corresponding admin proxy regression contract; it does not add Phase 12 functionality.

## Corrected release assertions

- Published canonical job pages are `index,follow` in Phase 11.
- Phase 11 still emits no `JobPosting` structured data and exposes no active Apply link until Phase 12 candidate intake is live.
- `/careers/jobs/<slug>/apply` remains a truthful disabled/noindex boundary in Phase 11.
- Supabase `admin-auth` health must report `jobs:true` and `design:"phase11-job-management-cms"`.
- Live admin verification is labelled Phase 11 rather than Phase 10.
- The authenticated admin proxy regression contract validates the current private noindex-header behavior without reasserting removed Phase 10-only source shapes.

## Gate

This branch may merge only after exact-head CI passes. After merge, the `main` push workflow must pass both the full quality suite and the `Verify live production routes` job before Phase 11 is finally closed and Phase 12 is opened.
