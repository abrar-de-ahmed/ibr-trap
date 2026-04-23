// v2 -  CF Pages Function: Verify Payment Status (Stripe API-based)
// GET /api/verify-payment?session_id=cs_xxx
// POST /api/verify-payment  body: { sessionId: "cs_xxx" }
// Calls Stripe API directly to verify payment. No KV dependency.

interface Env {
  STRIPE_SECRET_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const method = context.request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const stripeKey = context.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: corsHeaders,
      });
    }

    let sessionId = '';

    if (method === 'GET') {
      const url = new URL(context.request.url);
      sessionId = url.searchParams.get('session_id') || '';
    } else {
      const body = await context.request.json<{ sessionId?: string; clientRefId?: string }>();
      sessionId = body.sessionId || '';
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ paid: false, error: 'session_id required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Call Stripe API to check session status
    const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Basic ${btoa(stripeKey + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ paid: false, error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      });
    }

    const session = await resp.json() as Record<string, unknown>;

    if (session.payment_status === 'paid') {
      // Security: Verify this session belongs to OUR product (not cross-account spoofing)
      const metadata = session.metadata as Record<string, string> | undefined;
      const product = metadata?.product || '';
      const expectedAmount = 900; // $9.00 in cents
      const actualAmount = (session.amount_total as number) || 0;

      if (product !== 'bg-remover-pro') {
        console.warn(`verify-payment: Rejected session ${sessionId} — wrong product: ${product}`);
        return new Response(JSON.stringify({ paid: false, error: 'Invalid session' }), {
          status: 200, headers: corsHeaders,
        });
      }

      if (actualAmount < expectedAmount) {
        console.warn(`verify-payment: Rejected session ${sessionId} — wrong amount: ${actualAmount} (expected ${expectedAmount})`);
        return new Response(JSON.stringify({ paid: false, error: 'Invalid session' }), {
          status: 200, headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({
        paid: true,
        sessionId: session.id,
        email: session.customer_details
          ? (session.customer_details as Record<string, string>).email || null
          : (session.customer_email as string) || null,
        amount: Math.round(actualAmount / 100 * 100) / 100,
        images: 500,
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ paid: false }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: corsHeaders,
    });
  }
};
