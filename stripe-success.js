import crypto from 'node:crypto';

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export default async function handler(req, res) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const sessionId = req.query?.session_id;
  if (!secret || !sessionId) return res.redirect(303, '/checkout.html?error=missing-session');

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}` }
    });
    const session = await response.json();
    const paid = response.ok && session.payment_status === 'paid';
    const correctProduct = session.mode === 'payment' && session.currency === 'eur' && session.amount_total === 1499;
    if (!paid || !correctProduct) return res.redirect(303, '/checkout.html?error=payment-not-confirmed');

    const expires = Math.floor(Date.now() / 1000) + 31536000;
    const payload = `${session.id}.${expires}`;
    const token = `${payload}.${sign(payload, secret)}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', `raok_access=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
    return res.redirect(303, '/app.html');
  } catch (error) {
    console.error(error);
    return res.redirect(303, '/checkout.html?error=verification-failed');
  }
}
