// CF Pages Function: Create Stripe Checkout Session
// POST /api/create-checkout
// Body: { clientRefId: string } (UUID generated on client)
// Returns: { url: string, sessionId: string }

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
  SITE_URL: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { clientRefId } = await context.request.json<{ clientRefId: string }>();

    if (!clientRefId || typeof clientRefId !== 'string') {
      return new Response(JSON.stringify({ error: 'clientRefId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = context.env.STRIPE_SECRET_KEY;
    const priceId = context.env.STRIPE_PRICE_ID;
    const siteUrl = context.env.SITE_URL || 'https://bgremoverdigital.pages.dev';

    if (!stripeKey || !priceId) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Stripe Checkout Session
    const formData = new URLSearchParams();
    formData.append('mode', 'payment');
    formData.append('line_items[0][price]', priceId);
    formData.append('line_items[0][quantity]', '1');
    formData.append('client_reference_id', clientRefId);
    formData.append('success_url', `${siteUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    formData.append('cancel_url', `${siteUrl}/?payment=cancelled`);
    formData.append('payment_method_types[0]', 'card');
    // Collect customer email for future use
    formData.append('customer_creation', 'always');
    // Metadata
    formData.append('metadata[client_ref]', clientRefId);
    formData.append('metadata[product]', 'bg-remover-pro');
    formData.append('metadata[images]', '500');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(stripeKey + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const session = await response.json() as Record<string, unknown>;

    if (!response.ok || session.error) {
      const errMsg = (session.error as Record<string, string>)?.message || 'Failed to create session';
      console.error('Stripe error:', errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-checkout error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
