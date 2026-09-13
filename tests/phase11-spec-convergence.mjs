import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const [prerequisite, migration, adminUi, overviewUi, securityUi, publicRepository, publicRuntime, careerInteractions] = await Promise.all([
  read('supabase/migrations/20260910151000_phase_11_legacy_schema_convergence.sql'),
  read('supabase/migrations/20260910165000_phase_11_cms_spec_convergence.sql'),
  read('supabase/functions/admin-auth/jobs.ts'),
  read('supabase/functions/admin-auth/ui.ts'),
  read('supabase/functions/admin-auth/security.ts'),
  read('src/backend/repositories/public-jobs-repository.js'),
  read('src/backend/runtime/public-careers.js'),
  read('src/frontend/app/interactions-careers.js')
]);

for (const prerequisiteContract of [
  'add column if not exists published_at timestamptz',
  'add column if not exists workplace_type text',
  'add column if not exists display_order integer not null default 0',
  "column_name = 'work_model'",
  'set workplace_type = work_model',
  "column_name = 'sort_order'",
  'set display_order = sort_order',
  'alter column description drop not null',
  "tgname = 'jobs_assign_job_code'",
  'alter column code drop not null'
]) assert.ok(prerequisite.includes(prerequisiteContract), `Clean Phase 8 -> Phase 11 convergence contract missing: ${prerequisiteContract}`);

for (const field of ['required_skills', 'preferred_skills', 'application_response_window']) {
  assert.ok(migration.includes(field), `Locked Phase 11 database field missing: ${field}`);
  assert.ok(adminUi.includes(field), `Locked Phase 11 admin field missing: ${field}`);
}

for (const requirement of [
  'job_code_registry', 'jobs_assign_job_code', 'jobs_preserve_job_code',
  'jobs_corporate_code_format_check', 'alter table public.jobs alter column code set not null',
  'get_job_content_document', 'server_generated', 'draft_deleted'
]) assert.ok(migration.includes(requirement), `Job identifier/content authority missing: ${requirement}`);

assert.ok(migration.includes("code ~ '^RC-[A-Z0-9]{2,5}-[0-9]{2}-[A-Z0-9]{3}-[A-Z0-9]{6}$'"));
assert.ok(migration.includes("metadata = metadata || jsonb_build_object('retired_reason', 'draft_deleted')"));
assert.ok(!/p_payload\s*->>\s*'code'/.test(migration));
assert.ok(!adminUi.includes('name="code"'), 'Admin form must not expose an editable job-code input.');
assert.ok(!adminUi.includes('form.get("code")'), 'Admin form parser must not accept a client-supplied job code.');
assert.ok(adminUi.includes('Generated automatically'));
assert.ok(adminUi.includes('Server-generated · immutable'));
assert.ok(adminUi.includes('Candidate-content preview'));

for (const candidateLabel of [
  'Required programming languages / technologies', 'Required skills', 'Preferred skills',
  'Response time', 'Industry context', 'Preferred qualifications',
  'Nature of working style', 'Location details'
]) assert.ok(adminUi.includes(candidateLabel), `Admin editor/preview omitted canonical candidate field: ${candidateLabel}`);

for (const [surface, source] of [['overview', overviewUi], ['jobs', adminUi], ['security', securityUi]]) {
  assert.ok(source.includes('${basePath}/jobs'), `Authenticated ${surface} workspace must expose Jobs navigation.`);
  assert.ok(source.includes('>Jobs<') || source.includes('<span>Jobs</span>'));
}
assert.ok(overviewUi.includes('This overview is intentionally read-only'));
assert.ok(securityUi.includes('Recruitment publishing is managed from the Jobs workspace.'));

for (const mapping of ['requiredSkills', 'preferredSkills', 'applicationResponseWindow']) assert.ok(publicRepository.includes(mapping));
for (const label of ['Required skills', 'Preferred skills', 'Application response window', 'Industry context', 'Preferred qualifications', 'Nature of working style']) assert.ok(publicRuntime.includes(label));
assert.ok(publicRuntime.includes("robots = 'index,follow'"));
assert.ok(publicRuntime.includes("robots: 'noindex,nofollow'"));
assert.ok(publicRuntime.includes('Apply for this role'));
assert.ok(publicRuntime.includes('/apply'));

const runtimeNavigationGuard = 'if (selectRole(slug)) event.preventDefault();';
assert.ok(careerInteractions.includes(runtimeNavigationGuard));
assert.ok(!careerInteractions.includes('event.preventDefault();\n      selectRole(slug);'));

for (const source of [prerequisite,migration,adminUi,overviewUi,securityUi,publicRepository,publicRuntime,careerInteractions]) {
  for (const secretPattern of ['ADMIN_BOOTSTRAP_PASSWORD_VERIFIER=','SUPABASE_SERVICE_ROLE_KEY=','sb_secret_']) assert.ok(!source.includes(secretPattern));
}

console.log('PASS: Phase 11 immutable identifiers, canonical content authority, admin navigation and public candidate rendering remain preserved under the streamlined Phase 12 authoring UX.');
