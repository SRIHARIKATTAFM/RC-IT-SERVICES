import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const [migration, hardening, convergence, streamlined, db, index, routes, ui, worker, publicRepository, publicRuntime, wrangler] = await Promise.all([
  read('supabase/migrations/20260910152000_phase_11_job_management_cms.sql'),
  read('supabase/migrations/20260910161000_phase_11_job_management_hardening.sql'),
  read('supabase/migrations/20260910165000_phase_11_cms_spec_convergence.sql'),
  read('supabase/migrations/20260913023000_phase_12_job_authoring_simplification.sql'),
  read('supabase/functions/admin-auth/db.ts'),
  read('supabase/functions/admin-auth/index.ts'),
  read('supabase/functions/admin-auth/job-routes.ts'),
  read('supabase/functions/admin-auth/jobs.ts'),
  read('src/backend/runtime/worker.js'),
  read('src/backend/repositories/public-jobs-repository.js'),
  read('src/backend/runtime/public-careers.js'),
  read('wrangler.jsonc')
]);

for (const column of ['code text','experience text','technologies jsonb','responsibilities jsonb','qualifications jsonb','benefits jsonb','opens_at timestamptz','archived_at timestamptz','version integer']) {
  assert.ok(migration.includes(column), `Phase 11 schema field missing: ${column}`);
}
for (const fn of ['get_admin_job_management_context','admin_save_job','admin_transition_job','admin_duplicate_job','admin_delete_job']) {
  assert.ok(migration.includes(`function public.${fn}`), `Phase 11 authority missing: ${fn}`);
}
assert.ok(migration.includes("a.status = 'active'") && migration.includes("a.role = 'super_admin'"));
assert.ok(migration.includes('STALE_VERSION') && migration.includes('version = j.version + 1'));
assert.ok(migration.includes('for update'));
assert.ok(/security invoker/gi.test(migration));
assert.ok(!/security\s+definer/i.test(migration));

assert.ok(hardening.includes('get_public_careers_context'));
assert.ok(hardening.includes("j.opens_at is null or j.opens_at <= now()"));
assert.ok(hardening.includes("j.closes_at is null or j.closes_at > now()"));

assert.ok(convergence.includes('job_code_registry'));
assert.ok(convergence.includes('jobs_assign_job_code'));
assert.ok(convergence.includes('jobs_preserve_job_code'));
assert.ok(!/p_payload\s*->>\s*'code'/.test(convergence), 'Client payload must never control job code.');

for (const requestedCategory of [
  'Software Development','Data Engineering','Full Stack Development','DevOps','Network Engineering',
  'Frontend Engineering','Backend Engineering','Generative AI (Gen AI)'
]) assert.ok(streamlined.includes(requestedCategory), `Requested job category missing: ${requestedCategory}`);
assert.ok(streamlined.includes("jsonb_array_length(v_job.required_skills) = 0"));
assert.ok(streamlined.includes("coalesce(btrim(v_job.description), '') = ''"));
assert.ok(streamlined.includes("coalesce(btrim(v_job.location), '') = ''"));
assert.ok(streamlined.includes("coalesce(btrim(v_job.experience), '') = ''"));
assert.ok(!streamlined.includes('jsonb_array_length(v_job.responsibilities) = 0'), 'Responsibilities must remain optional in the streamlined publication gate.');
assert.ok(!streamlined.includes('jsonb_array_length(v_job.qualifications) = 0'), 'Qualifications must remain optional in the streamlined publication gate.');
assert.ok(/security invoker/gi.test(streamlined));
assert.ok(!/security\s+definer/i.test(streamlined));

for (const adapter of ['jobManagementContext','saveJob','transitionJob','duplicateJob','deleteJob']) assert.ok(db.includes(`function ${adapter}`));
assert.ok(index.includes('handleJobRoute'));
assert.ok(index.includes('originOk(request, url)'));

for (const route of ['/jobs/create','"edit"','"preview"','"delete"','"update"','"transition"','"duplicate"']) assert.ok(routes.includes(route));
assert.ok(routes.includes('shaHex(submitted) === state.csrf_token_hash'));
assert.ok(routes.includes('const intent = String(form.get("intent")'));
assert.ok(routes.includes('transitionJob(adminId,createdId,createdVersion,"publish"'), 'Create + Publish must be completed server-side in the same admin request flow.');
assert.ok(routes.includes('nextDate(closes)'), 'Selected end date must be stored as an exclusive next-day London boundary so it remains visible through the selected end date.');
assert.ok(routes.includes('Europe/London'));
assert.ok(!routes.includes('localStorage') && !routes.includes('sessionStorage'));

for (const capability of [
  'Create job','Edit job','Preview','Publish','Unpublish','Close','Archive','Restore','Duplicate',
  'Department / category','Position title','Office / job location','Work mode','Employment type','Experience required',
  'Required skills','Job description','Benefits','Response time','Start date','End date','Publish indefinitely / no end date',
  'Save draft','Advanced optional details'
]) assert.ok(ui.includes(capability), `Streamlined admin UI capability missing: ${capability}`);
assert.ok(ui.includes('data-rc-admin-modal="true"'), 'Create/Edit/Preview actions must explicitly request modal treatment.');
assert.ok(ui.includes('Generated automatically'));
assert.ok(ui.includes('generatedSlug(title)'));
assert.ok(!ui.includes('name="code"'), 'Job code must remain server-controlled.');
assert.ok(!ui.includes('id="job-slug"'), 'Administrator must not receive a visible URL-slug editor.');
assert.ok(!ui.includes('for="job-slug"'), 'Administrator must not receive a visible URL-slug label.');
assert.ok(ui.includes('type="hidden" name="slug"'), 'Existing canonical slugs must still be preserved during edits.');
assert.ok(ui.includes('name="no_expiry"'));
assert.ok(ui.includes('repeat(auto-fit,minmax('));

assert.ok(worker.includes('isPublicCareersRuntimePath'));
assert.ok(publicRepository.includes('getCareersContext'));
assert.ok(publicRepository.includes('requiredSkills'));
assert.ok(publicRuntime.includes('Apply for this role'));
assert.ok(publicRuntime.includes("robots = 'index,follow'"));

assert.ok(wrangler.includes('"pattern": "rcitcs.com"'));
assert.ok(wrangler.includes('"custom_domain": true'), 'Public apex must be a Worker Custom Domain so Cloudflare provisions DNS/certificate automatically.');
assert.ok(wrangler.includes('"pattern": "admin.rcitcs.com/*"'), 'Dedicated admin route must remain separate from the public apex.');

for (const source of [streamlined,routes,ui,wrangler]) {
  for (const secretPattern of ['SUPABASE_SERVICE_ROLE_KEY=','ADMIN_BOOTSTRAP_PASSWORD_VERIFIER=','sb_secret_']) {
    assert.ok(!source.includes(secretPattern), `Secret-like value leaked into job-authoring source: ${secretPattern}`);
  }
}

console.log('PASS: Phase 12 job authoring is streamlined to modal create/edit/preview, server-generated identifiers, one-step draft/publish, controlled categories, automatic availability windows and separate public/admin domains without weakening RBAC, CSRF, concurrency or audit authority.');
