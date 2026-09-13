import { esc, prettyTime, shell, type AdminSessionView } from "./ui.ts";

export type JobRecord = {
  id?: string;
  category_id?: string | null;
  category_name?: string | null;
  code?: string | null;
  slug?: string;
  title?: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  workplace_type?: string | null;
  employment_type?: string | null;
  experience?: string | null;
  technologies?: unknown[];
  required_skills?: unknown[];
  preferred_skills?: unknown[];
  industries?: unknown[];
  responsibilities?: unknown[];
  qualifications?: unknown[];
  preferred_qualifications?: unknown[];
  benefits?: unknown[];
  working_style_details?: unknown[];
  location_details?: string | null;
  application_response_window?: string | null;
  status?: string;
  opens_at?: string | null;
  published_at?: string | null;
  closes_at?: string | null;
  archived_at?: string | null;
  version?: number;
  application_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type JobManagementContext = {
  ok?: boolean;
  code?: string;
  jobs?: JobRecord[];
  categories?: Array<{ id?: string; name?: string; slug?: string; is_active?: boolean; display_order?: number }>;
  selected?: JobRecord | null;
};

const WORK_MODELS = [
  ["remote", "Remote / work from home"],
  ["hybrid", "Hybrid"],
  ["onsite", "On-site / office"],
  ["flexible", "Flexible"]
] as const;

const EMPLOYMENT_TYPES = [
  ["full_time", "Full time"],
  ["part_time", "Part time"],
  ["contract", "Contract"],
  ["temporary", "Temporary"],
  ["internship", "Internship"],
  ["other", "Other"]
] as const;

const REQUESTED_CATEGORIES = [
  "Software Development",
  "Data Engineering",
  "Full Stack Development",
  "DevOps",
  "Network Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Generative AI (Gen AI)"
] as const;

function icon(name: "overview" | "jobs" | "security" | "signout" | "info"): string {
  if (name === "overview") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z"/></svg>`;
  if (name === "jobs") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4zM9 7V5h6v2M4 11h16M10 11v2h4v-2"/></svg>`;
  if (name === "security") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5c0 4.6-2.7 7.8-7 9.5C7.7 18.8 5 15.6 5 11V6l7-2.5Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/></svg>`;
  if (name === "signout") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14.5 8.5 18 12l-3.5 3.5M9 12h9"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>`;
}

function adminHeader(basePath: string, session: AdminSessionView, current: "jobs" | "overview" | "security"): string {
  const currentAttr = (name: string) => name === current ? ' aria-current="page"' : "";
  return `<header class="global-header"><div class="global-header-inner">
    <div class="product-brand"><div class="brandmark" aria-hidden="true">RC</div><div class="brand-copy"><strong>RC IT Services</strong><span>Enterprise Administration</span></div></div>
    <nav class="primary-nav" aria-label="Administration"><a href="${basePath || "/"}"${currentAttr("overview")}>${icon("overview")}<span>Overview</span></a><a href="${basePath}/jobs"${currentAttr("jobs")}>${icon("jobs")}<span>Jobs</span></a><a href="${basePath}/change-password"${currentAttr("security")}>${icon("security")}<span>Security</span></a></nav>
    <div class="header-actions"><span class="header-account">${esc(session.admin.email)}</span><form class="header-signout" method="post" action="${basePath}/logout"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button type="submit" aria-label="Sign out" title="Sign out">${icon("signout")}</button></form><details class="mobile-nav"><summary>Menu</summary><div class="mobile-menu"><a href="${basePath || "/"}"${currentAttr("overview")}>Overview</a><a href="${basePath}/jobs"${currentAttr("jobs")}>Jobs</a><a href="${basePath}/change-password"${currentAttr("security")}>Security</a><form method="post" action="${basePath}/logout"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button type="submit">Sign out</button></form></div></details></div>
  </div></header>`;
}

function workspaceBar(label: string): string {
  return `<div class="workspace-bar"><div class="workspace-bar-inner"><div class="workspace-context"><strong>Administration</strong><span class="workspace-divider"></span><span>${esc(label)}</span></div><div class="workspace-state"><strong>Protected workspace</strong> · Server-authoritative CMS</div></div></div>`;
}

function notice(message = "", error = false): string {
  return message ? `<div class="msg ${error ? "error" : "ok"}" role="status">${esc(message)}</div>` : "";
}

function value(job: JobRecord | null | undefined, key: keyof JobRecord): string {
  const raw = job?.[key];
  return raw == null ? "" : String(raw);
}

function listText(current: unknown): string {
  return Array.isArray(current) ? current.map((item) => String(item ?? "").trim()).filter(Boolean).join("\n") : "";
}

function option(current: string, label: string, selected = ""): string {
  return `<option value="${esc(current)}"${current === selected ? " selected" : ""}>${esc(label)}</option>`;
}

function selectField(id: string, label: string, name: string, options: readonly (readonly [string, string])[], selected = "", required = false): string {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? " *" : ""}</label><select id="${id}" name="${esc(name)}"${required ? " required" : ""}><option value="">Select</option>${options.map(([v,l]) => option(v,l,selected)).join("")}</select></div>`;
}

function textField(id: string, label: string, name: string, current = "", required = false, type = "text", max = 200, help = "", placeholder = ""): string {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? " *" : ""}</label><input id="${id}" name="${esc(name)}" type="${esc(type)}" value="${esc(current)}" maxlength="${max}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${required ? " required" : ""}>${help ? `<p class="muted">${esc(help)}</p>` : ""}</div>`;
}

