import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacts = await readFile(path.join(root, 'supabase/functions/admin-auth/contacts.ts'), 'utf8');
const migration = await readFile(path.join(root, 'supabase/migrations/20260914225000_phase_14_contact_reply_delivery.sql'), 'utf8');
const dataModel = await readFile(path.join(root, 'supabase/migrations/20260914023500_phase_14_contact_admin_data_model.sql'), 'utf8');
const dispatcher = await readFile(path.join(root, 'supabase/functions/transactional-email/index.ts'), 'utf8');
const contract = await readFile(path.join(root, 'supabase/functions/_shared/email-contract.js'), 'utf8');
const deliveryPath = path.join(root, 'supabase/functions/_shared/contact-reply-email-delivery.js');
const delivery = await readFile(deliveryPath, 'utf8');

// Composer stays inside the authenticated contact workspace and requires explicit POST + CSRF + version.
assert.match(contacts, /const REPLY_SUBJECT_MAX = 300/);
assert.match(contacts, /const REPLY_BODY_MAX = 10000/);
assert.match(contacts, /read-state\|workflow\|archive-state\|note\|reply/);
assert.match(contacts, /action="\$\{basePath\}\/contacts\/\$\{esc\(id\)\}\/reply"/);
assert.match(contacts, /name="subject"/);
assert.match(contacts, /name="body"/);
assert.match(contacts, /maxlength="\$\{REPLY_SUBJECT_MAX\}"/);
assert.match(contacts, /maxlength="\$\{REPLY_BODY_MAX\}"/);
assert.match(contacts, /Send reply/);
assert.match(contacts, /await csrfOk\(authState/);
assert.match(contacts, /p_expected_version: version/);
assert.match(contacts, /admin_queue_contact_reply_with_attachments/);
assert.match(contacts, /p_subject: subject, p_body: body/);
assert.match(contacts, /reply_validation/);
assert.match(contacts, /INVALID_RECIPIENT/);
assert.match(contacts, /Restore this enquiry before replying to the customer/);

// Reply identity is fixed and the browser cannot choose sender, reply-to, provider or recipient.
assert.match(contacts, /fact\("To", enquiry\.email/);
assert.match(contacts, /fact\("From", "contact@rcitcs\.com"/);
assert.match(contacts, /fact\("Reply-To", "contact@rcitcs\.com"/);
assert.doesNotMatch(contacts, /name="recipient_email"|name="sender_email"|name="reply_to_email"|RESEND_API_KEY/);
assert.match(contract, /CONTACT_ADMIN_REPLY: 'contact_admin_reply'/);
assert.match(contract, /case EMAIL_TEMPLATE_KEYS\.CONTACT_ADMIN_REPLY/);

// Database is the atomic source of truth: validate/lock, queue, persist reply, then history/audit.
assert.match(migration, /create or replace function public\.admin_queue_contact_enquiry_reply/);
assert.match(migration, /for update/);
assert.match(migration, /p_expected_version <> v_row\.version/);
assert.match(migration, /v_row\.archived_at is not null/);
assert.match(migration, /INVALID_RECIPIENT/);
assert.match(migration, /public\.enqueue_transactional_email/);
assert.match(migration, /'contact_admin_reply'/);
assert.match(migration, /'contact@rcitcs\.com'/);
assert.match(migration, /insert into public\.contact_enquiry_messages/);
assert.match(migration, /v_email_log_id/);
assert.match(migration, /'reply_queued'/);
assert.match(migration, /'contact_reply_queued'/);
assert.match(dataModel, /idempotency_key text not null unique/);
assert.match(dataModel, /email_log_id uuid unique references public\.email_logs/);
assert.match(dataModel, /direction text not null default 'outbound'/);

// Message content must not be copied into history/audit metadata.
assert.match(migration, /jsonb_build_object\('message_id', v_message_id, 'email_log_id', v_email_log_id\)/);
assert.doesNotMatch(migration, /jsonb_build_object\([^;]*(?:v_body|p_body|v_subject|p_subject)[^;]*\)/s);

// Browser roles cannot invoke reply authority.
assert.match(migration, /revoke all on function public\.admin_queue_contact_enquiry_reply\(uuid,uuid,integer,text,text,text,text\)[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.admin_queue_contact_enquiry_reply\(uuid,uuid,integer,text,text,text,text\)[\s\S]*to service_role/);

// Delivery remains on Phase-13 infrastructure; its published health contract stays backwards compatible.
assert.match(dispatcher, /dispatchContactReplyEmail/);
assert.match(dispatcher, /EMAIL_TEMPLATE_KEYS\.CONTACT_ADMIN_REPLY/);
assert.match(dispatcher, /loadContactReplyMessage/);
assert.match(dispatcher, /contactAdminReplies: true/);
assert.match(dispatcher, /contract: "phase13-admin-reset-v1"/);
assert.match(contacts, /transactional-email\/dispatch/);
assert.doesNotMatch(contacts, /api\.resend\.com|createResendEmailProvider|RESEND_API_KEY/);
assert.match(delivery, /retryAtForEmailFailure/);
assert.match(delivery, /markSent/);
assert.match(delivery, /markFailed/);

// The persisted reply drives the exact envelope and user content is escaped in HTML.
const { buildContactReplyEnvelope } = await import(`${pathToFileURL(deliveryPath).href}?phase14=${Date.now()}`);
const enquiryId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
const emailLogId = '33333333-3333-4333-8333-333333333333';
const key = `rcitcs/contact_admin_reply/contact_enquiry_message/${messageId}`;
const message = {
  id: messageId,
  enquiry_id: enquiryId,
  direction: 'outbound',
  sender_email: 'contact@rcitcs.com',
  recipient_email: 'customer@example.com',
  reply_to_email: 'contact@rcitcs.com',
  subject: 'Re: Platform enquiry',
  body_text: 'Hello <customer>\nSecond line',
  idempotency_key: key,
  email_log_id: emailLogId
};
const queue = {
  id: emailLogId,
  contact_enquiry_id: enquiryId,
  status: 'sending',
  provider: 'resend',
  template_key: 'contact_admin_reply',
  recipient_email: 'customer@example.com',
  sender_email: 'contact@rcitcs.com',
  reply_to_email: 'contact@rcitcs.com',
  subject: 'Re: Platform enquiry',
  idempotency_key: key
};
const envelope = buildContactReplyEnvelope(queue, message);
assert.equal(envelope.to, 'customer@example.com');
assert.equal(envelope.senderEmail, 'contact@rcitcs.com');
assert.equal(envelope.replyTo, 'contact@rcitcs.com');
assert.equal(envelope.idempotencyKey, key);
assert.equal(envelope.text, message.body_text);
assert.match(envelope.html, /Hello &lt;customer&gt;<br>Second line/);
assert.doesNotMatch(envelope.html, /Hello <customer>/);

console.log('Phase 14.8 customer reply composer, atomic persistence/queueing, fixed identity, escaping, idempotency, retry, backwards-compatible runtime health and audit-content isolation passed.');
