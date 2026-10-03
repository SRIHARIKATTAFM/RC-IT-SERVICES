const CONTACT_ADDRESS = 'contact@rcitcs.com';
const GMAIL_DESTINATION = 'rcitcservices@gmail.com';
const MAX_CAPTURE_BYTES = 20 * 1024 * 1024;

export async function handleContactEmail(message, env, ctx) {
  if (String(message.to || '').toLowerCase() !== CONTACT_ADDRESS) {
    throw new Error('Unexpected email recipient for contact route.');
  }

  // Capture before forwarding because the raw MIME body is a one-shot stream.
  // Forwarding remains the priority even if the admin copy is too large.
  let raw = null;
  try {
    if (Number(message.rawSize) <= MAX_CAPTURE_BYTES) {
      raw = await new Response(message.raw).arrayBuffer();
    }
  } catch {
    console.error('Contact admin-copy capture unavailable');
  }
  await message.forward(GMAIL_DESTINATION);

  if (!raw) return;
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secret = String(env.SUPABASE_SECRET_KEY || '');
  if (!url || !secret) return;
  ctx.waitUntil((async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${url}/functions/v1/contact-inbound`, {
          method: 'POST',
          headers: {
            apikey: secret,
            authorization: `Bearer ${secret}`,
            'content-type': 'message/rfc822',
            'x-rcitcs-mail-recipient': CONTACT_ADDRESS
          },
          body: raw
        });
        if (response.ok) return;
        console.error('Contact admin-copy ingest failed', response.status);
      } catch {
        console.error('Contact admin-copy ingest unavailable');
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  })());
}
