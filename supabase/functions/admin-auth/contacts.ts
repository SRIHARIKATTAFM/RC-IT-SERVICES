import { shaHex } from "./crypto.js";
import { adminHeader, authPage, esc, loginPage, prettyTime, shell, type AdminSessionView } from "./ui.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const LEGACY_SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const PAGE_LIMIT = 25;
const NOTE_MAX = 10000;
const REPLY_SUBJECT_MAX = 300;
const REPLY_BODY_MAX = 10000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_REPLY_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_BUCKET = "contact-attachments";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTACT_STATUSES = new Set(["all", "new", "open", "in_progress", "resolved", "closed", "spam"]);
const READ_FILTERS = new Set(["all", "unread", "read"]);
const ARCHIVE_FILTERS = new Set(["active", "archived", "all"]);
const MUTATION_ACTIONS = new Set(["read-state", "workflow", "archive-state", "note", "reply", "assignment"]);

let MODERN_SECRET_KEY = "";
try {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    MODERN_SECRET_KEY = String(keys.default ?? Object.values(keys)[0] ?? "");
  }
} catch {
  // Fail closed below if no valid server credential is available.
}
const API_KEY = MODERN_SECRET_KEY || LEGACY_SERVICE_ROLE_KEY;
const USING_LEGACY_KEY = !MODERN_SECRET_KEY && Boolean(LEGACY_SERVICE_ROLE_KEY);

type ContactListItem = {
  id?: string;
  name?: string;
  email?: string;
  company?: string | null;
  service?: string | null;
  subject?: string | null;
  status?: string;
  source?: string | null;
  read_at?: string | null;
  first_read_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
  last_activity_at?: string;
  version?: number;
};

type ContactListContext = {
  ok?: boolean;
  code?: string;
  items?: ContactListItem[];
  has_more?: boolean;
  next_cursor?: { last_activity_at?: string; id?: string } | null;
};

type ContactEnquiry = ContactListItem & {
  phone?: string | null;
  message?: string | null;
  consent?: boolean;
  consent_at?: string | null;
  metadata?: Record<string, unknown> | null;
  assigned_to?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};

type ContactNote = {
  id?: string;
  admin_id?: string;
  body?: string;
  created_at?: string;
};

type ContactMessage = {
  id?: string;
  enquiry_id?: string;
  direction?: string;
  sender_email?: string;
  recipient_email?: string;
  reply_to_email?: string;
  subject?: string;
  body_text?: string;
  email_log_id?: string;
  delivery_status?: string;
  sent_at?: string | null;
  created_by_admin_id?: string;
  created_at?: string;
};

type ContactHistoryEvent = {
  id?: string;
  event_type?: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_admin_id?: string | null;
  created_at?: string;
};

type ContactDetailContext = {
  ok?: boolean;
  code?: string;
  message?: string;
  enquiry?: ContactEnquiry | null;
  history?: ContactHistoryEvent[];
  notes?: ContactNote[];
  messages?: ContactMessage[];
  history_count?: number;
  note_count?: number;
  message_count?: number;
  inbound?: Array<{ id?: string; sender_email?: string; recipient_email?: string; subject?: string; body_text?: string; received_at?: string }>;
  attachments?: Array<{ id?: string; inbound_message_id?: string | null; outbound_message_id?: string | null; filename?: string; content_type?: string; size_bytes?: number }>;
};

type InboxFilters = {
  q: string;
  status: string;
  read: string;
  archive: string;
  cursorAt: string | null;
  cursorId: string | null;
};

function apiHeaders(): Headers {
  if (!SUPABASE_URL || !API_KEY) throw new Error("configuration unavailable");
  const headers = new Headers({ apikey: API_KEY, "content-type": "application/json", accept: "application/json" });
  if (USING_LEGACY_KEY) headers.set("authorization", `Bearer ${LEGACY_SERVICE_ROLE_KEY}`);
  return headers;
}

async function rpc(name: string, payload: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("contact administration request failed");
  const body = await response.json();
  return Array.isArray(body) ? body[0] ?? null : body;
}

async function contactList(adminId: string, filters: InboxFilters): Promise<ContactListContext> {
  const result = await rpc("get_admin_contact_list", {
    p_admin_id: adminId,
    p_limit: PAGE_LIMIT,
    p_status: filters.status === "all" ? null : filters.status,
    p_read_state: filters.read,
    p_archive_state: filters.archive,
    p_query: filters.q || null,
    p_before_activity: filters.cursorAt,
    p_before_id: filters.cursorId
  });
  if (!result || result.ok !== true) throw new Error("contact list denied");
  return result;
}

async function contactDetail(adminId: string, enquiryId: string): Promise<ContactDetailContext> {
  const result = await rpc("get_admin_contact_detail", { p_admin_id: adminId, p_enquiry_id: enquiryId });
  if (result?.ok === true) {
    const conversation = await rpc("get_admin_contact_conversation", { p_admin_id: adminId, p_enquiry_id: enquiryId });
    if (conversation?.ok !== true) throw new Error("contact conversation unavailable");
    result.inbound = conversation.inbound || [];
    result.attachments = conversation.attachments || [];
  }
  return result || { ok: false, code: "UNAVAILABLE" };
}