function textareaField(id: string, label: string, name: string, current = "", help = "", max = 20000, required = false): string {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? " *" : ""}</label><textarea id="${id}" name="${esc(name)}" maxlength="${max}"${required ? " required" : ""}>${esc(current)}</textarea>${help ? `<p class="muted">${esc(help)}</p>` : ""}</div>`;
}

function londonDate(iso?: string | null, closing = false): string {
  if (!iso) return "";
  try {
    const date = new Date(new Date(iso).getTime() - (closing ? 1000 : 0));
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date).reduce((acc: Record<string,string>, part) => { if (part.type !== "literal") acc[part.type] = part.value; return acc; }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return ""; }
}

function categoryOptions(context: JobManagementContext, selected = ""): string {
  const names = new Set<string>();
  for (const category of context.categories || []) if (category?.name && category.is_active !== false) names.add(String(category.name));
  for (const category of REQUESTED_CATEGORIES) names.add(category);
  return [...names].sort((a,b)=>a.localeCompare(b)).map((name)=>option(name,name,selected)).join("");
}

function statusBadge(status = "draft"): string {
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `<span style="display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface-subtle);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${esc(label)}</span>`;
}

function statusAction(basePath: string, session: AdminSessionView, job: JobRecord, action: string, label: string, primary = false): string {
  return `<form method="post" action="${basePath}/jobs/${esc(job.id || "")}/transition" style="display:inline"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(job.version ?? 1)}"><input type="hidden" name="action" value="${esc(action)}"><button class="btn${primary ? "" : " secondary"}" type="submit" style="min-height:32px;padding:6px 9px;font-size:10px">${esc(label)}</button></form>`;
}

