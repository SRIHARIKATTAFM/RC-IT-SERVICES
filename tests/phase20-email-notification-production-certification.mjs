import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EMAIL_IDENTITIES,
  EMAIL_TEMPLATE_KEYS,
  fixedSenderForTemplate
} from "../supabase/functions/_shared/email-contract.js";
import {
  MAX_TRANSACTIONAL_EMAIL_ATTEMPTS,
  retryDelayMinutesForAttempt
} from "../supabase/functions/_shared/email-retry-policy.js";

const read=(p)=>fs.readFileSync(p,"utf8");
const contract=read("supabase/functions/_shared/email-contract.js");
const provider=read("supabase/functions/_shared/resend-email-provider.js");
const dispatcher=read("supabase/functions/transactional-email/index.ts");
const appDelivery=read("supabase/functions/_shared/application-email-delivery.js");
const contactDelivery=read("supabase/functions/_shared/contact-email-delivery.js");
const candidateReply=read("supabase/functions/_shared/candidate-reply-email-delivery.js");
const contactReply=read("supabase/functions/_shared/contact-reply-email-delivery.js");
const resetDelivery=read("supabase/functions/_shared/admin-password-reset-delivery.js");
const runtimeSmoke=read(".github/workflows/phase13-email-runtime-smoke.yml");
const dnsGate=read(".github/workflows/phase17-email-domain-dns.yml");

assert.equal(EMAIL_IDENTITIES.contact.address,"contact@rcitcs.com");
assert.equal(EMAIL_IDENTITIES.careers.address,"careers@rcitcs.com");
assert.equal(EMAIL_IDENTITIES.career.address,"careers@rcitcs.com");
assert.equal(EMAIL_IDENTITIES.noreply.address,"noreply@rcitcs.com");

for(const [key,address] of [
 [EMAIL_TEMPLATE_KEYS.CONTACT_ACKNOWLEDGEMENT,"contact@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.CONTACT_ADMIN_REPLY,"contact@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.APPLICATION_ACKNOWLEDGEMENT,"careers@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.CANDIDATE_ADMIN_REPLY,"careers@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.INTERNAL_CONTACT_ALERT,"noreply@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.INTERNAL_APPLICATION_ALERT,"noreply@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.ADMIN_PASSWORD_RESET,"noreply@rcitcs.com"],
 [EMAIL_TEMPLATE_KEYS.ADMIN_PASSWORD_CHANGED,"noreply@rcitcs.com"]
]) assert.equal(fixedSenderForTemplate(key).address,address,`sender mismatch for ${key}`);

assert.match(provider,/https:\/\/api\.resend\.com\/emails/);
assert.match(provider,/authorization:\s*`Bearer \$\{secret\}`/);
assert.match(provider,/'idempotency-key': idempotencyKey/);
assert.match(provider,/DEFAULT_EMAIL_TIMEOUT_MS = 10_000/);
assert.match(provider,/status === 408 \|\| status === 425 \|\| status === 429 \|\| status >= 500/);
assert.match(provider,/concurrent_idempotent_requests/);

assert.match(dispatcher,/Deno\.env\.get\("RESEND_API_KEY"\)/);
for(const capability of [
 '"provider":"resend"',
 "providerConfigured: provider.configured",
 "applicationNotifications: true",
 "contactNotifications: true",
 "contactAdminReplies: true",
 "candidateAdminReplies: true",
 "retryScheduler: true",
 "monitoring: true"
]) assert.ok(dispatcher.includes(capability.replace('"provider":"resend"','provider: "resend"')), `dispatcher health capability missing: ${capability}`);

for(const source of [appDelivery,contactDelivery,candidateReply,contactReply,resetDelivery]){
 assert.match(source,/markSent/);
 assert.match(source,/markFailed/);
 assert.doesNotMatch(source,/console\.log\s*\(/);
}
assert.match(appDelivery,/recipient does not match the approved template/);
assert.match(contactDelivery,/recipient does not match the approved template/);
assert.match(candidateReply,/sender does not match the approved identity/);
assert.match(contactReply,/reply-to does not match the approved identity/);
assert.match(resetDelivery,/recipient is not approved/);
assert.match(resetDelivery,/retryAt: null/);

assert.equal(MAX_TRANSACTIONAL_EMAIL_ATTEMPTS,5);
assert.deepEqual([1,2,3,4,5].map(retryDelayMinutesForAttempt),[5,15,60,360,null]);

assert.match(runtimeSmoke,/"providerConfigured":true/);
assert.match(runtimeSmoke,/"databaseConfigured":true/);
assert.match(runtimeSmoke,/"code":"UNAUTHORIZED"/);
assert.match(dnsGate,/resend\._domainkey\.rcitcs\.com/);
assert.match(dnsGate,/feedback-smtp\.eu-west-1\.amazonses\.com/);
assert.match(dnsGate,/v=spf1 include:amazonses\.com ~all/);
assert.match(dnsGate,/links1\.resend-dns\.com/);
assert.match(dnsGate,/_dmarc\.rcitcs\.com/);

const secretPattern=/\bre_[A-Za-z0-9_-]{20,}\b/;
for(const [name,source] of Object.entries({contract,provider,dispatcher,appDelivery,contactDelivery,candidateReply,contactReply,resetDelivery,runtimeSmoke,dnsGate})){
 assert.doesNotMatch(source,secretPattern,`Resend secret-like literal present in ${name}`);
}
assert.doesNotMatch(dispatcher,/console\.log\s*\(/);
assert.doesNotMatch(dispatcher,/RESEND_API_KEY\s*[:=]\s*["'][^"']+["']/);

console.log("Phase 20.14 email and notification production source certification: PASS");
