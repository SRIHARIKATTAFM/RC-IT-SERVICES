import { requireIdempotencyKey } from './email-contract.js';

export const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
export const DEFAULT_EMAIL_TIMEOUT_MS = 10_000;

export class EmailProviderError extends Error {
  constructor(message, { code = 'EMAIL_PROVIDER_ERROR', retryable = false, status = 0 } = {}) {
    super(message);
    this.name = 'EmailProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function cleanApiKey(value) {
  return String(value ?? '').trim();
}

function providerErrorCode(body, fallback) {
  const value = body && typeof body === 'object' ? String(body.name || body.code || '').trim() : '';
  return value || fallback;
}

function retryableProviderError(status, code) {
  if (status === 409) return code === 'concurrent_idempotent_requests';
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function safeJson(response) {
  try {
    const value = await response.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function createResendEmailProvider({ apiKey = '', fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_EMAIL_TIMEOUT_MS } = {}) {
  const secret = cleanApiKey(apiKey);
  const configured = Boolean(secret);
  if (fetchImpl !== undefined && typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');

  return Object.freeze({
    name: 'resend',
    configured,
    async send(envelope) {
      if (!configured) {
        throw new EmailProviderError('Transactional email provider is not configured.', {
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
          retryable: false
        });
      }
      if (!envelope || typeof envelope !== 'object') throw new TypeError('Email envelope is required.');
      const idempotencyKey = requireIdempotencyKey(envelope.idempotencyKey);
      if (!envelope.from || !envelope.to || !envelope.subject || !envelope.html || !envelope.text) {
        throw new TypeError('Email envelope is incomplete.');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1_000, Number(timeoutMs) || DEFAULT_EMAIL_TIMEOUT_MS));
      try {
        const payload = {
          from: envelope.from,
          to: [envelope.to],
          subject: envelope.subject,
          html: envelope.html,
          text: envelope.text,
          ...(envelope.replyTo ? { reply_to: envelope.replyTo } : {}),
          ...(Array.isArray(envelope.attachments) && envelope.attachments.length ? { attachments: envelope.attachments } : {})
        };
        let response;
        try {
          response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${secret}`,
              'content-type': 'application/json',
              'idempotency-key': idempotencyKey
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        } catch (error) {
          const timedOut = error?.name === 'AbortError';
          throw new EmailProviderError(timedOut ? 'Email provider request timed out.' : 'Email provider request failed.', {
            code: timedOut ? 'EMAIL_PROVIDER_TIMEOUT' : 'EMAIL_PROVIDER_NETWORK_ERROR',
            retryable: true
          });
        }

        const body = await safeJson(response);
        if (!response.ok) {
          const code = providerErrorCode(body, `EMAIL_PROVIDER_HTTP_${response.status}`);
          throw new EmailProviderError('Email provider rejected the request.', {
            code,
            retryable: retryableProviderError(response.status, code),
            status: response.status
          });
        }
        const messageId = String(body.id ?? '').trim();
        if (!messageId) {
          throw new EmailProviderError('Email provider returned no message identifier.', {
            code: 'EMAIL_PROVIDER_INVALID_RESPONSE',
            retryable: true,
            status: response.status
          });
        }
        return Object.freeze({
          provider: 'resend',
          providerMessageId: messageId,
          idempotencyKey
        });
      } finally {
        clearTimeout(timer);
      }
    }
  });
}
