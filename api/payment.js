import crypto from 'node:crypto';

const PACKAGES = {
  alpine: { name: 'The Alpine', total: 300000, retainer: 90000 },
  savannah: { name: 'The Savannah', total: 360000, retainer: 108000 },
  kamori: { name: 'The Kamori', total: 420000, retainer: 126000 }
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();

  if (!accessToken || !locationId) {
    return res.status(503).json({ ok: false, error: 'Square is not configured yet.' });
  }

  const body = parseBody(req);
  const sourceId = String(body.sourceId || '').trim();
  const packageKey = String(body.packageKey || '').toLowerCase();
  const email = String(body.email || '').trim().slice(0, 255);
  const name = String(body.name || '').trim().slice(0, 120);
  const partnerName = String(body.partnerName || '').trim().slice(0, 120);
  const weddingDate = String(body.weddingDate || '').trim().slice(0, 40);

  const selected = PACKAGES[packageKey];
  if (!sourceId || !selected) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid payment information.' });
  }

  const endpoint = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2/payments'
    : 'https://connect.squareup.com/v2/payments';

  const noteParts = [
    `${selected.name} 30% wedding retainer`,
    name && `Client: ${name}`,
    partnerName && `Partner: ${partnerName}`,
    weddingDate && `Wedding date: ${weddingDate}`
  ].filter(Boolean);

  const squarePayload = {
    source_id: sourceId,
    idempotency_key: crypto.randomUUID(),
    amount_money: {
      amount: selected.retainer,
      currency: 'USD'
    },
    location_id: locationId,
    autocomplete: true,
    note: noteParts.join(' | ')
  };

  if (email) squarePayload.buyer_email_address = email;

  try {
    const squareResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2026-08-19'
      },
      body: JSON.stringify(squarePayload)
    });

    const data = await squareResponse.json().catch(() => ({}));

    if (!squareResponse.ok || !data.payment) {
      const detail = data?.errors?.[0]?.detail || 'Square could not complete the payment.';
      return res.status(400).json({ ok: false, error: detail });
    }

    return res.status(200).json({
      ok: true,
      paymentId: data.payment.id,
      status: data.payment.status,
      receiptUrl: data.payment.receipt_url || null,
      packageName: selected.name,
      amount: selected.retainer
    });
  } catch (error) {
    console.error('Square payment error', error);
    return res.status(500).json({ ok: false, error: 'Payment processing is temporarily unavailable.' });
  }
}
