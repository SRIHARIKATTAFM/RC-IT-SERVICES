import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const apiMigration = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');
const assignmentMigration = await readFile(path.join(root, 'supabase/migrations/20260914231500_phase_14_contact_assignment.sql'), 'utf8');

// Assignment is explicit, version-locked and limited to self/unassign authority.
assert.match(contacts, /reply\|assignment/);
assert.match(contacts, /\/assignment"/);
assert.match(contacts, /name="assigned" value="\$\{assignedTo \? "0" : "1"\}"/);
assert.match(contacts, /Assign to me/);
assert.match(contacts, /Unassign from me/);
assert.match(contacts, /rpc\("admin_set_contact_assignment"/);
assert.match(contacts, /p_assigned: assigned/);
assert.match(assignmentMigration, /create or replace function public\.admin_set_contact_assignment/);
assert.match(assignmentMigration, /p_expected_version <> v_row\.version/);
assert.match(assignmentMigration, /v_target := case when p_assigned then p_admin_id else null end/);
assert.match(assignmentMigration, /Restore the enquiry before changing assignment/);
assert.match(assignmentMigration, /'assigned'/);
assert.match(assignmentMigration, /'unassigned'/);
assert.match(assignmentMigration, /'contact_' \|\| v_event/);
assert.match(assignmentMigration, /revoke all on function public\.admin_set_contact_assignment\(uuid,uuid,integer,boolean,text,text\)[\s\S]*from public, anon, authenticated/);
assert.match(assignmentMigration, /grant execute on function public\.admin_set_contact_assignment\(uuid,uuid,integer,boolean,text,text\)[\s\S]*to service_role/);

// The detail projection remains bounded before rendering operational history.
for (const collection of ['contact_enquiry_history', 'contact_enquiry_notes', 'contact_enquiry_messages']) {
  assert.match(apiMigration, new RegExp(`from public\\.${collection}[\\s\\S]*?limit 200`), `${collection} is not bounded in detail projection`);
}
assert.match(contacts, /function contactActivityTimeline/);
assert.match(contacts, /Activity &amp; reply history/);
assert.match(contacts, /const history = Array\.isArray\(context\.history\)/);
assert.match(contacts, /const messages = Array\.isArray\(context\.messages\)/);
assert.match(contacts, /activities\.sort/);
assert.match(contacts, /Newest first/);

// Timeline renders only deliberate fields; arbitrary history metadata and provider errors are excluded.
assert.match(contacts, /timelineEventLabel/);
assert.match(contacts, /message\.subject/);
assert.match(contacts, /message\.body_text/);
assert.match(contacts, /message\.delivery_status/);
assert.match(contacts, /message\.sent_at/);
assert.match(contacts, /esc\(message\.body_text \|\| ""\)/);
assert.match(contacts, /white-space:pre-wrap/);
assert.doesNotMatch(contacts, /event\.metadata/);
assert.doesNotMatch(contacts, /error_message|last_error/);
assert.match(contacts, /Customer emails and admin replies for this enquiry, newest first/);

// Original customer evidence is still separate and immutable.
assert.match(contacts, /Accepted customer-submitted evidence is immutable after intake/);
assert.match(contacts, /Original customer intake remains immutable/);

console.log('Phase 14.9 assignment authority, bounded activity/reply history, safe rendering and operational separation passed.');
