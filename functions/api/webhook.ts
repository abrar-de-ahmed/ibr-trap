// CF Pages Function: Stripe Webhook Handler
// POST /api/webhook
// Receives Stripe events. Acknowledges receipt.
// Note: Payment verification is done client-side via Stripe API (/api/verify-payment)
// This webhook exists so Stripe doesn't retry failed deliveries.

interface Env {
  STRIPE_WEBHOOK_SECRET: string;
}

// ── Stripe Webhook Signature Verification (Web Crypto API) ──
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const elements = signatureHeader.split(',');
  let timestamp = '';
  let signature = '';

  for (const el of elements) {
    const [key, val] = el.split('=');
    if (key === 't') timestamp = val;
    if (key === 'v1') signature = val;
  }

  if (!timestamp || !signature) return false;

  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp, 10) > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    result |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const signatureHeader = context.request.headers.get('stripe-signature');
    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
    }

    const payload = await context.request.text();
    const webhookSecret = context.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: 'No webhook secret' }), { status: 500 });
    }

    const isValid = await verifyStripeSignature(payload, signatureHeader, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const event = JSON.parse(payload);
    console.log(`Webhook: ${event.type} for session ${(event.data?.object as Record<string, unknown>)?.id || 'unknown'}`);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: 'ok', service: 'stripe-webhook' }), { status: 200 });
};