function rowActions(basePath: string, session: AdminSessionView, job: JobRecord): string {
  const modal = ' data-rc-admin-modal="true"';
  const actions = [
    `<a class="btn secondary"${modal} style="min-height:32px;padding:6px 9px;font-size:10px" href="${basePath}/jobs/${esc(job.id || "")}/edit">Edit</a>`,
    `<a class="btn secondary"${modal} style="min-height:32px;padding:6px 9px;font-size:10px" href="${basePath}/jobs/${esc(job.id || "")}/preview">Preview</a>`,
    `<form method="post" action="${basePath}/jobs/${esc(job.id || "")}/duplicate" style="display:inline"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(job.version ?? 1)}"><button class="btn secondary" type="submit" style="min-height:32px;padding:6px 9px;font-size:10px">Duplicate</button></form>`
  ];
  if (job.status === "draft") actions.push(statusAction(basePath, session, job, "publish", "Publish", true));
  if (job.status === "published") { actions.push(statusAction(basePath, session, job, "unpublish", "Unpublish")); actions.push(statusAction(basePath, session, job, "close", "Close")); }
  if (job.status === "draft" || job.status === "closed") actions.push(statusAction(basePath, session, job, "archive", "Archive"));
  if (job.status === "archived") actions.push(statusAction(basePath, session, job, "restore", "Restore"));
  if (job.status === "draft" && !job.published_at && Number(job.application_count || 0) === 0) actions.push(`<a class="btn secondary"${modal} style="min-height:32px;padding:6px 9px;font-size:10px" href="${basePath}/jobs/${esc(job.id || "")}/delete">Delete draft</a>`);
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${actions.join("")}</div>`;
}

function filterJobs(jobs: JobRecord[], query = "", status = ""): JobRecord[] {
  const q = query.trim().toLowerCase();
  return jobs.filter((job) => (!status || status === "all" || job.status === status) && (!q || [job.title,job.slug,job.code,job.category_name,job.location].some((item)=>String(item ?? "").toLowerCase().includes(q))));
}

export function jobsListPage(basePath: string, session: AdminSessionView, context: JobManagementContext, query = "", status = "all", message = "", error = false): Response {
  const jobs = Array.isArray(context.jobs) ? context.jobs : [];
  const visible = filterJobs(jobs, query, status);
  const count = (key: string) => jobs.filter((job) => job.status === key).length;
  const rows = visible.length ? visible.map((job) => `<tr><td><strong class="activity-action">${esc(job.title || "Untitled")}</strong><div class="activity-type">${esc(job.code || "Identifier pending")} · /${esc(job.slug || "")}</div></td><td>${statusBadge(job.status)}</td><td>${esc(job.category_name || "Uncategorised")}</td><td>${esc(job.location || "Not set")}<div class="activity-type">${esc(job.workplace_type || "Work model not set")}</div></td><td style="text-align:right">${esc(job.application_count ?? 0)}</td><td style="text-align:right">${esc(prettyTime(String(job.updated_at || "")))}</td><td>${rowActions(basePath, session, job)}</td></tr>`).join("") : `<tr><td colspan="7"><div class="empty">No jobs match this view. Create a draft or change the filters.</div></td></tr>`;
  return shell("Jobs", `<div class="admin-shell">${adminHeader(basePath, session, "jobs")}${workspaceBar("Job management")}<main class="workspace" id="main-content" aria-labelledby="jobs-title"><div class="page-heading"><div><div class="eyebrow">Recruitment content</div><h1 id="jobs-title">Job management</h1><p>Create and publish vacancies without leaving the register.</p></div><div class="snapshot"><strong>${jobs.length} total jobs</strong>${count("published")} published · ${count("draft")} draft<br>${count("closed")} closed · ${count("archived")} archived</div></div>${notice(message,error)}<section class="data-plane" aria-labelledby="job-list-title"><header class="section-header"><div><h2 id="job-list-title">Vacancy register</h2><p>Job identifiers are generated by the server. Publication windows control public visibility automatically.</p></div><a class="btn" data-rc-admin-modal="true" href="${basePath}/jobs/new">Create job</a></header><div style="padding:14px 18px;border-bottom:1px solid var(--line)"><form method="get" action="${basePath}/jobs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;align-items:end"><div><label for="job-search" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Search</label><input id="job-search" name="q" value="${esc(query)}" placeholder="Title, code, category or location"></div><div><label for="job-status" style="display:block;font-size:10px;font-weight:700;margin-bottom:5px">Status</label><select id="job-status" name="status"><option value="all">All</option>${["published","draft","closed","archived"].map((s)=>option(s,s[0].toUpperCase()+s.slice(1),status)).join("")}</select></div><button class="btn secondary" type="submit">Apply filters</button></form></div><div class="activity-wrap"><table class="activity-table" style="min-width:1120px"><thead><tr><th scope="col" style="width:22%">Role</th><th scope="col" style="width:9%">Status</th><th scope="col" style="width:11%">Category</th><th scope="col" style="width:14%">Location</th><th scope="col" style="width:7%;text-align:right">Apps</th><th scope="col" style="width:14%;text-align:right">Updated</th><th scope="col" style="width:23%;text-align:right">Actions</th></tr></thead><tbody>${rows}</tbody></table></div></section><div class="footerline"><span>RC IT Services · Private administration</span><span>Optimistic concurrency · Audit trail · Public status authority</span></div></main></div>`);
}

export function jobEditorPage(basePath: string, session: AdminSessionView, context: JobManagementContext, job: JobRecord | null = null, message = "", error = false, submitted?: Record<string, unknown>): Response {
  const editing = Boolean(job?.id);
  const source: JobRecord = submitted ? { ...job, ...submitted } as JobRecord : (job || {});
  const action = editing ? `${basePath}/jobs/${esc(job?.id || "")}/update` : `${basePath}/jobs/create`;
  const categoryValue = value(source,"category_name") || String((submitted as any)?.category || "");
  const noExpiry = !value(source,"closes_at") && !(submitted as any)?.closes_at;
  return shell(editing ? "Edit job" : "Create job", `<div class="admin-shell">${adminHeader(basePath, session, "jobs")}${workspaceBar(editing ? "Edit vacancy" : "Create vacancy")}<main class="workspace" id="main-content" aria-labelledby="job-editor-title"><div class="page-heading"><div><div class="eyebrow">${editing ? "Vacancy record" : "New vacancy"}</div><h1 id="job-editor-title">${editing ? esc(job?.title || "Edit job") : "Create job"}</h1><p>${editing ? "Update the vacancy without leaving Job management." : "Enter the vacancy once, then save it as a draft or publish it immediately."}</p></div><div class="snapshot"><strong>Job code</strong>${editing ? esc(job?.code || "Identifier pending") : "Generated automatically"}<br>${editing ? `Version ${esc(job?.version ?? 1)}` : "Server-generated · immutable"}</div></div>${notice(message,error)}<form method="post" action="${action}"><input type="hidden" name="csrf" value="${esc(session.csrf)}">${editing ? `<input type="hidden" name="expected_version" value="${esc(job?.version ?? 1)}"><input type="hidden" name="slug" value="${esc(job?.slug || "")}">` : ""}<section class="data-plane"><header class="section-header"><div><h2>Job details</h2><p>Required fields are marked with *. Job code and URL slug are generated automatically for new vacancies.</p></div><span class="section-meta">Straightforward authoring</span></header><div style="padding:8px 22px 18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:0 18px"><div class="field"><label for="job-category">Department / category *</label><select id="job-category" name="category" required><option value="">Select department</option>${categoryOptions(context,categoryValue)}</select></div>${textField("job-title","Position title","title",value(source,"title"),true,"text",160,"","e.g. Senior Data Engineer")}${selectField("job-work-model","Work mode","workplace_type",WORK_MODELS,value(source,"workplace_type"),true)}${textField("job-location","Office / job location","location",value(source,"location"),true,"text",200,"","e.g. London, UK")}${selectField("job-employment","Employment type","employment_type",EMPLOYMENT_TYPES,value(source,"employment_type"))}${textField("job-experience","Experience required","experience",value(source,"experience"),true,"text",200,"","e.g. 2–10 years")}${textField("job-response-window","Response time","application_response_window",value(source,"application_response_window"),false,"text",300,"Optional.","e.g. 1–5 days")}</div>${textareaField("job-required-skills","Required skills","required_skills",listText(source.required_skills),"One skill per line.",16000,true)}${textareaField("job-description","Job description","description",value(source,"description"),"Describe the role accurately for candidates.",20000,true)}${textareaField("job-benefits","Benefits","benefits",listText(source.benefits),"Optional; one item per line.",12000)}</div></section><section class="data-plane" style="margin-top:14px"><header class="section-header"><div><h2>Job availability</h2><p>The vacancy appears publicly on the start date and disappears automatically after the end date.</p></div><span class="section-meta">Europe/London</span></header><div style="padding:8px 22px 18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:0 18px">${textField("job-opens","Start date","opens_at",londonDate(source.opens_at),false,"date",32)}${textField("job-closes","End date","closes_at",londonDate(source.closes_at,true),false,"date",32)}</div><label style="display:flex;align-items:center;gap:9px;margin:8px 0 0;font-size:12px"><input type="checkbox" name="no_expiry" value="1"${noExpiry ? " checked" : ""}> Publish indefinitely / no end date</label></div></section><details class="data-plane" style="margin-top:14px"><summary class="section-header" style="cursor:pointer"><div><h2>Advanced optional details</h2><p>Open only when the vacancy needs additional candidate-facing structure.</p></div><span class="section-meta">Optional</span></summary><div style="padding:8px 22px 18px">${textareaField("job-summary","Job summary","summary",value(source,"summary"),"Optional concise summary.",500)}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:0 18px">${textareaField("job-technologies","Required programming languages / technologies","technologies",listText(source.technologies),"One item per line.",12000)}${textareaField("job-preferred-skills","Preferred skills","preferred_skills",listText(source.preferred_skills),"One item per line.",16000)}${textareaField("job-responsibilities","Responsibilities","responsibilities",listText(source.responsibilities),"One item per line.",16000)}${textareaField("job-qualifications","Qualifications","qualifications",listText(source.qualifications),"One item per line.",16000)}${textareaField("job-preferred-qualifications","Preferred qualifications","preferred_qualifications",listText(source.preferred_qualifications),"One item per line.",16000)}${textareaField("job-industries","Industry context","industries",listText(source.industries),"One item per line.",12000)}${textareaField("job-working-style","Nature of working style","working_style_details",listText(source.working_style_details),"One item per line.",12000)}</div>${textareaField("job-location-details","Location details","location_details",value(source,"location_details"),"Optional travel/client-site context.",2000)}</div></details><div class="actions">${editing ? `<button class="btn" type="submit" name="intent" value="save">Save changes</button><a class="btn secondary" data-rc-admin-modal="true" href="${basePath}/jobs/${esc(job?.id || "")}/preview">Preview</a>` : `<button class="btn secondary" type="submit" name="intent" value="draft">Save draft</button><button class="btn" type="submit" name="intent" value="publish">Publish</button>`}<a class="btn secondary" href="${basePath}/jobs">Cancel</a></div></form>${editing ? `<div class="readonly-note">${icon("info")}<span>Saving a published job updates the same canonical content document used by the public candidate page. Stale versions are rejected rather than silently overwriting newer edits.</span></div>` : ""}<div class="footerline"><span>RC IT Services · Private administration</span><span>Draft-first option · Server-generated identifier · Version checked</span></div></main></div>`);
}

