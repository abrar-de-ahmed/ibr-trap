// CF Pages Function Middleware: Security + Rate Limiting
// Runs before every /api/* request
// Stateless rate limiting using in-memory (resets per cold start)
// and IP-based basic protection

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
  SITE_URL: string;
}

// Rate limit store (in-memory, per-worker-instance)
// On CF Pages free tier, each request may hit different instances
// This is a basic first layer; Cloudflare WAF handles advanced rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = {
  'create-checkout': 5,   // 5 checkout attempts per minute per IP
  'verify-payment': 30,   // 30 verifications per minute per IP
  'webhook': 100,         // 100 webhook calls per minute per IP
  'default': 60,          // 60 requests per minute per IP for any other endpoint
};

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
}

function checkRateLimit(ip: string, endpoint: string): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const max = RATE_LIMIT_MAX[endpoint] || RATE_LIMIT_MAX['default'];
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: max - 1, resetIn: Math.ceil(RATE_LIMIT_WINDOW / 1000) };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, remaining: max - entry.count, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const ip = getClientIP(context.request);

  // Skip rate limiting for non-API routes
  if (!url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // Extract endpoint name
  const endpoint = url.pathname.replace('/api/', '').split('/')[0] || 'default';
  const rateLimit = checkRateLimit(ip, endpoint);

  // Set rate limit headers on all API responses
  const securityHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX[endpoint] || RATE_LIMIT_MAX['default']),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.resetIn),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please slow down.',
        retryAfter: rateLimit.resetIn,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.resetIn),
          ...securityHeaders,
        },
      }
    );
  }

  // Additional security: Validate clientRefId format for checkout
  if (endpoint === 'create-checkout' && context.request.method === 'POST') {
    try {
      const body = await context.request.clone().json<{ clientRefId?: string }>();
      if (!body.clientRefId || typeof body.clientRefId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid request' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...securityHeaders } }
        );
      }
      // UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(body.clientRefId)) {
        console.warn(`Security: Invalid clientRefId format from IP ${ip}`);
        return new Response(
          JSON.stringify({ error: 'Invalid request format' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...securityHeaders } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...securityHeaders } }
      );
    }
  }

  // Log suspicious activity
  if (rateLimit.remaining <= 2) {
    console.warn(`Security: Rate limit nearly exceeded for ${endpoint} from IP ${ip} (${rateLimit.remaining} remaining)`);
  }

  // Continue to the actual handler
  const response = await context.next();

  // Add security headers to the response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
