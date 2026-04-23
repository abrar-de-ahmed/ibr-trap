// CF Pages Function: Verify Payment Status
// GET /api/verify-payment?ref=<clientRefId>
// Checks CF KV for confirmed payment. Returns server-validated paid status.
// This replaces the localStorage-based trust model.

interface Env {
  PAYMENTS_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const clientRefId = url.searchParams.get('ref');

    if (!clientRefId) {
      return new Response(JSON.stringify({ error: 'ref parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up payment record by client reference ID
    const record = await context.env.PAYMENTS_KV.get(`ref_${clientRefId}`, 'json') as {
      paid: boolean;
      sessionId: string;
      email?: string;
      date: string;
      images: number;
    } | null;

    if (record && record.paid) {
      return new Response(JSON.stringify({
        paid: true,
        sessionId: record.sessionId,
        email: record.email || null,
        date: record.date,
        images: record.images,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ paid: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('verify-payment error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Also support POST for client-side calls
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { clientRefId } = await context.request.json<{ clientRefId: string }>();

    if (!clientRefId) {
      return new Response(JSON.stringify({ error: 'clientRefId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await context.env.PAYMENTS_KV.get(`ref_${clientRefId}`, 'json') as {
      paid: boolean;
      sessionId: string;
      email?: string;
      date: string;
      images: number;
    } | null;

    if (record && record.paid) {
      return new Response(JSON.stringify({
        paid: true,
        sessionId: record.sessionId,
        email: record.email || null,
        date: record.date,
        images: record.images,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ paid: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('verify-payment POST error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
