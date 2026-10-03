import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { dispatchAdminPasswordReset } from "../_shared/admin-password-reset-delivery.js";
import { dispatchApplicationEmail } from "../_shared/application-email-delivery.js";
import { dispatchCandidateReplyEmail } from "../_shared/candidate-reply-email-delivery.js";
import { dispatchContactEmail } from "../_shared/contact-email-delivery.js";
import { dispatchContactReplyEmail } from "../_shared/contact-reply-email-delivery.js";
import { EMAIL_TEMPLATE_KEYS } from "../_shared/email-contract.js";
import { createResendEmailProvider } from "../_shared/resend-email-provider.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const LEGACY_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

let MODERN_SECRET_KEY = "";
try {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const keys = JSON.parse(raw);
    MODERN_SECRET_KEY = String(keys.default ?? Object.values(keys)[0] ?? "");
  }
} catch {
  // Invalid secret configuration is reflected as databaseConfigured=false in health.
}

const API_KEY = MODERN_SECRET_KEY || LEGACY_SERVICE_ROLE_KEY;
const USING_LEGACY_KEY = !MODERN_SECRET_KEY && Boolean(LEGACY_SERVICE_ROLE_KEY);
const provider = createResendEmailProvider({ apiKey: RESEND_API_KEY });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SWEEP_LIMIT = 10;

function route(url: URL): string {
  let path = url.pathname || "/";
  for (const prefix of ["/functions/v1/transactional-email", "/transactional-email"]) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || "/";
  }
  return path;
}

function headers(contentType = "application/json; charset=utf-8"): Headers {
  return new Headers({
    "content-type": contentType,
    "cache-control": "no-store, no-transform, max-age=0, must-revalidate",
    "x-robots-tag": "noindex, nofollow, noarchive",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

async function shaBytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([shaBytes(left), shaBytes(right)]);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function internalAuthorized(request: Request): Promise<boolean> {
  if (!API_KEY) return false;
  const supplied = request.headers.get("authorization") ?? "";
  if (!supplied.startsWith("Bearer ")) return false;
  return secureEqual(supplied.slice(7), API_KEY);
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !API_KEY) throw new Error("database configuration unavailable");
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("apikey", API_KEY);
  if (USING_LEGACY_KEY) requestHeaders.set("authorization", `Bearer ${LEGACY_SERVICE_ROLE_KEY}`);
  requestHeaders.set("content-type", "application/json");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: requestHeaders });
}

async function rpc(name: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  const response = await rest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("database request failed");
  return response.json();
}

async function rows(path: string): Promise<Record<string, unknown>[]> {
  const response = await rest(path, { method: "GET" });
  if (!response.ok) throw new Error("database request failed");
  const body = await response.json();
  return Array.isArray(body) ? body as Record<string, unknown>[] : [];
}

function scalarBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value) && value.length === 1) return value[0] === true;
  return false;
}

async function schedulerAuthorized(request: Request): Promise<boolean> {
  const token = String(request.headers.get("x-rcitcs-scheduler-token") ?? "").trim();
  if (token.length < 32 || token.length > 512) return false;
  try {
    return scalarBoolean(await rpc("verify_transactional_email_scheduler_token", { p_token: token }));
  } catch {
    return false;
  }
}

async function dueEmailIds(limit = SWEEP_LIMIT): Promise<string[]> {
  const value = await rpc("list_due_transactional_email_ids", { p_limit: limit });
  const raw = Array.isArray(value) ? value : [];
  return raw.map((id) => String(id ?? "").trim()).filter((id) => UUID.test(id)).slice(0, SWEEP_LIMIT);
}

async function healthSnapshot(): Promise<Record<string, unknown>> {
  const value = await rpc("transactional_email_health_snapshot");
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (Array.isArray(value) && value[0] && typeof value[0] === "object") return value[0] as Record<string, unknown>;
  throw new Error("email health snapshot unavailable");
}

async function claimEmail(emailLogId: string): Promise<Record<string, unknown> | null> {
  const value = await rpc("claim_transactional_email", { p_email_log_id: emailLogId });
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return typeof value === "object" ? value as Record<string, unknown> : null;
}

async function loadApplication(applicationId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(applicationId)) return null;
  const data = await rows(
    `applications?id=eq.${encodeURIComponent(applicationId)}&select=id,public_reference,first_name,last_name,email,job_title,job_code,submitted_at&limit=1`
  );
  return data.length === 1 ? data[0] : null;
}

async function loadContactEnquiry(enquiryId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(enquiryId)) return null;
  const data = await rows(
    `contact_enquiries?id=eq.${encodeURIComponent(enquiryId)}&select=id,name,email,phone,company,service,subject,message,source,created_at&limit=1`
  );
  return data.length === 1 ? data[0] : null;
}

