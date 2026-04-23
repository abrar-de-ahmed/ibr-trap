// CF Pages Function: Verify Payment Status
// GET/POST /api/verify-payment?ref=<clientRefId>  or  POST body: { clientRefId }
// Checks CF KV for confirmed payment. Returns server-validated paid status.

interface Env {
  PAYMENTS_KV: KVNamespace;
}

async function verify(context: { request: Request; env: Env }, clientRefId: string) {
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(JSON.stringify({ paid: false }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const method = context.request.method;

    // GET: ?ref=<clientRefId>
    if (method === 'GET') {
      const clientRefId = url.searchParams.get('ref');
      if (!clientRefId) {
        return new Response(JSON.stringify({ error: 'ref parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return verify(context, clientRefId);
    }

    // POST: body = { clientRefId }
    if (method === 'POST') {
      const { clientRefId } = await context.request.json<{ clientRefId: string }>();
      if (!clientRefId) {
        return new Response(JSON.stringify({ error: 'clientRefId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return verify(context, clientRefId);
    }

    // OPTIONS (CORS)
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
