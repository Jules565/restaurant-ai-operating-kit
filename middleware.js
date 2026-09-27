export const config = {
  matcher: ['/app.html']
};

function base64urlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verify(payload, signature, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    base64urlToBytes(signature),
    new TextEncoder().encode(payload)
  );
}

export default async function middleware(req) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)raok_access=([^;]+)/);

  if (!secret || !match) {
    return new Response('This workspace is private. Please purchase the Restaurant AI Operating Kit first.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  let token;
  try {
    token = decodeURIComponent(match[1]);
  } catch {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const [sessionId, expires, signature] = parts;
  if (!sessionId || !/^\d+$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000)) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const valid = await verify(`${sessionId}.${expires}`, signature, secret);
    if (!valid) {
      return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  return;
}
