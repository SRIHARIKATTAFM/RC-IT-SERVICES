function clean(value, max = 4000) {
  return String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean(value, 254));
}

function isPhone(value) {
  return /^[+()\d\s.-]{7,30}$/.test(clean(value, 30));
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow'
    }
  });
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handleApi(request) {
  const url = new URL(request.url);
  const action = clean(url.pathname.replace(/^\/api\//, '').split('/')[0], 80).toLowerCase();
  if (request.method === 'GET' && action === 'health') return json(200, { ok: true, service: 'rc-it-services', runtime: 'cloudflare-workers', now: new Date().toISOString() });
  if (action === 'login') return json(501, { ok: false, code: 'AUTH_NOT_CONFIGURED', message: 'Portal authentication is intentionally not enabled in this build.' });
  if (request.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' });
  const payload = await bodyJson(request);
  if (!payload || typeof payload !== 'object') return json(400, { ok: false, message: 'A valid JSON request body is required.' });

  if (action === 'contact') {
    const required = ['firstName', 'lastName', 'phone', 'email', 'consultationTopic', 'message'];
    const missing = required.filter((key) => !clean(payload[key], key === 'message' ? 4000 : 254));
    if (missing.length) return json(422, { ok: false, message: `Missing required fields: ${missing.join(', ')}` });
    if (payload.privacyConsent !== true) return json(422, { ok: false, message: 'Privacy confirmation is required.' });
    if (!isEmail(payload.email)) return json(422, { ok: false, message: 'Enter a valid email address.' });
    if (!isPhone(payload.phone)) return json(422, { ok: false, message: 'Enter a valid phone number.' });
    return json(202, { ok: true, id: crypto.randomUUID(), message: 'Enquiry validated. Production email or CRM delivery will be connected before public launch.' });
  }
  if (action === 'demo') {
    if (!clean(payload.name, 120) || !clean(payload.company, 140) || !clean(payload.businessEmail, 254) || !clean(payload.product, 120)) return json(422, { ok: false, message: 'Name, company, business email and product are required.' });
    if (!isEmail(payload.businessEmail)) return json(422, { ok: false, message: 'Enter a valid business email.' });
    if (payload.phone && !isPhone(payload.phone)) return json(422, { ok: false, message: 'Enter a valid phone number.' });
    return json(202, { ok: true, id: crypto.randomUUID(), message: 'Demo request validated successfully.' });
  }
  if (action === 'consultation') {
    if (!clean(payload.name, 120) || !clean(payload.company, 140) || !clean(payload.businessEmail, 254) || !clean(payload.topic, 140)) return json(422, { ok: false, message: 'Name, company, business email and consultation topic are required.' });
    if (!isEmail(payload.businessEmail)) return json(422, { ok: false, message: 'Enter a valid business email.' });
    if (payload.phone && !isPhone(payload.phone)) return json(422, { ok: false, message: 'Enter a valid phone number.' });
    return json(202, { ok: true, id: crypto.randomUUID(), message: 'Consultation request validated successfully.' });
  }
  if (action === 'chat') {
    if (!clean(payload.name, 120) || !clean(payload.businessEmail, 254) || !clean(payload.message, 3000)) return json(422, { ok: false, message: 'Name, business email and message are required.' });
    if (!isEmail(payload.businessEmail)) return json(422, { ok: false, message: 'Enter a valid business email.' });
    return json(202, { ok: true, id: crypto.randomUUID(), message: 'Message validated successfully.' });
  }
  if (action === 'resume' || action === 'career-application') return json(501, { ok: false, code: 'RECRUITMENT_STORAGE_NOT_CONFIGURED', message: 'Recruitment document submission will be enabled after approved private storage is connected.' });
  return json(404, { ok: false, message: 'API endpoint not found.' });
}

async function serveApplication(request, env) { return env.ASSETS.fetch(request); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request);
    return serveApplication(request, env);
  }
};
