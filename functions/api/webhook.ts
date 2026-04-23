// CF Pages Function: Stripe Webhook Handler
// POST /api/webhook
// Receives Stripe events. On checkout.session.completed → writes to CF KV.
// Verifies webhook signature using Web Crypto API.

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PAYMENTS_KV: KVNamespace;
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

  if (!timestamp || !signature) {
    console.error('Missing timestamp or signature in Stripe-Signature header');
    return false;
  }

  // Reject old webhooks (older than 5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp, 10) > tolerance) {
    console.error('Webhook timestamp too old:', timestamp);
    return false;
  }

  // Construct signed payload
  const signedPayload = `${timestamp}.${payload}`;

  // HMAC-SHA256
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

  // Constant-time comparison
  return timingSafeEqual(expectedSig, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Main Handler ──
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const signatureHeader = context.request.headers.get('stripe-signature');
    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await context.request.text();
    const webhookSecret = context.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify signature
    const isValid = await verifyStripeSignature(payload, signatureHeader, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(payload) as Record<string, unknown>;
    const eventType = event.type as string;
    const data = event.data?.object as Record<string, unknown> | undefined;

    console.log(`Webhook received: ${eventType}`);

    // Handle checkout.session.completed
    if (eventType === 'checkout.session.completed' && data) {
      const sessionId = data.id as string;
      const clientRefId = (data.client_reference_id as string) || (data.metadata?.client_ref as string);
      const customerEmail = data.customer_details?.email as string || data.customer_email as string || '';
      const paymentStatus = data.payment_status as string;

      if (!clientRefId) {
        console.error('No client_reference_id in checkout session:', sessionId);
        return new Response(JSON.stringify({ error: 'No client_reference_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (paymentStatus === 'paid') {
        const record = {
          paid: true,
          sessionId,
          email: customerEmail,
          date: new Date().toISOString(),
          images: 500,
          amount: data.amount_total ? (data.amount_total as number) / 100 : 9,
        };

        // Store by session ID
        await context.env.PAYMENTS_KV.put(
          `session_${sessionId}`,
          JSON.stringify(record),
          { expirationTtl: 60 * 60 * 24 * 365 } // 1 year TTL
        );

        // Store by client reference ID (for lookup from frontend)
        await context.env.PAYMENTS_KV.put(
          `ref_${clientRefId}`,
          JSON.stringify(record),
          { expirationTtl: 60 * 60 * 24 * 365 } // 1 year TTL
        );

        // If email, also store by email for future lookups
        if (customerEmail) {
          await context.env.PAYMENTS_KV.put(
            `email_${customerEmail}`,
            JSON.stringify(record),
            { expirationTtl: 60 * 60 * 24 * 365 }
          );
        }

        console.log(`Payment confirmed: session=${sessionId}, ref=${clientRefId}, email=${customerEmail}`);
      }
    }

    // Handle checkout.session.expired (user started but didn't pay)
    if (eventType === 'checkout.session.expired') {
      console.log(`Checkout expired: ${(data?.id as string) || 'unknown'}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Health check
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: 'ok', service: 'stripe-webhook' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
