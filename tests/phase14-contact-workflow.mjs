import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const migration = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');

for (const rpc of ['admin_set_contact_read_state', 'admin_transition_contact_enquiry', 'admin_set_contact_archive_state']) {
  assert.match(contacts, new RegExp(`rpc\\("${rpc}"`), `UI adapter does not call ${rpc}`);
  assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`), `Database authority missing ${rpc}`);
}

assert.match(contacts, /read-state\|workflow\|archive-state\|note\|reply/);
assert.match(contacts, /Contact mutations require a protected POST request/);
assert.match(contacts, /if \(request\.method !== "POST" \|\| !mutationMatch\)/);
assert.match(contacts, /await csrfOk\(authState, String\(form\.get\("csrf"\)/);
assert.match(contacts, /await shaHex\(submitted\) === state\.csrf_token_hash/);
assert.match(contacts, /expectedVersion\(form\)/);
assert.match(contacts, /p_expected_version: version/);
assert.match(contacts, /p_ip_hash: await requestIpHash\(request\)/);
assert.match(contacts, /p_user_agent:/);

assert.match(contacts, /name="read" value="\$\{enquiry\.read_at \? "0" : "1"\}"/);
assert.match(contacts, /Mark unread/);
assert.match(contacts, /Mark read/);
assert.match(contacts, /p_read: read/);
assert.match(migration, /set first_read_at = coalesce\(first_read_at, now\(\)\), read_at = now\(\)/);
assert.match(migration, /set read_at = null/);
assert.match(migration, /v_event := 'read'/);
assert.match(migration, /v_event := 'marked_unread'/);

const transitionGraph = {
  new: ['open', 'in_progress', 'resolved', 'spam'],
  open: ['in_progress', 'resolved', 'closed', 'spam'],
  in_progress: ['open', 'resolved', 'closed', 'spam'],
  resolved: ['open', 'closed'],
  closed: ['open'],
  spam: ['open']
};
for (const [from, targets] of Object.entries(transitionGraph)) {
  assert.match(contacts, new RegExp(`${from}: \\[${targets.map((v) => `"${v}"`).join(', ')}\\]`), `UI transition graph drifted for ${from}`);
  for (const target of targets) assert.ok(migration.includes(`'${target}'`), `Migration no longer contains target ${target}`);
}
assert.match(contacts, /p_target_status: target/);
assert.match(migration, /INVALID_TRANSITION/);
assert.match(contacts, /invalid_transition/);

assert.match(contacts, /\["resolved", "closed", "spam"\]\.includes\(status\)/);
assert.match(contacts, /name="archive" value="1"/);
assert.match(contacts, /name="archive" value="0"/);
assert.match(contacts, /Restore enquiry/);
assert.match(contacts, /Archive enquiry/);
assert.match(contacts, /p_archive: archive/);
assert.match(migration, /v_row\.status not in \('resolved','closed','spam'\)/);
assert.match(migration, /INVALID_ARCHIVE_STATE/);
assert.match(contacts, /if \(enquiry\.archived_at\)/);
assert.match(contacts, /Restore it before changing read state, workflow status, or internal notes/);
assert.match(migration, /Restore the enquiry before changing its read state/);

for (const code of ['STALE_VERSION', 'ARCHIVED', 'INVALID_TRANSITION', 'INVALID_ARCHIVE_STATE', 'VALIDATION', 'NOT_FOUND']) {
  assert.match(contacts, new RegExp(code));
}
assert.match(contacts, /This enquiry changed after the page was loaded/);
assert.match(contacts, /\?error=\$\{mutationErrorCode\(result\?\.code\)\}/);
assert.match(contacts, /status: 303/);
assert.match(contacts, /if \(!result \|\| result\.ok !== true\)/);
assert.match(contacts, /\?notice=\$\{notice\}/);
assert.match(contacts, /Enquiry marked as read/);
assert.match(contacts, /Workflow status updated/);
assert.match(contacts, /Enquiry archived/);

assert.doesNotMatch(contacts, /\/rest\/v1\/audit_logs/);
assert.doesNotMatch(contacts, /\/rest\/v1\/contact_enquiry_history/);
assert.match(migration, /insert into public\.contact_enquiry_history/);
assert.match(migration, /insert into public\.audit_logs/);

// Later explicit reply handling must remain a separate branch and may not alter the legal workflow graph.
assert.match(contacts, /action === "reply"|admin_queue_contact_reply_with_attachments/);

console.log('Phase 14.6 read/unread, legal workflow transitions, archive/restore, CSRF, optimistic concurrency, audit and explicit recovery contract passed.');
