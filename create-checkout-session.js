export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe is not configured on the server.' });

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  if (!host) return res.status(500).json({ error: 'Missing host.' });
  const origin = `${proto}://${host}`;

  const body = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': '1499',
    'line_items[0][price_data][product_data][name]': 'Restaurant AI Operating Kit',
    'line_items[0][price_data][product_data][description]': 'Interactive AI workspace for restaurants, cafés and hospitality teams.',
    'line_items[0][quantity]': '1',
    success_url: `${origin}/api/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout.html?canceled=1`,
    customer_creation: 'always',
    billing_address_collection: 'auto',
    allow_promotion_codes: 'true'
  });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data?.error?.message || 'Stripe could not create checkout.' });
    return res.status(200).json({ url: data.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to start checkout.' });
  }
}