async function loadContactReplyMessage(emailLogId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(emailLogId)) return null;
  const data = await rows(
    `contact_enquiry_messages?email_log_id=eq.${encodeURIComponent(emailLogId)}&select=id,enquiry_id,direction,sender_email,recipient_email,reply_to_email,subject,body_text,idempotency_key,email_log_id,created_by_admin_id,created_at&limit=1`
  );
  if (data.length !== 1) return null;
  const message = data[0];
  const metadata = await rows(`contact_message_attachments?outbound_message_id=eq.${encodeURIComponent(String(message.id))}&select=storage_path,filename,size_bytes&order=created_at.asc&limit=5`);
  const attachments: Array<{ filename: string; content: string }> = [];
  for (const item of metadata) {
    const path = String(item.storage_path || "");
    if (!/^outbound\/[0-9a-f-]{36}\/[0-4]$/.test(path) || Number(item.size_bytes) > 10 * 1024 * 1024) throw new Error("Contact reply attachment metadata invalid");
    const headers = new Headers({ apikey: API_KEY });
    if (USING_LEGACY_KEY) headers.set("authorization", `Bearer ${LEGACY_SERVICE_ROLE_KEY}`);
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/contact-attachments/${path}`, { headers });
    if (!file.ok) throw new Error("Contact reply attachment unavailable");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Contact reply attachment size invalid");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    attachments.push({ filename: String(item.filename || "attachment"), content: btoa(binary) });
  }
  return { ...message, attachments };
}

async function loadCandidateReplyMessage(emailLogId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(emailLogId)) return null;
  const data = await rows(
    `candidate_messages?email_log_id=eq.${encodeURIComponent(emailLogId)}&select=id,application_id,admin_id,direction,channel,sender_email,recipient_email,reply_to_email,subject,body_text,template_key,idempotency_key,email_log_id,status,created_at&limit=1`
  );
  return data.length === 1 ? data[0] : null;
}

async function createResetToken({ adminId, tokenHash, expiresAt }: { adminId: string; tokenHash: string; expiresAt: string }): Promise<boolean> {
  const result = await rpc("create_admin_password_reset_token", {
    p_admin_id: adminId,
    p_token_hash: tokenHash,
    p_requested_ip_hash: null,
    p_expires_at: expiresAt
  });
  if (typeof result === "string") return UUID.test(result);
  if (Array.isArray(result) && result.length === 1) return UUID.test(String(result[0] ?? ""));
  return false;
}

async function markSent({ emailLogId, providerMessageId }: { emailLogId: string; providerMessageId: string }): Promise<boolean> {
  return scalarBoolean(await rpc("mark_transactional_email_sent", {
    p_email_log_id: emailLogId,
    p_provider_message_id: providerMessageId
  }));
}

async function markFailed({ emailLogId, errorCode, errorMessage, retryAt }: { emailLogId: string; errorCode: string; errorMessage: string; retryAt: string | null }): Promise<boolean> {
  return scalarBoolean(await rpc("mark_transactional_email_failed", {
    p_email_log_id: emailLogId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_retry_at: retryAt
  }));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function shaHex(value: string): Promise<string> {
  const bytes = await shaBytes(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parseDispatchBody(request: Request): Promise<{ emailLogId: string } | null> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > 4096) return null;
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return null;
  try {
    const body = await request.json();
    const emailLogId = String(body?.emailLogId ?? "").trim();
    return UUID.test(emailLogId) ? { emailLogId } : null;
  } catch {
    return null;
  }
}

function applicationTemplate(templateKey: string): boolean {
  return templateKey === EMAIL_TEMPLATE_KEYS.APPLICATION_ACKNOWLEDGEMENT
    || templateKey === EMAIL_TEMPLATE_KEYS.INTERNAL_APPLICATION_ALERT;
}

function contactTemplate(templateKey: string): boolean {
  return templateKey === EMAIL_TEMPLATE_KEYS.CONTACT_ACKNOWLEDGEMENT
    || templateKey === EMAIL_TEMPLATE_KEYS.INTERNAL_CONTACT_ALERT;
}

async function dispatchEmailById(emailLogId: string): Promise<{ ok: boolean; code?: string }> {
  if (!provider.configured) return { ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  let queue: Record<string, unknown> | null = null;
  try {
    queue = await claimEmail(emailLogId);
    if (!queue) return { ok: false, code: "EMAIL_NOT_CLAIMABLE" };
    const templateKey = String(queue.template_key ?? "").trim();

    if (templateKey === EMAIL_TEMPLATE_KEYS.ADMIN_PASSWORD_RESET) {
      await dispatchAdminPasswordReset({ queue, provider, createResetToken, markSent, markFailed, randomToken, shaHex });
      return { ok: true };
    }

    if (applicationTemplate(templateKey)) {
      const applicationId = String(queue.application_id ?? "").trim();
      const application = await loadApplication(applicationId);
      if (!application) throw new Error("persisted application unavailable");
      await dispatchApplicationEmail({ queue, application, provider, markSent, markFailed });
      return { ok: true };
    }

    if (contactTemplate(templateKey)) {
      const enquiryId = String(queue.contact_enquiry_id ?? "").trim();
      const enquiry = await loadContactEnquiry(enquiryId);
      if (!enquiry) throw new Error("persisted contact enquiry unavailable");
      await dispatchContactEmail({ queue, enquiry, provider, markSent, markFailed });
      return { ok: true };
    }

    if (templateKey === EMAIL_TEMPLATE_KEYS.CONTACT_ADMIN_REPLY) {
      let message: Record<string, unknown> | null;
      try {
        message = await loadContactReplyMessage(String(queue.id ?? ""));
      } catch {
        await markFailed({
          emailLogId: String(queue.id),
          errorCode: "CONTACT_ATTACHMENT_UNAVAILABLE",
          errorMessage: "Contact reply attachment could not be loaded for delivery.",
          retryAt: new Date(Date.now() + 60_000).toISOString()
        });
        return { ok: false, code: "CONTACT_ATTACHMENT_UNAVAILABLE" };
      }
      if (!message) throw new Error("persisted contact reply message unavailable");
      await dispatchContactReplyEmail({ queue, message, provider, markSent, markFailed });
      return { ok: true };
    }

    if (templateKey === EMAIL_TEMPLATE_KEYS.CANDIDATE_ADMIN_REPLY) {
      const message = await loadCandidateReplyMessage(String(queue.id ?? ""));
      if (!message) throw new Error("persisted candidate reply message unavailable");
      await dispatchCandidateReplyEmail({ queue, message, provider, markSent, markFailed });
      return { ok: true };
    }

    await markFailed({
      emailLogId: String(queue.id ?? ""),
      errorCode: "UNSUPPORTED_EMAIL_TEMPLATE",
      errorMessage: "Transactional email template is not supported by this dispatcher.",
      retryAt: null
    });
    return { ok: false, code: "UNSUPPORTED_EMAIL_TEMPLATE" };
  } catch {
    if (queue?.id) {
      try {
        await markFailed({
          emailLogId: String(queue.id),
          errorCode: "EMAIL_DISPATCH_FAILED",
          errorMessage: "Transactional email dispatch failed.",
          retryAt: null
        });
      } catch {
        // Preserve the primary failure. Template-specific delivery code may already have recorded a retry.
      }
    }
    return { ok: false, code: "EMAIL_DISPATCH_FAILED" };
  }
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const path = route(url);

  if (request.method === "GET" && path === "/health") {
    return json({
      ok: true,
      service: "rcitcs-transactional-email",
      contract: "phase13-admin-reset-v1",
      provider: "resend",
      providerConfigured: provider.configured,
      databaseConfigured: Boolean(SUPABASE_URL && API_KEY),
      applicationNotifications: true,
      contactNotifications: true,
      contactAdminReplies: true,
      candidateAdminReplies: true,
      retryScheduler: true,
      monitoring: true
    });
  }

  if (request.method === "POST" && path === "/sweep") {
    if (!(await schedulerAuthorized(request))) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
    if (!provider.configured) {
      return json({ ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED", attempted: 0, succeeded: 0, failed: 0, skipped: 0 }, 503);
    }
    try {
      const dueIds = await dueEmailIds(SWEEP_LIMIT);
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;
      for (const emailLogId of dueIds) {
        const result = await dispatchEmailById(emailLogId);
        if (result.ok) succeeded += 1;
        else if (result.code === "EMAIL_NOT_CLAIMABLE") skipped += 1;
        else failed += 1;
      }
      return json({ ok: true, attempted: dueIds.length, succeeded, failed, skipped });
    } catch {
      return json({ ok: false, code: "EMAIL_SWEEP_FAILED", attempted: 0, succeeded: 0, failed: 0, skipped: 0 }, 503);
    }
  }

  if (request.method === "POST" && path === "/monitor") {
    if (!(await internalAuthorized(request))) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
    try {
      return json({ ok: true, health: await healthSnapshot() });
    } catch {
      return json({ ok: false, code: "EMAIL_MONITORING_UNAVAILABLE" }, 503);
    }
  }

  if (request.method === "POST" && path === "/dispatch") {
    if (!(await internalAuthorized(request))) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
    const body = await parseDispatchBody(request);
    if (!body) return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    if (!provider.configured) return json({ ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" }, 503);
    const result = await dispatchEmailById(body.emailLogId);
    if (result.ok) return json({ ok: true });
    const status = result.code === "EMAIL_NOT_CLAIMABLE" ? 409 : result.code === "UNSUPPORTED_EMAIL_TEMPLATE" ? 422 : 503;
    return json({ ok: false, code: result.code ?? "EMAIL_DISPATCH_FAILED" }, status);
  }

  const responseHeaders = headers("text/plain; charset=utf-8");
  responseHeaders.set("allow", "GET, POST");
  return new Response("Not Found", { status: 404, headers: responseHeaders });
});
