import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const adminIndex = await readFile(path.join(root, 'supabase/functions/admin-auth/index.ts'), 'utf8');
const transactional = await readFile(path.join(root, 'supabase/functions/transactional-email/index.ts'), 'utf8');
const dataModel = await readFile(path.join(root, 'supabase/migrations/20260914023500_phase_14_contact_admin_data_model.sql'), 'utf8');
const appendOnly = await readFile(path.join(root, 'supabase/migrations/20260914024500_phase_14_contact_append_only_privileges.sql'), 'utf8');
const adminApi = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');
const replyMigration = await readFile(path.join(root, 'supabase/migrations/20260914225000_phase_14_contact_reply_delivery.sql'), 'utf8');
const assignmentMigration = await readFile(path.join(root, 'supabase/migrations/20260914231500_phase_14_contact_assignment.sql'), 'utf8');
const fkIndexes = await readFile(path.join(root, 'supabase/migrations/20260914232500_phase_14_contact_fk_indexes.sql'), 'utf8');
const emailContract = await readFile(path.join(root, 'supabase/functions/_shared/email-contract.js'), 'utf8');
const replyDelivery = await readFile(path.join(root, 'supabase/functions/_shared/contact-reply-email-delivery.js'), 'utf8');

// The admin ingress remains bounded. Phase-14 note/reply payloads fit below this ceiling.
assert.match(adminIndex, /const limit = .*path\.startsWith\("\/jobs"\) \? 131072 : 32768/);
assert.match(adminIndex, /if \(await requestTooLarge\(request, path\)\)/);
assert.match(contacts, /const NOTE_MAX = 10000/);
assert.match(contacts, /const REPLY_BODY_MAX = 10000/);
assert.match(contacts, /const REPLY_SUBJECT_MAX = 300/);

// All contact mutations remain authenticated, super-admin-only, POST-only, CSRF protected and version locked.
assert.match(contacts, /if \(!authState\) return loginPage/);
assert.match(contacts, /authState\.admin\.role !== "super_admin"/);
assert.match(contacts, /request\.method !== "POST" \|\| !mutationMatch/);
assert.match(contacts, /await csrfOk\(authState/);
assert.match(contacts, /expectedVersion\(form\)/);
for (const action of ['read-state', 'workflow', 'archive-state', 'note', 'reply', 'assignment']) {
  assert.ok(contacts.includes(action), `Missing Phase-14 action ${action}`);
}

// Original intake remains immutable; operational state lives in dedicated columns/tables.
assert.match(dataModel, /create or replace function public\.guard_contact_enquiry_update\(\)/);
assert.match(dataModel, /raise exception 'accepted contact enquiry intake is immutable'/);
assert.match(dataModel, /create trigger contact_enquiries_guard_update[\s\S]*before update on public\.contact_enquiries[\s\S]*execute function public\.guard_contact_enquiry_update\(\)/);
for (const table of ['contact_enquiry_history', 'contact_enquiry_notes', 'contact_enquiry_messages']) {
  assert.match(dataModel, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(dataModel, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(dataModel, new RegExp(`alter table public\\.${table} force row level security`));
}
assert.match(appendOnly, /revoke all on table[\s\S]*public\.contact_enquiry_history,[\s\S]*public\.contact_enquiry_notes,[\s\S]*public\.contact_enquiry_messages[\s\S]*from service_role/);
assert.match(appendOnly, /grant select, insert on table[\s\S]*public\.contact_enquiry_history,[\s\S]*public\.contact_enquiry_notes,[\s\S]*public\.contact_enquiry_messages[\s\S]*to service_role/);
assert.match(appendOnly, /revoke all on table[\s\S]*public\.contact_enquiry_history,[\s\S]*public\.contact_enquiry_notes,[\s\S]*public\.contact_enquiry_messages[\s\S]*from public, anon, authenticated/);

// The complete contact RPC surface is browser-inaccessible and service-role-only.
for (const fn of [
  'get_admin_contact_list', 'get_admin_contact_detail', 'admin_set_contact_read_state',
  'admin_transition_contact_enquiry', 'admin_set_contact_archive_state', 'admin_add_contact_enquiry_note'
]) {
  assert.match(adminApi, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`));
  assert.match(adminApi, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`));
}
for (const [migration, fn] of [
  [replyMigration, 'admin_queue_contact_enquiry_reply'],
  [assignmentMigration, 'admin_set_contact_assignment']
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`));
}

// Reply delivery is durable/idempotent and keeps provider authority out of the admin browser boundary.
assert.match(emailContract, /CONTACT_ADMIN_REPLY: 'contact_admin_reply'/);
assert.match(replyMigration, /public\.enqueue_transactional_email/);
assert.match(replyMigration, /insert into public\.contact_enquiry_messages/);
assert.match(replyMigration, /v_idempotency_key := 'rcitcs\/contact_admin_reply\/contact_enquiry_message\/'/);
assert.match(replyDelivery, /retryAtForEmailFailure/);
assert.match(transactional, /EMAIL_TEMPLATE_KEYS\.CONTACT_ADMIN_REPLY/);
assert.match(transactional, /contract: "phase13-admin-reset-v1"/);
assert.doesNotMatch(contacts, /api\.resend\.com|RESEND_API_KEY|createResendEmailProvider/);

// Customer/internal content is escaped before HTML rendering and raw provider failures are not exposed.
assert.match(contacts, /esc\(message \|\| "No message content was stored\."\)/);
assert.match(contacts, /esc\(note\.body \|\| ""\)/);
assert.match(contacts, /esc\(message\.body_text \|\| ""\)/);
assert.doesNotMatch(contacts, /event\.metadata/);
assert.doesNotMatch(contacts, /error_message|last_error/);
assert.match(contacts, /Customer emails and admin replies for this enquiry, newest first/);

// List/detail queries stay bounded and indexed for Phase-14 operating paths.
assert.match(contacts, /const PAGE_LIMIT = 25/);
assert.match(adminApi, /p_limit integer default 25/);
assert.match(adminApi, /v_limit integer := coalesce\(p_limit, 25\)/);
assert.match(adminApi, /if v_limit < 1 or v_limit > 100 then/);
assert.match(adminApi, /limit v_limit \+ 1/);
assert.match(adminApi, /limit v_limit/);
const detailLimits = adminApi.match(/limit 200/g) || [];
assert.ok(detailLimits.length >= 3, 'Detail history/notes/messages are not all bounded.');
assert.match(fkIndexes, /contact_enquiry_notes_admin_id_idx/);
assert.match(fkIndexes, /contact_enquiry_messages_created_by_admin_id_idx/);

// Assignment can only target the authenticated admin or NULL; the browser cannot submit an arbitrary admin id.
assert.match(assignmentMigration, /v_target := case when p_assigned then p_admin_id else null end/);
assert.doesNotMatch(contacts, /name="assigned_to"/);

// Public/admin site isolation and candidate-application communication remain outside this module.
assert.doesNotMatch(contacts, /candidate_messages|application_status|career@rcitcs\.com/);
assert.match(adminIndex, /ADMIN_PUBLIC_ORIGINS = new Set/);
assert.match(adminIndex, /https:\/\/admin\.rcitcs\.com/);
assert.doesNotMatch(contacts, /https:\/\/rcitcs\.com\/api/);

console.log('Phase 14 final acceptance: authorization, CSRF, optimistic concurrency, immutable intake, browser isolation, bounded retrieval, durable replies, assignment authority, privacy and performance-index contracts passed.');
