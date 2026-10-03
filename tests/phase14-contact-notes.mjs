import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const migration = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');

assert.match(contacts, /const NOTE_MAX = 10000/);
assert.match(contacts, /rpc\("admin_add_contact_enquiry_note"/);
assert.match(migration, /create or replace function public\.admin_add_contact_enquiry_note/);
assert.match(contacts, /\/note"/);
assert.match(contacts, /name="body"/);
assert.match(contacts, /maxlength="\$\{NOTE_MAX\}"/);
assert.match(contacts, /body\.length < 1 \|\| body\.length > NOTE_MAX/);
assert.match(contacts, /p_body: body/);

// Notes are explicit POST operations with the same CSRF and optimistic concurrency boundary.
assert.match(contacts, /await csrfOk\(authState/);
assert.match(contacts, /p_expected_version: version/);
assert.match(migration, /p_expected_version integer/);
assert.match(migration, /STALE_VERSION/);
assert.match(contacts, /\?error=note_validation/);

// Archived records cannot receive new notes until restored.
assert.match(contacts, /!enquiry\.archived_at/);
assert.match(contacts, /Restore this enquiry before adding another internal note/);
assert.match(migration, /Restore the enquiry before adding an internal note/);

// Persisted note bodies are escaped and displayed as private administrative context.
assert.match(contacts, /Internal administrative notes/);
assert.match(contacts, /notes\.map/);
assert.match(contacts, /esc\(note\.body \|\| ""\)/);
assert.match(contacts, /white-space:pre-wrap/);
assert.match(contacts, /Administrator note/);
assert.match(contacts, /Internal only\. Note content is not copied into audit logs and is never emailed to the customer/);

// Database writes are append-only and audit metadata excludes note content.
assert.match(migration, /insert into public\.contact_enquiry_notes\(enquiry_id,admin_id,body\)/);
assert.match(migration, /insert into public\.contact_enquiry_history/);
assert.match(migration, /'note_added'/);
assert.match(migration, /'contact_note_added'/);
assert.match(migration, /jsonb_build_object\('source','phase_14_contact_admin','note_id',v_note\.id\)/);
assert.doesNotMatch(migration, /metadata[^;]*v_note\.body/s);

// Browser roles stay denied and only the service boundary may invoke note authority.
assert.match(migration, /revoke all on function public\.admin_add_contact_enquiry_note\(uuid,uuid,integer,text,text,text\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.admin_add_contact_enquiry_note\(uuid,uuid,integer,text,text,text\) to service_role/);

// Notes remain isolated from the later customer-reply path.
assert.match(contacts, /admin_add_contact_enquiry_note/);
assert.match(contacts, /admin_queue_contact_reply_with_attachments/);
assert.doesNotMatch(migration, /contact_note_added[^;]*body/s);

console.log('Phase 14.7 internal administrative notes, append-only persistence, escaping, CSRF/version locking, archive restrictions and no-email boundary passed.');