function previewList(title: string, items: unknown, tags = false): string {
  const values = Array.isArray(items) ? items.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  if (!values.length) return "";
  if (tags) return `<section style="padding:18px 0;border-top:1px solid var(--line)"><h3 style="margin:0 0 10px;font-size:13px">${esc(title)}</h3><div style="display:flex;gap:7px;flex-wrap:wrap">${values.map((item)=>`<span style="display:inline-flex;padding:6px 9px;border:1px solid var(--line);background:var(--surface-subtle);font-size:11px">${esc(item)}</span>`).join("")}</div></section>`;
  return `<section style="padding:18px 0;border-top:1px solid var(--line)"><h3 style="margin:0 0 10px;font-size:13px">${esc(title)}</h3><ul style="margin:0;padding-left:20px;line-height:1.65;font-size:12px">${values.map((item)=>`<li>${esc(item)}</li>`).join("")}</ul></section>`;
}

function fact(label: string, current: unknown): string {
  if (current == null || String(current).trim() === "") return "";
  return `<div style="padding:12px;border:1px solid var(--line);background:var(--surface-subtle)"><span style="display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.05em">${esc(label)}</span><strong style="display:block;margin-top:5px;font-size:12px">${esc(current)}</strong></div>`;
}

export function jobPreviewPage(basePath: string, session: AdminSessionView, job: JobRecord): Response {
  const paragraphs = String(job.description || "").split(/\n\s*\n/).map((item)=>item.trim()).filter(Boolean);
  const facts = [fact("Job code",job.code),fact("Location",job.location),fact("Work model",job.workplace_type),fact("Employment type",job.employment_type),fact("Experience",job.experience),fact("Response time",job.application_response_window),job.published_at?fact("Posted",prettyTime(job.published_at)):"",job.opens_at?fact("Starts",prettyTime(job.opens_at)):"",job.closes_at?fact("Closes",prettyTime(job.closes_at)):fact("Availability","No expiry")].join("");
  return shell("Job preview", `<div class="admin-shell">${adminHeader(basePath, session, "jobs")}${workspaceBar("Private vacancy preview")}<main class="workspace" id="main-content" aria-labelledby="job-preview-title"><div class="page-heading"><div><div class="eyebrow">Private preview · ${esc(job.status || "draft")}</div><h1 id="job-preview-title">${esc(job.title || "Untitled vacancy")}</h1><p>${esc(job.summary || "Candidate-facing preview")}</p></div><div class="snapshot"><strong>${esc(job.code || "Identifier pending")}</strong>${esc(job.category_name || "Uncategorised")}<br>Version ${esc(job.version ?? 1)}</div></div><section class="data-plane"><header class="section-header"><div><h2>Candidate-content preview</h2><p>This is the authoritative content that will be used by the public Careers page.</p></div>${statusBadge(job.status)}</header><div style="padding:22px;max-width:980px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;margin-bottom:20px">${facts}</div>${previewList("Required skills",job.required_skills)}${paragraphs.length?`<section style="padding:18px 0;border-top:1px solid var(--line)"><h3 style="margin:0 0 10px;font-size:13px">Job description</h3>${paragraphs.map((p)=>`<p style="font-size:12px;line-height:1.7">${esc(p)}</p>`).join("")}</section>`:""}${previewList("Technology environment",job.technologies,true)}${previewList("Preferred skills",job.preferred_skills)}${previewList("Key responsibilities",job.responsibilities)}${previewList("Qualifications",job.qualifications)}${previewList("Preferred qualifications",job.preferred_qualifications)}${previewList("Benefits & employment terms",job.benefits)}${previewList("Industry context",job.industries,true)}${previewList("Nature of working style",job.working_style_details)}${job.location_details?`<section style="padding:18px 0;border-top:1px solid var(--line)"><h3>Location</h3><p>${esc(job.location_details)}</p></section>`:""}</div></section><div class="actions"><a class="btn" data-rc-admin-modal="true" href="${basePath}/jobs/${esc(job.id || "")}/edit">Edit job</a><a class="btn secondary" href="${basePath}/jobs">Back to jobs</a></div></main></div>`);
}