function safeFilename(value: unknown): string {
  return String(value || "attachment").replace(/[^\x20-\x7e]|[\\/"]/g, "_").trim().slice(0, 255) || "attachment";
}

async function uploadReplyAttachments(files: File[]): Promise<Array<Record<string, unknown>>> {
  const uploadId = crypto.randomUUID();
  const uploaded: Array<Record<string, unknown>> = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const path = `outbound/${uploadId}/${index}`;
      const contentType = String(file.type || "application/octet-stream").slice(0, 150);
      const headers = apiHeaders();
      headers.set("content-type", contentType);
      headers.set("x-upsert", "false");
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${ATTACHMENT_BUCKET}/${path}`, {
        method: "POST", headers, body: await file.arrayBuffer()
      });
      if (!response.ok) throw new Error("contact attachment upload failed");
      uploaded.push({ storage_path: path, filename: safeFilename(file.name), content_type: contentType, size_bytes: file.size });
    }
    return uploaded;
  } catch (error) {
    await cleanupReplyAttachments(uploaded);
    throw error;
  }
}

async function cleanupReplyAttachments(attachments: Array<Record<string, unknown>>): Promise<void> {
  await Promise.allSettled(attachments.map((attachment) => fetch(
    `${SUPABASE_URL}/storage/v1/object/${ATTACHMENT_BUCKET}/${String(attachment.storage_path || "")}`,
    { method: "DELETE", headers: apiHeaders() }
  )));
}

async function csrfOk(state: any, submitted: string): Promise<boolean> {
  return Boolean(submitted) && submitted === state.csrf && await shaHex(submitted) === state.csrf_token_hash;
}

async function requestIpHash(request: Request): Promise<string> {
  const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  return shaHex(ip);
}

async function dispatchQueuedEmail(emailLogId: string): Promise<boolean> {
  if (!SUPABASE_URL || !API_KEY || !UUID.test(emailLogId)) return false;
  try {
    const headers = new Headers({ apikey: API_KEY, authorization: `Bearer ${API_KEY}`, "content-type": "application/json", accept: "application/json" });
    const response = await fetch(`${SUPABASE_URL}/functions/v1/transactional-email/dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ emailLogId }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.ok === true;
  } catch {
    return false;
  }
}

function expectedVersion(form: FormData): number | null {
  const raw = String(form.get("expected_version") ?? "");
  if (!/^\d+$/.test(raw)) return null;
  const version = Number(raw);
  return Number.isSafeInteger(version) && version > 0 ? version : null;
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: new Headers({
    location,
    "cache-control": "no-store, max-age=0, must-revalidate",
    "x-robots-tag": "noindex, nofollow, noarchive"
  }) });
}

