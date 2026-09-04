import crypto from 'node:crypto';

const TAX_RATE = 0.0825;
const CONTRACT_VERSION = 'TWG-2026-09-03-v1';
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
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();

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
  const venue = String(body.venue || '').trim().slice(0, 180);
  const signature = String(body.signature || '').trim().slice(0, 120);
  const contractAccepted = body.contractAccepted === true;
  const contractVersion = String(body.contractVersion || '').trim();
  const acceptedAt = String(body.acceptedAt || '').trim().slice(0, 60);

  const selected = PACKAGES[packageKey];
  if (!sourceId || !selected) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid payment information.' });
  }
  if (!name || !email || !weddingDate || !signature || !contractAccepted || contractVersion !== CONTRACT_VERSION) {
    return res.status(400).json({ ok: false, error: 'Please review and electronically sign the current Wedding Videography Agreement before paying.' });
  }

  const tax = Math.round(selected.retainer * TAX_RATE);
  const amountDue = selected.retainer + tax;

  const endpoint = environment === 'production'
    ? 'https://connect.squareup.com/v2/payments'
    : 'https://connect.squareupsandbox.com/v2/payments';

  const noteParts = [
    `${selected.name} 30% wedding retainer + 8.25% sales tax`,
    `Client: ${name}`,
    partnerName && `Partner: ${partnerName}`,
    weddingDate && `Wedding: ${weddingDate}`,
    `Contract ${CONTRACT_VERSION} signed electronically by ${signature}`,
    acceptedAt && `Accepted ${acceptedAt}`
  ].filter(Boolean);

  const squarePayload = {
    source_id: sourceId,
    idempotency_key: crypto.randomUUID(),
    amount_money: { amount: amountDue, currency: 'USD' },
    location_id: locationId,
    autocomplete: true,
    note: noteParts.join(' | ').slice(0, 500)
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

    const signedAt = acceptedAt || new Date().toISOString();
    const confirmationData = {
      name,
      partnerName,
      weddingDate,
      venue,
      packageKey,
      packageName: selected.name,
      signature,
      contractVersion: CONTRACT_VERSION,
      acceptedAt: signedAt,
      paymentId: data.payment.id,
      squareReceiptUrl: data.payment.receipt_url || null
    };
    const confirmationToken = Buffer.from(JSON.stringify(confirmationData), 'utf8').toString('base64url');
    const confirmationUrl = `/confirmation.html#${confirmationToken}`;

    return res.status(200).json({
      ok: true,
      paymentId: data.payment.id,
      status: data.payment.status,
      receiptUrl: confirmationUrl,
      squareReceiptUrl: data.payment.receipt_url || null,
      confirmationUrl,
      packageName: selected.name,
      retainer: selected.retainer,
      tax,
      amount: amountDue,
      contractVersion: CONTRACT_VERSION,
      signedBy: signature,
      acceptedAt: signedAt
    });
  } catch (error) {
    console.error('Square payment error', error);
    return res.status(500).json({ ok: false, error: 'Payment processing is temporarily unavailable.' });
  }
}
