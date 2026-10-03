import {
  EMAIL_IDENTITIES,
  EMAIL_TEMPLATE_KEYS,
  createEmailEnvelope,
  normalizeEmail
} from './email-contract.js';
import { htmlEscape } from './email-templates.js';
import { retryAtForEmailFailure } from './email-retry-policy.js';
import { EmailProviderError } from './resend-email-provider.js';

function text(value) {
  return String(value ?? '').trim();
}

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

export function buildContactReplyEnvelope(queue, message) {
  if (!queue || typeof queue !== 'object') throw new TypeError('Contact reply email queue row is required.');
  if (!message || typeof message !== 'object') throw new TypeError('Persisted contact reply message is required.');

  const messageId = text(message.id);
  const enquiryId = text(message.enquiry_id);
  const body = text(message.body_text);
  const subject = text(message.subject).replace(/[\r\n]+/g, ' ');

  if (!uuid(messageId) || !uuid(enquiryId)) throw new TypeError('Persisted contact reply identifiers are invalid.');
  if (text(queue.status) !== 'sending') throw new TypeError('Contact reply email must be atomically claimed before dispatch.');
  if (text(queue.provider) !== 'resend') throw new TypeError('Contact reply email provider is not approved.');
  if (text(queue.template_key) !== EMAIL_TEMPLATE_KEYS.CONTACT_ADMIN_REPLY) throw new TypeError('Contact reply template is not supported.');
  if (text(queue.id) !== text(message.email_log_id)) throw new TypeError('Contact reply message does not match the claimed email queue row.');
  if (text(queue.contact_enquiry_id) !== enquiryId) throw new TypeError('Contact reply queue does not match the persisted enquiry.');
  if (text(message.direction) !== 'outbound') throw new TypeError('Contact reply direction is invalid.');
  if (!body || body.length > 10000) throw new TypeError('Persisted contact reply body is invalid.');
  if (!subject || subject.length > 300) throw new TypeError('Persisted contact reply subject is invalid.');

  const htmlBody = `<p style="margin-top:0">${htmlEscape(body).replaceAll('\n', '<br>')}</p><p style="margin:26px 0 0;color:#667085;font-size:12px">You can reply directly to this email to continue the conversation with RC IT Services.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fa"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e4e7ec;border-radius:10px"><tr><td style="padding:28px 32px 16px;border-bottom:1px solid #eef0f3"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#667085;font-weight:700">RC IT Services</div></td></tr><tr><td style="padding:28px 32px;font-size:15px;line-height:1.65">${htmlBody}</td></tr><tr><td style="padding:18px 32px;border-top:1px solid #eef0f3;color:#667085;font-size:12px;line-height:1.5">RC IT Services · rcitcs.com</td></tr></table></td></tr></table></body></html>`;

  const envelope = createEmailEnvelope({
    templateKey: EMAIL_TEMPLATE_KEYS.CONTACT_ADMIN_REPLY,
    entityType: 'contact_enquiry_message',
    entityId: messageId,
    to: message.recipient_email,
    replyTo: EMAIL_IDENTITIES.contact.address,
    subject,
    html,
    text: body
  });

  if (normalizeEmail(queue.recipient_email) !== envelope.to) throw new TypeError('Contact reply recipient does not match the persisted message.');
  if (normalizeEmail(queue.sender_email) !== envelope.senderEmail) throw new TypeError('Contact reply sender does not match the approved identity.');
  if (normalizeEmail(queue.reply_to_email || '') !== normalizeEmail(envelope.replyTo || '')) throw new TypeError('Contact reply reply-to does not match the approved identity.');
  if (text(queue.subject) !== envelope.subject) throw new TypeError('Contact reply subject does not match the persisted message.');
  if (text(queue.idempotency_key) !== envelope.idempotencyKey) throw new TypeError('Contact reply idempotency key does not match the persisted message.');
  if (text(message.idempotency_key) !== envelope.idempotencyKey) throw new TypeError('Persisted contact reply idempotency key is invalid.');
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length > 5 || attachments.some((item) => !item || typeof item.filename !== 'string' || typeof item.content !== 'string')) {
    throw new TypeError('Persisted contact reply attachments are invalid.');
  }
  return attachments.length ? { ...envelope, attachments } : envelope;
}

export async function dispatchContactReplyEmail({ queue, message, provider, markSent, markFailed } = {}) {
  if (!provider || typeof provider.send !== 'function') throw new TypeError('Email provider is required.');
  if (typeof markSent !== 'function' || typeof markFailed !== 'function') throw new TypeError('Email persistence callbacks are required.');
  const envelope = buildContactReplyEnvelope(queue, message);
  const emailLogId = text(queue.id);
  if (!uuid(emailLogId)) throw new TypeError('Contact reply email log id is invalid.');

  try {
    const delivered = await provider.send(envelope);
    const providerMessageId = text(delivered?.providerMessageId);
    if (!providerMessageId) throw new EmailProviderError('Email provider returned no message identifier.', {
      code: 'EMAIL_PROVIDER_INVALID_RESPONSE',
      retryable: true
    });
    if (!(await markSent({ emailLogId, providerMessageId }))) throw new Error('Email sent-state persistence failed.');
    return Object.freeze({
      ok: true,
      emailLogId,
      provider: text(delivered?.provider) || 'resend',
      providerMessageId
    });
  } catch (error) {
    const code = error instanceof EmailProviderError ? text(error.code) || 'EMAIL_DELIVERY_FAILED' : 'EMAIL_DELIVERY_FAILED';
    await markFailed({
      emailLogId,
      errorCode: code,
      errorMessage: 'Transactional contact reply delivery failed.',
      retryAt: retryAtForEmailFailure({
        templateKey: queue.template_key,
        attemptCount: queue.attempt_count,
        error
      })
    });
    throw error;
  }
}
