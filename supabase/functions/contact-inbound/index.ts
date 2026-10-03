import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import PostalMime from "npm:postal-mime@3.0.0";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const LEGACY_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
let MODERN_KEY = "";
try {
  const keys = JSON.parse(String(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"));
  MODERN_KEY = String(keys.default ?? Object.values(keys)[0] ?? "");
} catch { /* fail closed below */ }
const API_KEY = MODERN_KEY || LEGACY_KEY;
const MAX_EMAIL_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const CONTACT_ADDRESS = "contact@rcitcs.com";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  } });
}

async function digest(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function authorized(request: Request): Promise<boolean> {
  if (!API_KEY) return false;
  const supplied = String(request.headers.get("authorization") || "");
  if (!supplied.startsWith("Bearer ")) return false;
  const [left, right] = await Promise.all([digest(supplied.slice(7)), digest(API_KEY)]);
  let different = 0;
  for (let i = 0; i < left.length; i += 1) different |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return different === 0;
}

function apiHeaders(contentType = "application/json"): Headers {
  const headers = new Headers({ apikey: API_KEY, "content-type": contentType });
  if (LEGACY_KEY && !MODERN_KEY) headers.set("authorization", `Bearer ${LEGACY_KEY}`);
  return headers;
}

function emailAddress(value: unknown): string {
  if (typeof value === "object" && value !== null && "address" in value) {
    return String(value.address || "").trim().toLowerCase();
  }
  return "";
}

function safeFilename(value: unknown, index: number): string {
  const cleaned = String(value || `attachment-${index + 1}`).replace(/[\\/\x00-\x1f\x7f]/g, "_").trim();
  return cleaned.slice(0, 255) || `attachment-${index + 1}`;
}

async function uploadAttachment(path: string, content: Uint8Array, contentType: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/contact-attachments/${path}`, {
    method: "POST", headers: apiHeaders(contentType), body: content
  });
  if (!response.ok && response.status !== 409) throw new Error(`Attachment upload failed: ${response.status}`);
}

async function recordAttachment(payload: Record<string, unknown>): Promise<void> {
  const headers = apiHeaders();
  headers.set("prefer", "resolution=ignore-duplicates,return=minimal");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/contact_message_attachments`, {
    method: "POST", headers, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Attachment record failed: ${response.status}`);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false }, 405);
  if (!(await authorized(request))) return json({ ok: false }, 401);
  if (request.headers.get("x-rcitcs-mail-recipient") !== CONTACT_ADDRESS) return json({ ok: false }, 400);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_EMAIL_BYTES) return json({ ok: false, code: "TOO_LARGE" }, 413);
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!raw.length || raw.length > MAX_EMAIL_BYTES) return json({ ok: false, code: "TOO_LARGE" }, 413);

  try {
    const parsed = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
    const from = emailAddress(parsed.from);
    const recipients = Array.isArray(parsed.to) ? parsed.to.map(emailAddress) : [];
    if (!from || !recipients.includes(CONTACT_ADDRESS)) return json({ ok: false, code: "ADDRESS_MISMATCH" }, 400);
    const headerMessageId = String(parsed.messageId || "").trim().slice(0, 512);
    const sourceId = headerMessageId.length >= 8 ? headerMessageId : `sha256:${await digest(raw)}`;
    const subject = String(parsed.subject || "(no subject)").replace(/[\r\n]/g, " ").trim().slice(0, 300);
    const body = String(parsed.text || "").slice(0, 10000);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_contact_inbound_message`, {
      method: "POST", headers: apiHeaders(), body: JSON.stringify({
        p_source_message_id: sourceId, p_sender_email: from,
        p_recipient_email: CONTACT_ADDRESS, p_subject: subject,
        p_body_text: body, p_received_at: null
      })
    });
    if (!response.ok) throw new Error(`Inbound persistence failed: ${response.status}`);
    const result = await response.json();
    if (!result?.ok || !result?.message_id) throw new Error("Inbound persistence rejected");

    const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    const sourceHash = await digest(sourceId);
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      const content = attachment?.content instanceof Uint8Array ? attachment.content : new Uint8Array(attachment?.content || []);
      if (!content.length || content.length > MAX_ATTACHMENT_BYTES) continue;
      const path = `inbound/${sourceHash}/${index}`;
      const contentType = String(attachment.mimeType || "application/octet-stream").slice(0, 150);
      await uploadAttachment(path, content, contentType);
      await recordAttachment({
        inbound_message_id: result.message_id, storage_path: path,
        filename: safeFilename(attachment.filename, index),
        content_type: contentType, size_bytes: content.length
      });
    }
    return json({ ok: true, matched: Boolean(result.enquiry_id), attachments: attachments.length });
  } catch (error) {
    console.error("Contact inbound processing failed", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, code: "PROCESSING_FAILED" }, 503);
  }
});