export function jobDeletePage(basePath: string, session: AdminSessionView, job: JobRecord, message = "", error = false): Response {
  const eligible = job.status === "draft" && !job.published_at && Number(job.application_count || 0) === 0;
  return shell("Delete job draft", `<div class="admin-shell">${adminHeader(basePath, session, "jobs")}${workspaceBar("Delete draft")}<main class="workspace" id="main-content"><div class="page-heading"><div><div class="eyebrow">Irreversible action</div><h1>Delete ${esc(job.title || "job draft")}</h1><p>Only a never-published draft with zero applications may be permanently deleted.</p></div>${statusBadge(job.status)}</div>${notice(message,error)}<section class="data-plane"><div style="padding:22px;max-width:720px">${eligible?`<form method="post" action="${basePath}/jobs/${esc(job.id || "")}/delete"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="expected_version" value="${esc(job.version ?? 1)}"><div class="field"><label for="confirm-slug">Type ${esc(job.slug || "")} to confirm</label><input id="confirm-slug" name="confirm_slug" required></div><div class="actions"><button class="btn" type="submit">Permanently delete draft</button><a class="btn secondary" href="${basePath}/jobs">Cancel</a></div></form>`:`<div class="msg error">This record does not satisfy the deletion policy.</div><a class="btn secondary" href="${basePath}/jobs">Back to jobs</a>`}</div></section></main></div>`, eligible?200:409);
}

