import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const [edge, gateway, router, handlers, supabaseConfig, wranglerText] = await Promise.all([
  read('supabase/functions/candidate-applications/index.ts'),
  read('src/backend/providers/candidate-application-gateway.js'),
  read('src/backend/api/router.js'),
  read('src/backend/api/handlers.js'),
  read('supabase/config.toml'),
  read('wrangler.jsonc')
]);
const wrangler = JSON.parse(wranglerText);

assert.ok(edge.includes('bearerCredential(request)'), 'Candidate intake must authenticate the server proxy credential.');
assert.ok(edge.includes('constantTimeEqual(presented, serviceKey)'), 'Proxy credential comparison must avoid ordinary early-exit string equality.');
assert.ok(edge.includes('requestBoundary(request, serviceKey)'), 'Service credential must be part of the intake boundary decision.');
assert.ok(edge.indexOf('constantTimeEqual(presented, serviceKey)') < edge.indexOf('x-rcitcs-client-ip'), 'Proxy authentication must happen before forwarded client metadata is trusted.');
assert.ok(!edge.includes('request.headers.get("x-rcitcs-original-origin") || request.headers.get("origin")'), 'The intake Edge Function must not fall back to a direct browser Origin header.');
assert.ok(edge.includes('MAX_CANDIDATE_JSON_BYTES'));
assert.ok(edge.includes('request.body.getReader()'));
assert.ok(edge.includes('reader.cancel()'));

assert.ok(gateway.includes('authorization: `Bearer ${persistence.secretKey}`'));
assert.ok(gateway.includes("headerValue(headers, 'cf-connecting-ip')"));
assert.ok(gateway.includes("headerValue(headers, 'x-vercel-forwarded-for')"));
assert.ok(gateway.includes("'x-rcitcs-client-ip': clientIp"));
assert.ok(!gateway.includes("headerValue(headers, 'x-rcitcs-client-ip')"), 'RC gateway must not trust a browser-supplied forwarded client-IP header.');
assert.ok(router.includes("'career-application': { methods: ['POST'], handler: 'candidateApplication', body: true }"));
assert.ok(handlers.includes('candidateApplicationGateway.forward'));

assert.equal(wrangler.vars?.SUPABASE_URL, 'https://chsizmffzpxcqhaptjeu.supabase.co', 'The production public Worker must bind the Supabase project origin required by the Phase 12 candidate gateway.');
assert.ok(!('SUPABASE_SECRET_KEY' in (wrangler.vars || {})), 'Supabase server credentials must remain secret bindings, never plaintext Wrangler vars.');
assert.ok(!('SUPABASE_SERVICE_ROLE_KEY' in (wrangler.vars || {})), 'Supabase service-role credentials must remain secret bindings, never plaintext Wrangler vars.');

const candidateConfig = supabaseConfig.match(/\[functions\.candidate-applications\]([\s\S]*?)(?=\n\[|$)/)?.[1] || '';
assert.ok(candidateConfig.includes('verify_jwt = false'), 'candidate-applications must explicitly disable the platform JWT gate because its function body authenticates the trusted RC server credential itself.');
const adminConfig = supabaseConfig.match(/\[functions\.admin-auth\]([\s\S]*?)(?=\n\[|$)/)?.[1] || '';
assert.ok(adminConfig.includes('verify_jwt = false'), 'admin-auth custom session boundary must remain explicit.');

for (const source of [edge, gateway, router, handlers, supabaseConfig, wranglerText]) {
  assert.ok(!/sb_secret_[A-Za-z0-9_-]{20,}/.test(source), 'No real Supabase secret may be committed in Phase 12 source.');
  assert.ok(!/SUPABASE_SECRET_KEY\s*=/.test(source), 'No Supabase secret assignment may be committed in Phase 12 source.');
}

console.log('PASS: Phase 12 rejects forged direct-proxy authority, explicitly binds its Supabase project origin, keeps server credentials secret, and keeps candidate JSON bounded.');