function normalizeFilters(url: URL): InboxFilters {
  const q = String(url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const rawStatus = String(url.searchParams.get("status") ?? "all").trim().toLowerCase();
  const rawRead = String(url.searchParams.get("read") ?? "all").trim().toLowerCase();
  const rawArchive = String(url.searchParams.get("archive") ?? "active").trim().toLowerCase();
  const rawCursorAt = String(url.searchParams.get("cursor_at") ?? "").trim();
  const rawCursorId = String(url.searchParams.get("cursor_id") ?? "").trim().toLowerCase();
  const status = CONTACT_STATUSES.has(rawStatus) ? rawStatus : "all";
  const read = READ_FILTERS.has(rawRead) ? rawRead : "all";
  const archive = ARCHIVE_FILTERS.has(rawArchive) ? rawArchive : "active";
  let cursorAt: string | null = null;
  let cursorId: string | null = null;
  if (rawCursorAt && rawCursorId && UUID.test(rawCursorId)) {
    const parsed = new Date(rawCursorAt);
    if (!Number.isNaN(parsed.getTime())) {
      cursorAt = parsed.toISOString();
      cursorId = rawCursorId;
    }
  }
  return { q, status, read, archive, cursorAt, cursorId };
}

function option(value: string, label: string, selected: string): string {
  return `<option value="${esc(value)}"${selected === value ? " selected" : ""}>${esc(label)}</option>`;
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status = "new"): string {
  return `<span style="display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface-subtle);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${esc(statusLabel(status))}</span>`;
}

function readBadge(item: ContactListItem): string {
  return item.read_at
    ? `<span style="font-size:10px;color:var(--muted);font-weight:650">Read</span>`
    : `<span style="display:inline-flex;align-items:center;gap:6px;font-size:10px;color:var(--accent-strong);font-weight:750"><span aria-hidden="true" style="width:7px;height:7px;border-radius:50%;background:currentColor"></span>Unread</span>`;
}

function queryString(filters: InboxFilters, includeCursor: boolean, cursor?: { last_activity_at?: string; id?: string } | null): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.read !== "all") params.set("read", filters.read);
  if (filters.archive !== "active") params.set("archive", filters.archive);
  if (includeCursor && cursor?.last_activity_at && cursor?.id) {
    params.set("cursor_at", cursor.last_activity_at);
    params.set("cursor_id", cursor.id);
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

function workspaceBar(label: string, state = "Private customer data"): string {
  return `<div class="workspace-bar"><div class="workspace-bar-inner"><div class="workspace-context"><strong>Administration</strong><span class="workspace-divider"></span><span>${esc(label)}</span></div><div class="workspace-state"><strong>Protected workspace</strong> · ${esc(state)}</div></div></div>`;
}

function fact(label: string, value: unknown, subtle = false): string {
  const display = value == null || String(value).trim() === "" ? "—" : String(value);
  return `<div style="padding:12px 14px;border:1px solid var(--line);background:${subtle ? "var(--surface-subtle)" : "#fff"}"><span style="display:block;color:var(--muted);font-size:9px;font-weight:750;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</span><strong style="display:block;margin-top:5px;font-size:12px;line-height:1.5;overflow-wrap:anywhere">${esc(display)}</strong></div>`;
}

function dateFact(label: string, iso?: string | null): string {
  return fact(label, iso ? prettyTime(iso) : "—", true);
}

function detailOperationalMetadata(enquiry: ContactEnquiry): string {
  const metadata = enquiry.metadata && typeof enquiry.metadata === "object" ? enquiry.metadata : {};
  const items = [["Intent", metadata.intent], ["Job title", metadata.job_title], ["Submission type", metadata.submission_type]]
    .filter(([, value]) => value != null && String(value).trim() !== "");
  if (!items.length) return "";
  return `<section class="data-plane" aria-labelledby="contact-intake-context-title"><header class="section-header"><div><h2 id="contact-intake-context-title">Intake context</h2><p>Selected immutable submission context captured with the original enquiry.</p></div><span class="section-meta">Accepted evidence</span></header><div style="padding:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px">${items.map(([label, value]) => fact(String(label), value, true)).join("")}</div></section>`;
}

function inboxPage(basePath: string, session: AdminSessionView, context: ContactListContext, filters: InboxFilters): Response {
  const items = Array.isArray(context.items) ? context.items : [];
  const rows = items.length ? items.map((item) => {
    const id = String(item.id || "");
    const detailHref = UUID.test(id) ? `${basePath}/contacts/${esc(id)}` : "";
    return `<tr${item.read_at ? "" : ' style="background:#fbfcff"'}><td><div style="display:flex;align-items:center;gap:10px"><div>${readBadge(item)}</div><div>${detailHref ? `<a href="${detailHref}" style="font-weight:760;color:var(--text);text-decoration:none">${esc(item.name || "Unknown contact")}</a>` : `<strong>${esc(item.name || "Unknown contact")}</strong>`}<div class="activity-type">${esc(item.email || "")}</div></div></div></td><td><strong>${esc(item.company || "—")}</strong><div class="activity-type">${esc(item.service || item.source || "General enquiry")}</div></td><td><span style="display:block;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.subject || "General enquiry")}</span></td><td>${statusBadge(String(item.status || "new"))}</td><td style="text-align:right"><time datetime="${esc(item.last_activity_at || item.created_at || "")}">${esc(prettyTime(String(item.last_activity_at || item.created_at || "")))}</time></td><td style="text-align:right">${detailHref ? `<a class="btn secondary" href="${detailHref}" style="min-height:32px;padding:6px 9px;font-size:10px">View</a>` : ""}</td></tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty"><strong style="display:block;color:var(--text);margin-bottom:5px">No enquiries match this view.</strong>Adjust the search or filters to return to the active contact register.</div></td></tr>`;
  const nextLink = context.has_more && context.next_cursor?.last_activity_at && context.next_cursor?.id
    ? `<a class="btn secondary" rel="next" href="${basePath}/contacts${queryString(filters, true, context.next_cursor)}">Next page</a>` : "";
  const resetLink = filters.q || filters.status !== "all" || filters.read !== "all" || filters.archive !== "active"
    ? `<a class="btn secondary" href="${basePath}/contacts">Reset</a>` : "";
  return shell("Contact enquiries", `<div class="admin-shell">${adminHeader(basePath, session, "contacts")}${workspaceBar("Contact enquiries")}<main class="workspace" id="main-content" aria-labelledby="contacts-title"><div class="page-heading"><div><div class="eyebrow">Customer enquiries</div><h1 id="contacts-title">Contact inbox</h1><p>Server-authoritative register of enquiries accepted through RC IT Services public contact channels. Open a record to inspect the immutable intake and operational context.</p></div><div class="snapshot"><strong>${items.length} on this page</strong>Maximum ${PAGE_LIMIT} per request<br>Keyset pagination</div></div><section class="data-plane" aria-labelledby="contact-register-title"><header class="section-header"><div><h2 id="contact-register-title">Enquiry register</h2><p>Search and filter the private operational view without exposing message bodies or phone numbers in the list.</p></div><span class="section-meta">Operational register</span></header><div style="padding:14px 18px;border-bottom:1px solid var(--line)"><form method="get" action="${basePath}/contacts" style="display:grid;grid-template-columns:minmax(220px,1.3fr) repeat(3,minmax(130px,.45fr)) auto;gap:8px;align-items:end"><div><label for="contact-search" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Search</label><input id="contact-search" name="q" value="${esc(filters.q)}" maxlength="200" placeholder="Name, email, company, service or subject" style="width:100%;min-height:38px;border:1px solid var(--line-strong);border-radius:3px;padding:8px 10px"></div><div><label for="contact-status" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Status</label><select id="contact-status" name="status" style="width:100%;min-height:38px;border:1px solid var(--line-strong);border-radius:3px;padding:8px 10px;background:#fff">${option("all","All statuses",filters.status)}${option("new","New",filters.status)}${option("open","Open",filters.status)}${option("in_progress","In progress",filters.status)}${option("resolved","Resolved",filters.status)}${option("closed","Closed",filters.status)}${option("spam","Spam",filters.status)}</select></div><div><label for="contact-read" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Read state</label><select id="contact-read" name="read" style="width:100%;min-height:38px;border:1px solid var(--line-strong);border-radius:3px;padding:8px 10px;background:#fff">${option("all","All",filters.read)}${option("unread","Unread",filters.read)}${option("read","Read",filters.read)}</select></div><div><label for="contact-archive" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Archive</label><select id="contact-archive" name="archive" style="width:100%;min-height:38px;border:1px solid var(--line-strong);border-radius:3px;padding:8px 10px;background:#fff">${option("active","Active",filters.archive)}${option("archived","Archived",filters.archive)}${option("all","All",filters.archive)}</select></div><div class="actions" style="margin:0;gap:6px"><button class="btn secondary" type="submit">Apply</button>${resetLink}</div></form></div><div class="activity-wrap"><table class="activity-table" style="min-width:1080px;table-layout:auto"><thead><tr><th scope="col">Contact</th><th scope="col">Organisation / service</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col" style="text-align:right">Last activity</th><th scope="col" style="text-align:right">Record</th></tr></thead><tbody>${rows}</tbody></table></div><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 18px;border-top:1px solid var(--line)"><span class="muted">Newest activity first · customer message and phone remain detail-only fields</span><div class="actions" style="margin:0">${nextLink}</div></div></section><div class="footerline"><span>RC IT Services · Private contact operations</span><span>No-cache · No-index · Server-authoritative</span></div></main><style>@media(max-width:900px){form[action$="/contacts"]{grid-template-columns:1fr 1fr!important}}@media(max-width:600px){form[action$="/contacts"]{grid-template-columns:1fr!important}.activity-table{min-width:900px}}</style><script src="${basePath}/contacts/live.js" defer></script></div>`);
  const headers = new Headers(page.headers);
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(page.body, { status: page.status, headers });
}

function workflowTargets(status: string): string[] {
  const targets: Record<string, string[]> = {
    new: ["open", "in_progress", "resolved", "spam"],
    open: ["in_progress", "resolved", "closed", "spam"],
    in_progress: ["open", "resolved", "closed", "spam"],
    resolved: ["open", "closed"],
    closed: ["open"],
    spam: ["open"]
  };
  return targets[status] || [];
}

function operationNotice(url: URL): { message: string; error: boolean } {
  const notice = String(url.searchParams.get("notice") || "");
  const error = String(url.searchParams.get("error") || "");
  const notices: Record<string, string> = {
    read: "Enquiry marked as read.", unread: "Enquiry marked as unread.", workflow: "Workflow status updated.",
    archived: "Enquiry archived.", restored: "Enquiry restored.", note: "Internal note added.",
    assigned: "Enquiry assigned to you.", unassigned: "Enquiry assignment cleared.",
    reply_sent: "Reply sent and recorded.", reply_queued: "Reply recorded and queued for delivery."
  };
  const errors: Record<string, string> = {
    stale: "This enquiry changed after the page was loaded. Review the latest version before trying again.",
    archived: "Restore the enquiry before changing its read state, workflow status, assignment, internal notes, or customer replies.",
    invalid_transition: "That workflow transition is not permitted from the current status.",
    invalid_archive: "Resolve, close, or mark the enquiry as spam before archiving it.",
    validation: "The requested contact operation was invalid.",
    note_validation: "Internal notes must contain between 1 and 10,000 characters.",
    reply_validation: "Check the reply text and attachments. You can send up to 5 files, 10 MB each and 20 MB total.",
    invalid_recipient: "The persisted customer email address is not valid for outbound delivery.",
    not_found: "The requested contact enquiry no longer exists.",
    failed: "The requested contact operation could not be completed."
  };
  if (notices[notice]) return { message: notices[notice], error: false };
  if (errors[error]) return { message: errors[error], error: true };
  return { message: "", error: false };
}

function contactOperations(basePath: string, session: AdminSessionView, enquiry: ContactEnquiry): string {
  const id = String(enquiry.id || "");
  const version = Number(enquiry.version || 0);
  if (!UUID.test(id) || !Number.isSafeInteger(version) || version < 1) return "";
  const hidden = `<input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(version)}">`;
  if (enquiry.archived_at) {
    return `<section class="data-plane" aria-labelledby="contact-actions-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-actions-title">Record controls</h2><p>This terminal enquiry is archived. Restore it before changing read state, workflow status, or internal notes. Assignment and replying are also disabled while archived.</p></div><span class="section-meta">Archived</span></header><div style="padding:18px"><form method="post" action="${basePath}/contacts/${esc(id)}/archive-state">${hidden}<input type="hidden" name="archive" value="0"><button class="btn secondary" type="submit">Restore enquiry</button></form></div></section>`;
  }
  const status = String(enquiry.status || "new");
  const targets = workflowTargets(status);
  const canArchive = ["resolved", "closed", "spam"].includes(status);
  const assignedTo = String(enquiry.assigned_to || "");
  const assignedToSelf = assignedTo === String(session.admin.id || "");
  const workflow = targets.length ? `<form method="post" action="${basePath}/contacts/${esc(id)}/workflow" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">${hidden}<div><label for="contact-target-status" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Change workflow status</label><select id="contact-target-status" name="target_status" required style="min-width:190px;min-height:38px;border:1px solid var(--line-strong);border-radius:3px;padding:8px 10px;background:#fff"><option value="">Select next status</option>${targets.map((target) => `<option value="${esc(target)}">${esc(statusLabel(target))}</option>`).join("")}</select></div><button class="btn" type="submit">Update status</button></form>` : "";
  const assignment = `<form method="post" action="${basePath}/contacts/${esc(id)}/assignment">${hidden}<input type="hidden" name="assigned" value="${assignedTo ? "0" : "1"}"><button class="btn secondary" type="submit">${assignedTo ? (assignedToSelf ? "Unassign from me" : "Clear assignment") : "Assign to me"}</button></form>`;
  const archive = canArchive ? `<form method="post" action="${basePath}/contacts/${esc(id)}/archive-state">${hidden}<input type="hidden" name="archive" value="1"><button class="btn secondary" type="submit">Archive enquiry</button></form>` : `<span class="muted">Archiving becomes available after Resolve, Close, or Spam.</span>`;
  return `<section class="data-plane" aria-labelledby="contact-actions-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-actions-title">Workflow controls</h2><p>Every mutation is version-checked, validated by PostgreSQL, and recorded in history and the administrative audit stream.</p></div><span class="section-meta">Server-authoritative</span></header><div style="padding:18px;display:flex;gap:16px;align-items:end;justify-content:space-between;flex-wrap:wrap"><div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap"><form method="post" action="${basePath}/contacts/${esc(id)}/read-state">${hidden}<input type="hidden" name="read" value="${enquiry.read_at ? "0" : "1"}"><button class="btn secondary" type="submit">${enquiry.read_at ? "Mark unread" : "Mark read"}</button></form>${assignment}${workflow}</div><div>${archive}</div></div></section>`;
}

function internalNotes(basePath: string, session: AdminSessionView, context: ContactDetailContext, enquiry: ContactEnquiry): string {
  const notes = Array.isArray(context.notes) ? context.notes : [];
  const id = String(enquiry.id || "");
  const version = Number(enquiry.version || 0);
  const items = notes.length ? notes.map((note) => `<article style="padding:14px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><strong style="font-size:11px">Administrator note</strong><time class="muted" datetime="${esc(note.created_at || "")}">${esc(prettyTime(String(note.created_at || "")))}</time></div><div style="margin-top:7px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65">${esc(note.body || "")}</div></article>`).join("") : `<div class="empty">No internal notes have been added to this enquiry.</div>`;
  const form = !enquiry.archived_at && UUID.test(id) && Number.isSafeInteger(version) && version > 0 ? `<form method="post" action="${basePath}/contacts/${esc(id)}/note" style="margin-top:16px"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(version)}"><div class="field"><label for="contact-note">Add internal note</label><textarea id="contact-note" name="body" maxlength="${NOTE_MAX}" rows="5" required placeholder="Add operational context for administrators only." style="display:block;width:100%;min-height:120px;box-sizing:border-box;resize:vertical"></textarea><p class="muted">Internal only. Note content is not copied into audit logs and is never emailed to the customer.</p></div><button class="btn" type="submit">Add note</button></form>` : `<p class="muted" style="margin:14px 0 0">Restore this enquiry before adding another internal note.</p>`;
  return `<section class="data-plane" aria-labelledby="contact-notes-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-notes-title">Internal administrative notes</h2><p>Private operational context for authorized administrators. Notes are append-only records.</p></div><span class="section-meta">${esc(notes.length)} shown</span></header><div style="padding:18px">${items}${form}</div></section>`;
}

function replySubject(enquiry: ContactEnquiry): string {
  const source = String(enquiry.subject || enquiry.service || "Your RC IT Services enquiry").trim().replace(/[\r\n]+/g, " ");
  const value = /^re:/i.test(source) ? source : `Re: ${source}`;
  return value.slice(0, REPLY_SUBJECT_MAX);
}

function contactReplyComposer(basePath: string, session: AdminSessionView, enquiry: ContactEnquiry): string {
  const id = String(enquiry.id || "");
  const version = Number(enquiry.version || 0);
  if (!UUID.test(id) || !Number.isSafeInteger(version) || version < 1) return "";
  if (enquiry.archived_at) {
    return `<section class="data-plane" aria-labelledby="contact-reply-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-reply-title">Customer reply</h2><p>Restore this enquiry before replying to the customer.</p></div><span class="section-meta">Disabled while archived</span></header></section>`;
  }
  return `<section class="data-plane" aria-labelledby="contact-reply-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-reply-title">Reply to customer</h2><p>Send from the approved company identity. The reply and files are saved in this conversation.</p></div><span class="section-meta">contact@rcitcs.com</span></header><div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;margin-bottom:16px">${fact("To", enquiry.email || "—", true)}${fact("From", "contact@rcitcs.com", true)}${fact("Reply-To", "contact@rcitcs.com", true)}</div><form method="post" enctype="multipart/form-data" action="${basePath}/contacts/${esc(id)}/reply"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(version)}"><div class="field"><label for="contact-reply-subject">Subject</label><input id="contact-reply-subject" name="subject" value="${esc(replySubject(enquiry))}" maxlength="${REPLY_SUBJECT_MAX}" required style="display:block;width:100%;box-sizing:border-box"></div><div class="field"><label for="contact-reply-body">Message</label><textarea id="contact-reply-body" name="body" maxlength="${REPLY_BODY_MAX}" rows="8" required placeholder="Write the customer-facing response." style="display:block;width:100%;min-height:180px;box-sizing:border-box;resize:vertical"></textarea><p class="muted">Customer-facing message. Do not include passwords, private candidate documents, internal notes, or secrets.</p></div><div class="field"><label for="contact-reply-files">Attach files</label><input id="contact-reply-files" name="attachments" type="file" multiple style="display:block;width:100%"><p class="muted">Up to 5 files, 10 MB each and 20 MB total. Documents, PDFs, images and audio are supported.</p></div><button class="btn" type="submit">Send reply</button></form></div></section>`;
}

function timelineEventLabel(event: ContactHistoryEvent): string {
  const labels: Record<string, string> = {
    created: "Enquiry received",
    read: "Marked read",
    marked_unread: "Marked unread",
    status_changed: "Workflow status changed",
    archived: "Enquiry archived",
    restored: "Enquiry restored",
    note_added: "Internal note added",
    assigned: "Assigned to administrator",
    unassigned: "Assignment cleared"
  };
  return labels[String(event.event_type || "")] || statusLabel(String(event.event_type || "activity"));
}

function contactActivityTimeline(context: ContactDetailContext, basePath: string, enquiryId: string): string {
  const history = Array.isArray(context.history) ? context.history : [];
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const inbound = Array.isArray(context.inbound) ? context.inbound : [];
  const attachments = Array.isArray(context.attachments) ? context.attachments : [];
  const activities: { at: string; html: string }[] = [];
  const fileLinks = (direction: "inbound" | "outbound", messageId: string): string => {
    const items = attachments.filter((item) => item[direction === "inbound" ? "inbound_message_id" : "outbound_message_id"] === messageId && UUID.test(String(item.id || "")));
    return items.length ? `<div style="margin-top:9px;font-size:12px"><strong>Attachments:</strong> ${items.map((item) => `<a class="btn secondary" style="margin:4px;padding:5px 8px" href="${basePath}/contacts/${esc(enquiryId)}/attachments/${esc(item.id)}">${esc(item.filename || "Download file")}</a>`).join(" ")}</div>` : "";
  };

  for (const event of history) {
    if (event.event_type === "reply_queued") continue;
    const at = String(event.created_at || "");
    const from = String(event.from_status || "");
    const to = String(event.to_status || "");
    const statusChange = from && to && from !== to ? `<div class="activity-type">${esc(statusLabel(from))} → ${esc(statusLabel(to))}</div>` : "";
    activities.push({ at, html: `<article style="padding:14px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><strong style="font-size:11px">${esc(timelineEventLabel(event))}</strong><time class="muted" datetime="${esc(at)}">${esc(prettyTime(at))}</time></div>${statusChange}</article>` });
  }

  for (const message of messages) {
    const at = String(message.created_at || "");
    const delivery = statusLabel(String(message.delivery_status || "queued"));
    activities.push({ at, html: `<article style="padding:16px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><strong style="font-size:11px">Outbound customer reply</strong><time class="muted" datetime="${esc(at)}">${esc(prettyTime(at))}</time></div><div class="activity-type">${esc(message.sender_email || "contact@rcitcs.com")} → ${esc(message.recipient_email || "")}</div><div style="margin-top:8px;font-weight:700;font-size:12px">${esc(message.subject || "Reply")}</div><div style="margin-top:7px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65">${esc(message.body_text || "")}</div>${fileLinks("outbound", String(message.id || ""))}<div style="margin-top:8px;font-size:10px;color:var(--muted);font-weight:700">Delivery: ${esc(delivery)}${message.sent_at ? ` · Sent ${esc(prettyTime(String(message.sent_at)))}` : ""}</div></article>` });
  }
  for (const message of inbound) {
    const at = String(message.received_at || "");
    activities.push({ at, html: `<article style="padding:16px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><strong style="font-size:11px">Customer email received</strong><time class="muted" datetime="${esc(at)}">${esc(prettyTime(at))}</time></div><div class="activity-type">${esc(message.sender_email || "")} → ${esc(message.recipient_email || "contact@rcitcs.com")}</div><div style="margin-top:8px;font-weight:700;font-size:12px">${esc(message.subject || "Reply")}</div><div style="margin-top:7px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65">${esc(message.body_text || "")}</div>${fileLinks("inbound", String(message.id || ""))}</article>` });
  }

  activities.sort((a, b) => Date.parse(b.at || "1970-01-01") - Date.parse(a.at || "1970-01-01"));
  const body = activities.length ? activities.map((item) => item.html).join("") : `<div class="empty">No operational activity has been recorded yet.</div>`;
  return `<section class="data-plane" id="contact-activity" aria-labelledby="contact-activity-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-activity-title">Activity &amp; reply history</h2><p>Customer emails and admin replies for this enquiry, newest first.</p></div><span class="section-meta">Newest first</span></header><div style="padding:18px">${body}</div></section>`;
}

function contactDetailPage(basePath: string, session: AdminSessionView, context: ContactDetailContext, url: URL): Response {
  const enquiry = context.enquiry || {};
  const message = String(enquiry.message || "");
  const source = String(enquiry.source || "contact");
  const readState = enquiry.read_at ? "Read" : "Unread";
  const archiveState = enquiry.archived_at ? "Archived" : "Active";
  const assignmentState = enquiry.assigned_to ? (String(enquiry.assigned_to) === String(session.admin.id || "") ? "Assigned to you" : "Assigned") : "Unassigned";
  const consentState = enquiry.consent ? "Recorded" : "Not recorded";
  const version = Number(enquiry.version || 1);
  const counts = { history: Number(context.history_count || 0), notes: Number(context.note_count || 0), messages: Number(context.message_count || 0) };
  const notice = operationNotice(url);
  const noticeHtml = notice.message ? `<div class="msg ${notice.error ? "error" : "ok"}" role="status">${esc(notice.message)}</div>` : "";
  const page = shell("Contact enquiry", `<div class="admin-shell">${adminHeader(basePath, session, "contacts")}${workspaceBar("Enquiry detail", "Immutable intake · operational context")}<main class="workspace" id="main-content" aria-labelledby="contact-detail-title"><div class="page-heading"><div><div class="eyebrow">Contact record</div><h1 id="contact-detail-title">${esc(enquiry.name || "Contact enquiry")}</h1><p>${esc(enquiry.subject || "General enquiry")}</p></div><div class="snapshot"><strong>${statusBadge(String(enquiry.status || "new"))}</strong>${esc(readState)} · ${esc(archiveState)}<br>${esc(assignmentState)} · Version ${esc(version)}</div></div>${noticeHtml}<div class="actions" style="margin:0 0 14px"><a class="btn secondary" href="${basePath}/contacts">Back to contact inbox</a></div><section class="data-plane" aria-labelledby="original-enquiry-title"><header class="section-header"><div><h2 id="original-enquiry-title">Original enquiry</h2><p>Accepted customer-submitted evidence is immutable after intake.</p></div><span class="section-meta">Read-only evidence</span></header><div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;margin-bottom:16px">${fact("Name", enquiry.name)}${fact("Email", enquiry.email)}${fact("Phone", enquiry.phone || "—")}${fact("Company", enquiry.company || "—")}${fact("Service / topic", enquiry.service || "—")}${fact("Source", source)}${fact("Privacy consent", consentState)}${dateFact("Consent recorded", enquiry.consent_at)}</div><div style="padding:16px;border:1px solid var(--line);background:var(--surface-subtle)"><span style="display:block;color:var(--muted);font-size:9px;font-weight:750;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Customer message</span><div style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.7;color:var(--text)">${esc(message || "No message content was stored.")}</div></div></div></section>${detailOperationalMetadata(enquiry)}<section class="data-plane" aria-labelledby="contact-operations-title" style="margin-top:14px"><header class="section-header"><div><h2 id="contact-operations-title">Operational context</h2><p>Current server-authoritative state. Opening this page does not change read state or workflow status.</p></div><span class="section-meta">Explicit actions only</span></header><div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px">${fact("Workflow status", statusLabel(String(enquiry.status || "new")), true)}${fact("Read state", readState, true)}${fact("Archive state", archiveState, true)}${fact("Assignment", assignmentState, true)}${fact("History events", counts.history, true)}${fact("Internal notes", counts.notes, true)}${fact("Conversation messages", counts.messages + (context.inbound?.length || 0), true)}${dateFact("Received", enquiry.created_at)}${dateFact("First reviewed", enquiry.first_read_at)}${dateFact("Currently read since", enquiry.read_at)}${dateFact("Resolved", enquiry.resolved_at)}${dateFact("Closed", enquiry.closed_at)}${dateFact("Archived", enquiry.archived_at)}${dateFact("Last activity", enquiry.last_activity_at)}${dateFact("Record updated", enquiry.updated_at)}</div></div></section>${contactOperations(basePath, session, enquiry)}${internalNotes(basePath, session, context, enquiry)}${contactReplyComposer(basePath, session, enquiry)}${contactActivityTimeline(context, basePath, String(enquiry.id || ""))}<div class="readonly-note"><span>Original customer intake remains immutable. Workflow, assignment, notes, replies and delivery evidence are retained as separate operational records.</span></div><div class="footerline"><span>RC IT Services · Private contact record</span><span>Escaped customer content · Immutable intake · Version ${esc(version)}</span></div></main><style>@media(max-width:600px){#main-content .page-heading{align-items:flex-start}}</style><script src="${basePath}/contacts/live.js" defer></script></div>`);
  const headers = new Headers(page.headers);
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(page.body, { status: page.status, headers });
}

function contactDetailError(basePath: string, session: AdminSessionView, title: string, message: string, status: number): Response {
  return shell(title, `<div class="admin-shell">${adminHeader(basePath, session, "contacts")}${workspaceBar("Enquiry detail")}<main class="workspace" id="main-content"><div class="page-heading"><div><div class="eyebrow">Contact record</div><h1>${esc(title)}</h1><p>${esc(message)}</p></div></div><div class="actions"><a class="btn secondary" href="${basePath}/contacts">Back to contact inbox</a></div></main></div>`, status);
}

function mutationErrorCode(code: unknown): string {
  const map: Record<string, string> = {
    STALE_VERSION: "stale", ARCHIVED: "archived", INVALID_TRANSITION: "invalid_transition",
    INVALID_ARCHIVE_STATE: "invalid_archive", INVALID_RECIPIENT: "invalid_recipient",
    VALIDATION: "validation", NOT_FOUND: "not_found"
  };
  return map[String(code || "")] || "failed";
}

export async function handleContactRoute({ request, url, path, basePath, authState }: { request: Request; url: URL; path: string; basePath: string; authState: any | null; }): Promise<Response | null> {
  const liveScript = path === "/contacts/live.js";
  const detailMatch = path.match(/^\/contacts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  const attachmentMatch = path.match(/^\/contacts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  const mutationMatch = path.match(/^\/contacts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(read-state|workflow|archive-state|note|reply|assignment)$/i);
  if (path !== "/contacts" && !liveScript && !detailMatch && !attachmentMatch && !mutationMatch) return null;
  if (!authState) return loginPage(basePath, "Please sign in to continue.", true);
  if (authState.admin.role !== "super_admin") return authPage("Access denied", "<h1>Access denied</h1><p>Contact administration requires active super administrator authority.</p>", 403);
  const adminId = String(authState.admin.id);

  if (request.method === "GET") {
    if (liveScript) return new Response(`(() => {
  const current = document.getElementById('contact-activity');
  if (!current) return;
  let busy = false;
  setInterval(async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      for (const selector of ['#contact-activity', '.snapshot', 'section[aria-labelledby="contact-operations-title"] > div']) {
        const oldNode = document.querySelector(selector);
        const newNode = next.querySelector(selector);
        if (oldNode && newNode && oldNode.innerHTML !== newNode.innerHTML) oldNode.innerHTML = newNode.innerHTML;
      }
    } catch { /* Keep the current conversation visible during a network interruption. */ }
    finally { busy = false; }
  }, 3000);
})();`, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    if (mutationMatch) return authPage("Method not allowed", "<h1>Method not allowed</h1><p>Contact mutations require a protected POST request.</p>", 405, new Headers({ allow: "POST" }));
    if (attachmentMatch) {
      const context = await contactDetail(adminId, attachmentMatch[1].toLowerCase());
      const item = context.attachments?.find((value) => String(value.id || "").toLowerCase() === attachmentMatch[2].toLowerCase());
      if (context.ok !== true || !item) return authPage("File not found", "<h1>File not found</h1>", 404);
      const lookup = await fetch(`${SUPABASE_URL}/rest/v1/contact_message_attachments?id=eq.${encodeURIComponent(String(item.id))}&select=storage_path&limit=1`, { headers: apiHeaders() });
      if (!lookup.ok) return authPage("File unavailable", "<h1>File unavailable</h1>", 503);
      const rows = await lookup.json();
      const storagePath = String(rows?.[0]?.storage_path || "");
      if (!/^((inbound|outbound)\/[a-z0-9-]+\/\d+)$/.test(storagePath)) return authPage("File not found", "<h1>File not found</h1>", 404);
      const file = await fetch(`${SUPABASE_URL}/storage/v1/object/${ATTACHMENT_BUCKET}/${storagePath}`, { headers: apiHeaders() });
      if (!file.ok) return authPage("File unavailable", "<h1>File unavailable</h1>", 503);
      return new Response(file.body, { status: 200, headers: {
        "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${safeFilename(item.filename)}"`,
        "cache-control": "private, no-store", "x-content-type-options": "nosniff"
      } });
    }
    if (detailMatch) {
      const enquiryId = detailMatch[1].toLowerCase();
      const context = await contactDetail(adminId, enquiryId);
      if (context.ok !== true) {
        if (context.code === "NOT_FOUND") return contactDetailError(basePath, authState, "Enquiry not found", "The requested contact enquiry does not exist.", 404);
        if (context.code === "FORBIDDEN") return contactDetailError(basePath, authState, "Access denied", "Your administrator session cannot access this contact record.", 403);
        return contactDetailError(basePath, authState, "Contact record unavailable", "The enquiry could not be loaded. Please try again.", 503);
      }
      return contactDetailPage(basePath, authState, context, url);
    }
    const filters = normalizeFilters(url);
    return inboxPage(basePath, authState, await contactList(adminId, filters), filters);
  }

  if (request.method !== "POST" || !mutationMatch) {
    return authPage("Method not allowed", "<h1>Method not allowed</h1><p>This contact-administration route does not support the requested method.</p>", 405, new Headers({ allow: path === "/contacts" || detailMatch ? "GET" : "POST" }));
  }

  const enquiryId = mutationMatch[1].toLowerCase();
  const action = mutationMatch[2].toLowerCase();
  if (!MUTATION_ACTIONS.has(action)) return contactDetailError(basePath, authState, "Invalid operation", "The requested contact operation is not supported.", 400);
  const form = await request.formData();
  if (!(await csrfOk(authState, String(form.get("csrf") ?? "")))) return contactDetailError(basePath, authState, "Request rejected", "Reload the contact record and try again.", 403);
  const version = expectedVersion(form);
  if (!version) return redirect(`${basePath}/contacts/${enquiryId}?error=stale`);
  const auditBase = {
    p_admin_id: adminId,
    p_enquiry_id: enquiryId,
    p_expected_version: version,
    p_ip_hash: await requestIpHash(request),
    p_user_agent: String(request.headers.get("user-agent") || "").slice(0, 500)
  };

  let result: any;
  let notice = "workflow";
  if (action === "read-state") {
    const requested = String(form.get("read") ?? "");
    if (requested !== "0" && requested !== "1") return redirect(`${basePath}/contacts/${enquiryId}?error=validation`);
    const read = requested === "1";
    result = await rpc("admin_set_contact_read_state", { ...auditBase, p_read: read });
    notice = read ? "read" : "unread";
  } else if (action === "workflow") {
    const target = String(form.get("target_status") ?? "").trim().toLowerCase();
    if (!["open", "in_progress", "resolved", "closed", "spam"].includes(target)) return redirect(`${basePath}/contacts/${enquiryId}?error=validation`);
    result = await rpc("admin_transition_contact_enquiry", { ...auditBase, p_target_status: target });
    notice = "workflow";
  } else if (action === "archive-state") {
    const requested = String(form.get("archive") ?? "");
    if (requested !== "0" && requested !== "1") return redirect(`${basePath}/contacts/${enquiryId}?error=validation`);
    const archive = requested === "1";
    result = await rpc("admin_set_contact_archive_state", { ...auditBase, p_archive: archive });
    notice = archive ? "archived" : "restored";
  } else if (action === "assignment") {
    const requested = String(form.get("assigned") ?? "");
    if (requested !== "0" && requested !== "1") return redirect(`${basePath}/contacts/${enquiryId}?error=validation`);
    const assigned = requested === "1";
    result = await rpc("admin_set_contact_assignment", { ...auditBase, p_assigned: assigned });
    notice = assigned ? "assigned" : "unassigned";
  } else if (action === "note") {
    const body = String(form.get("body") ?? "").trim();
    if (body.length < 1 || body.length > NOTE_MAX) return redirect(`${basePath}/contacts/${enquiryId}?error=note_validation`);
    result = await rpc("admin_add_contact_enquiry_note", { ...auditBase, p_body: body });
    notice = "note";
  } else {
    const subjectInput = String(form.get("subject") ?? "").trim();
    const reference = `[RC-ENQ:${enquiryId}]`;
    const subject = subjectInput.includes(reference) ? subjectInput : `${subjectInput.replace(/\s*\[RC-ENQ:[^\]]+\]/gi, "").trim()} ${reference}`;
    const body = String(form.get("body") ?? "").trim();
    if (subject.length < 1 || subject.length > REPLY_SUBJECT_MAX || /[\r\n]/.test(subject) || body.length < 1 || body.length > REPLY_BODY_MAX) {
      return redirect(`${basePath}/contacts/${enquiryId}?error=reply_validation`);
    }
    const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > MAX_ATTACHMENTS || files.some((file) => file.size > MAX_ATTACHMENT_BYTES) || files.reduce((sum, file) => sum + file.size, 0) > MAX_REPLY_ATTACHMENTS_BYTES) {
      return redirect(`${basePath}/contacts/${enquiryId}?error=reply_validation`);
    }
    const uploaded = await uploadReplyAttachments(files);
    try {
      result = await rpc("admin_queue_contact_reply_with_attachments", { ...auditBase, p_subject: subject, p_body: body, p_attachments: uploaded });
    } catch (error) {
      await cleanupReplyAttachments(uploaded);
      throw error;
    }
    if (!result || result.ok !== true) await cleanupReplyAttachments(uploaded);
    if (!result || result.ok !== true) return redirect(`${basePath}/contacts/${enquiryId}?error=${mutationErrorCode(result?.code)}`);
    const emailLogId = String(result.email_log_id || "");
    notice = await dispatchQueuedEmail(emailLogId) ? "reply_sent" : "reply_queued";
    return redirect(`${basePath}/contacts/${enquiryId}?notice=${notice}`);
  }

  if (!result || result.ok !== true) return redirect(`${basePath}/contacts/${enquiryId}?error=${mutationErrorCode(result?.code)}`);
  return redirect(`${basePath}/contacts/${enquiryId}?notice=${notice}`);
}
