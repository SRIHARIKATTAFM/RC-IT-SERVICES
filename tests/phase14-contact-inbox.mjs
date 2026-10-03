import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const index = await readFile(path.join(root, 'supabase/functions/admin-auth/index.ts'), 'utf8');
const ui = await readFile(path.join(root, 'supabase/functions/admin-auth/ui.ts'), 'utf8');
const jobs = await readFile(path.join(root, 'supabase/functions/admin-auth/jobs.ts'), 'utf8');
const applications = await readFile(path.join(root, 'supabase/functions/admin-auth/applications.ts'), 'utf8');
const security = await readFile(path.join(root, 'supabase/functions/admin-auth/security.ts'), 'utf8');
const migration = await readFile(path.join(root, 'supabase/migrations/20260914030000_phase_14_contact_admin_api.sql'), 'utf8');

assert.match(index, /import \{ handleContactRoute \} from "\.\/contacts\.ts"/);
assert.match(index, /handleContactRoute\(\{ request, url, path, basePath, authState \}\)/);
assert.match(index, /contacts: true/);
assert.match(index, /phase12-candidate-application-workflow/);

// Inbox data remains sourced only from the verified bounded list RPC.
assert.match(contacts, /rpc\("get_admin_contact_list"/);
assert.match(contacts, /\/rest\/v1\/rpc\/\$\{name\}/);
for (const arg of ['p_admin_id', 'p_limit', 'p_status', 'p_read_state', 'p_archive_state', 'p_query', 'p_before_activity', 'p_before_id']) {
  assert.match(contacts, new RegExp(`\\b${arg}\\b`), `Missing locked RPC argument ${arg}`);
  assert.match(migration, new RegExp(`\\b${arg}\\b`), `Migration does not define ${arg}`);
}
// These cursor argument names were superseded by the Phase-14.3 list contract.
for (const obsolete of ['p_cursor_last_activity_at', 'p_cursor_id']) {
  assert.equal(contacts.includes(obsolete), false, `Obsolete list RPC argument leaked into inbox adapter: ${obsolete}`);
}

assert.match(contacts, /const PAGE_LIMIT = 25/);
assert.match(contacts, /cursor_at/);
assert.match(contacts, /cursor_id/);
assert.match(contacts, /p_before_activity: filters\.cursorAt/);
assert.match(contacts, /p_before_id: filters\.cursorId/);
assert.match(contacts, /rel="next"/);
assert.doesNotMatch(contacts, /\boffset\b/i);

assert.match(contacts, /slice\(0, 200\)/);
assert.match(contacts, /CONTACT_STATUSES/);
assert.match(contacts, /READ_FILTERS/);
assert.match(contacts, /ARCHIVE_FILTERS/);
assert.match(contacts, /name="q"/);
assert.match(contacts, /name="status"/);
assert.match(contacts, /name="read"/);
assert.match(contacts, /name="archive"/);

// Exact route matching prevents new mutation handlers from changing the GET inbox contract.
assert.match(contacts, /path !== "\/contacts" && !liveScript && !detailMatch && !attachmentMatch && !mutationMatch/);
assert.match(contacts, /if \(request\.method === "GET"\)/);
assert.match(contacts, /const filters = normalizeFilters\(url\)/);
assert.match(contacts, /inboxPage\(basePath, authState, await contactList\(adminId, filters\), filters\)/);
assert.doesNotMatch(contacts, /item\.message/);
assert.doesNotMatch(contacts, /item\.phone/);
assert.match(contacts, /customer message and phone remain detail-only fields/i);

assert.match(contacts, /if \(!authState\) return loginPage/);
assert.match(contacts, /authState\.admin\.role !== "super_admin"/);
assert.match(contacts, /apikey: API_KEY/);
assert.doesNotMatch(contacts, /SUPABASE_ANON|publishable/i);

assert.match(contacts, /item\.name/);
assert.match(contacts, /item\.email/);
assert.match(contacts, /item\.company/);
assert.match(contacts, /item\.subject/);
assert.match(contacts, /item\.status/);
assert.match(contacts, /item\.last_activity_at/);
assert.match(contacts, /detailHref = UUID\.test\(id\)/);
assert.match(contacts, />View<\/a>/);

assert.match(contacts, /import \{ adminHeader, authPage, esc, loginPage, prettyTime, shell/);
assert.match(contacts, /adminHeader\(basePath, session, "contacts"\)/);
assert.match(contacts, /esc\(item\.name/);
assert.match(contacts, /esc\(item\.email/);
assert.match(contacts, /aria-labelledby="contacts-title"/);
assert.match(contacts, /scope="col"/);
assert.match(contacts, /No enquiries match this view/);
assert.match(contacts, /@media\(max-width:900px\)/);
assert.match(contacts, /@media\(max-width:600px\)/);

assert.match(ui, /export function adminHeader\(/);
for (const navLabel of ['Overview', 'Jobs', 'Applications', 'Contacts', 'Security']) {
  assert.match(ui, new RegExp(`<span>${navLabel}<\\/span>`), `Shared desktop navigation is missing ${navLabel}`);
  assert.match(ui, new RegExp(`>${navLabel}<\\/a>`), `Shared mobile navigation is missing ${navLabel}`);
}
for (const [name, source, current] of [
  ['Jobs', jobs, 'jobs'], ['Applications', applications, 'applications'], ['Contacts', contacts, 'contacts'], ['Security', security, 'security']
]) {
  assert.match(source, /import \{ adminHeader,/i, `${name} does not import the shared admin navigation authority`);
  assert.match(source, new RegExp(`adminHeader\\(basePath, session, ["']${current}["']\\)`), `${name} does not select its shared navigation state`);
  assert.doesNotMatch(source, /function adminHeader\(/, `${name} still owns a duplicate admin header renderer`);
}
assert.match(ui, /adminHeader\(basePath,session,"overview"\)/);
assert.match(ui, /Open contact inbox/);
assert.match(contacts, /Protected workspace/);
assert.match(contacts, /Private customer data/);

console.log('Phase 14.4 contact inbox routing, RPC contract, privacy, filtering, keyset pagination, accessibility and shared navigation remain preserved.');