function splitLines(value: FormDataEntryValue | null, field: string, errors: string[]): string[] {
  const lines = String(value ?? "").split(/\r?\n/).map((item)=>item.trim()).filter(Boolean);
  if (lines.length > 50) errors.push(`${field} allows a maximum of 50 items.`);
  if (lines.some((item)=>item.length > 400)) errors.push(`${field} contains an item longer than 400 characters.`);
  return [...new Set(lines)].slice(0,50);
}

function generatedSlug(title: string): string {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,140) || "vacancy";
  return `${base}-${crypto.randomUUID().replace(/-/g,"").slice(0,6)}`;
}

export function jobPayloadFromForm(form: FormData): { payload: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const title = String(form.get("title") ?? "").trim();
  const suppliedSlug = String(form.get("slug") ?? "").trim().toLowerCase();
  const slug = suppliedSlug || generatedSlug(title);
  const category = String(form.get("category") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const workplaceType = String(form.get("workplace_type") ?? "").trim().toLowerCase();
  const employmentType = String(form.get("employment_type") ?? "").trim().toLowerCase();
  const experience = String(form.get("experience") ?? "").trim();
  const responseWindow = String(form.get("application_response_window") ?? "").trim();
  const locationDetails = String(form.get("location_details") ?? "").trim();
  const opensAt = String(form.get("opens_at") ?? "").trim();
  const closesAt = form.get("no_expiry") ? "" : String(form.get("closes_at") ?? "").trim();
  const requiredSkills = splitLines(form.get("required_skills"), "Required skills", errors);
  if (title.length < 3 || title.length > 160) errors.push("Title must be between 3 and 160 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) errors.push("Generated job URL is invalid.");
  if (!category || category.length > 100) errors.push("Department / category is required.");
  if (!location || location.length > 200) errors.push("Job location is required.");
  if (!workplaceType || !WORK_MODELS.some(([current])=>current === workplaceType)) errors.push("Work mode is required and invalid.");
  if (!experience || experience.length > 200) errors.push("Experience required is required and must be 200 characters or fewer.");
  if (!description || description.length > 20000) errors.push("Job description is required.");
  if (!requiredSkills.length) errors.push("At least one required skill is required.");
  if (summary.length > 500 || responseWindow.length > 300 || locationDetails.length > 2000) errors.push("One or more optional job fields exceed the allowed length.");
  if (employmentType && !EMPLOYMENT_TYPES.some(([current])=>current === employmentType)) errors.push("Employment type is invalid.");
  for (const [label,current] of [["Start date",opensAt],["End date",closesAt]] as const) if (current && !/^\d{4}-\d{2}-\d{2}$/.test(current)) errors.push(`${label} is invalid.`);
  return { errors, payload: { title,slug,category,summary,description,location,workplace_type:workplaceType,employment_type:employmentType,experience,application_response_window:responseWindow,location_details:locationDetails,technologies:splitLines(form.get("technologies"),"Technologies",errors),required_skills:requiredSkills,preferred_skills:splitLines(form.get("preferred_skills"),"Preferred skills",errors),industries:splitLines(form.get("industries"),"Industry context",errors),responsibilities:splitLines(form.get("responsibilities"),"Responsibilities",errors),qualifications:splitLines(form.get("qualifications"),"Qualifications",errors),preferred_qualifications:splitLines(form.get("preferred_qualifications"),"Preferred qualifications",errors),benefits:splitLines(form.get("benefits"),"Benefits",errors),working_style_details:splitLines(form.get("working_style_details"),"Nature of working style",errors),opens_at:opensAt,closes_at:closesAt } };
}
