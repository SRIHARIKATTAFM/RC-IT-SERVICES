import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const migration = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');

assert.match(contacts, /rpc\("get_admin_contact_detail"/);
assert.match(contacts, /p_admin_id: adminId/);
assert.match(contacts, /p_enquiry_id: enquiryId/);
assert.match(migration, /create or replace function public\.get_admin_contact_detail/);

assert.match(contacts, /const detailMatch = path\.match/);
assert.match(contacts, /\[0-9a-f\]\{8\}/i);
assert.match(contacts, /path !== "\/contacts" && !liveScript && !detailMatch && !attachmentMatch && !mutationMatch/);
assert.match(contacts, /if \(request\.method === "GET"\)/);
assert.match(contacts, /const enquiryId = detailMatch\[1\]\.toLowerCase\(\)/);
assert.match(contacts, /return contactDetailPage\(basePath, authState, context, url\)/);

// Opening detail remains non-mutating even as later explicit POST operations are added.
assert.match(contacts, /Opening this page does not change read state or workflow status/);
assert.match(contacts, /Explicit actions only/);
assert.match(contacts, /Contact mutations require a protected POST request/);
assert.match(contacts, /request\.method !== "POST" \|\| !mutationMatch/);

for (const field of ['name', 'email', 'phone', 'company', 'service', 'subject', 'message', 'consent', 'consent_at', 'source']) {
  assert.match(migration, new RegExp(`'${field}'`), `Detail RPC does not project immutable field ${field}`);
}
assert.match(contacts, /fact\("Phone", enquiry\.phone/);
assert.match(contacts, /const message = String\(enquiry\.message/);
assert.match(contacts, /esc\(message \|\| "No message content was stored\."\)/);
assert.match(contacts, /white-space:pre-wrap/);
assert.match(contacts, /Original enquiry/);
assert.match(contacts, /Accepted customer-submitted evidence is immutable after intake/);

for (const count of ['history_count', 'note_count', 'message_count']) assert.match(contacts, new RegExp(`context\\.${count}`));
for (const field of ['first_read_at', 'read_at', 'resolved_at', 'closed_at', 'archived_at', 'last_activity_at', 'updated_at', 'version']) {
  assert.match(contacts, new RegExp(`enquiry\\.${field}`), `Operational context missing ${field}`);
}
assert.match(migration, /limit 200/g);
assert.match(contacts, /metadata\.intent/);
assert.match(contacts, /metadata\.job_title/);
assert.match(contacts, /metadata\.submission_type/);
assert.doesNotMatch(contacts, /metadata\.request_id/);

assert.match(contacts, /context\.code === "NOT_FOUND"/);
assert.match(contacts, /"Enquiry not found"/);
assert.match(contacts, /context\.code === "FORBIDDEN"/);
assert.match(contacts, /"Contact record unavailable"/);
assert.match(contacts, /, 404\)/);
assert.match(contacts, /, 403\)/);
assert.match(contacts, /, 503\)/);

assert.match(contacts, /adminHeader\(basePath, session, "contacts"\)/);
assert.match(contacts, /href="\$\{basePath\}\/contacts">Back to contact inbox/);
assert.match(contacts, /detailHref = UUID\.test\(id\)/);
assert.match(contacts, /Immutable intake · operational context/);

console.log('Phase 14.5 enquiry detail workspace, immutable-intake rendering, explicit errors, privacy boundaries and no-auto-mutation-on-open contract passed.');
