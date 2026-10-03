import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = (await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8')).replace(/\r\n/g, '\n');

const rpcNames = [
  'get_admin_contact_list',
  'get_admin_contact_detail',
  'admin_set_contact_read_state',
  'admin_transition_contact_enquiry',
  'admin_set_contact_archive_state',
  'admin_add_contact_enquiry_note'
];

for (const name of rpcNames) {
  assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`, 'i'), `Missing ${name}`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated`, 'i'), `${name} must deny browser execution`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*?to service_role`, 'i'), `${name} must be service-role only`);
}

const functionBlocks = migration.split(/create or replace function public\./i).slice(1);
for (const block of functionBlocks) {
  if (!rpcNames.some((name) => block.startsWith(`${name}(`))) continue;
  assert.match(block, /from public\.admins a[\s\S]*a\.id = p_admin_id[\s\S]*a\.status = 'active'[\s\S]*a\.role = 'super_admin'/i);
  assert.match(block, /'FORBIDDEN'/i);
}

assert.match(migration, /v_limit < 1 or v_limit > 100/i);
assert.match(migration, /\(c\.last_activity_at, c\.id\) < \(p_before_activity, p_before_id\)/i);
assert.match(migration, /order by c\.last_activity_at desc, c\.id desc/i);
assert.match(migration, /'has_more'/i);
assert.match(migration, /'next_cursor'/i);
const listBlock = migration.match(/create or replace function public\.get_admin_contact_list[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.ok(listBlock.length > 0);
assert.doesNotMatch(listBlock, /'message'\s*,\s*c\.message/i, 'Inbox list must not expose full enquiry message');
assert.doesNotMatch(listBlock, /'phone'\s*,\s*c\.phone/i, 'Inbox list must not expose phone by default');
assert.match(listBlock, /v_read_state not in \('all','read','unread'\)/i);
assert.match(listBlock, /v_archive_state not in \('active','archived','all'\)/i);

const detailBlock = migration.match(/create or replace function public\.get_admin_contact_detail[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.ok(detailBlock.length > 0);
for (const field of ['phone', 'message', 'consent', 'metadata']) {
  assert.match(detailBlock, new RegExp(`'${field}'`, 'i'));
}
assert.match(detailBlock, /limit 200/i);
assert.match(detailBlock, /left join public\.email_logs/i);
assert.match(detailBlock, /'delivery_status'/i);

for (const name of ['admin_set_contact_read_state', 'admin_transition_contact_enquiry', 'admin_set_contact_archive_state', 'admin_add_contact_enquiry_note']) {
  const block = migration.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;\\n`, 'i'))?.[0] ?? '';
  assert.ok(block.length > 0, `${name} block missing`);
  assert.match(block, /for update/i, `${name} must lock the parent enquiry`);
  assert.match(block, /p_expected_version/i, `${name} must require expected version`);
  assert.match(block, /'STALE_VERSION'/i, `${name} must reject stale writes`);
}

const readBlock = migration.match(/create or replace function public\.admin_set_contact_read_state[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.match(readBlock, /first_read_at = coalesce\(first_read_at, now\(\)\), read_at = now\(\)/i);
assert.match(readBlock, /set read_at = null/i);
assert.doesNotMatch(readBlock, /set status\s*=/i);
assert.match(readBlock, /'NO_CHANGE'/i);
assert.match(readBlock, /v_event\s*:=\s*'read'/i);
assert.match(readBlock, /v_event\s*:=\s*'marked_unread'/i);
assert.match(readBlock, /'contact_'\s*\|\|\s*v_event/i);

const transitionBlock = migration.match(/create or replace function public\.admin_transition_contact_enquiry[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.match(transitionBlock, /v_target not in \('open','in_progress','resolved','closed','spam'\)/i);
assert.match(transitionBlock, /'INVALID_TRANSITION'/i);
assert.match(transitionBlock, /v_row\.archived_at is not null/i);
assert.match(transitionBlock, /resolved_at/i);
assert.match(transitionBlock, /closed_at/i);
assert.match(transitionBlock, /contact_status_/i);

const archiveBlock = migration.match(/create or replace function public\.admin_set_contact_archive_state[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.match(archiveBlock, /status not in \('resolved','closed','spam'\)/i);
assert.match(archiveBlock, /'INVALID_ARCHIVE_STATE'/i);
assert.match(archiveBlock, /archived_at = case when p_archive then now\(\) else null end/i);
assert.match(archiveBlock, /'NO_CHANGE'/i);
assert.match(archiveBlock, /v_event\s*:=\s*case when p_archive then 'archived' else 'restored' end/i);
assert.match(archiveBlock, /'contact_'\s*\|\|\s*v_event/i);

const noteBlock = migration.match(/create or replace function public\.admin_add_contact_enquiry_note[\s\S]*?\$\$;\r?\n/i)?.[0] ?? '';
assert.match(noteBlock, /char_length\(v_body\) > 10000/i);
assert.match(noteBlock, /insert into public\.contact_enquiry_notes/i);
assert.match(noteBlock, /contact_note_added/i);
assert.doesNotMatch(noteBlock, /enqueue_transactional_email|api\.resend\.com|RESEND_API_KEY/i);

for (const literal of ['contact_status_', 'contact_note_added']) {
  assert.ok(migration.includes(literal), `Missing audit/history action ${literal}`);
}
assert.match(migration, /jsonb_build_object\('source','phase_14_contact_admin'\)/i);
assert.doesNotMatch(migration, /before_data[^;]*v_row\.message/i);
assert.doesNotMatch(migration, /after_data[^;]*v_body/i);
assert.doesNotMatch(migration, /RESEND_API_KEY|api\.resend\.com|http_post|net\.http_post/i);

console.log('Phase 14.3 server-authoritative contact admin API contract checks passed.');
