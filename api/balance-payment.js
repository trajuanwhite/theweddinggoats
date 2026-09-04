import crypto from 'node:crypto';

const TAX_RATE = 0.0825;
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

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function findPackageFromRetainer(amount) {
  return Object.entries(PACKAGES).find(([, pkg]) => pkg.retainer + Math.round(pkg.retainer * TAX_RATE) === amount) || null;
}

async function getOriginalPayment({ accessToken, environment, paymentId }) {
  const base = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const response = await fetch(`${base}/v2/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2026-08-19'
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.payment) {
    throw new Error(data?.errors?.[0]?.detail || 'We could not verify the original retainer payment.');
  }
  return data.payment;
}

function verifiedBooking(payment, email, locationId) {
  if (payment.location_id !== locationId) throw new Error('This payment does not belong to this Wedding Goats account.');
  if (payment.status !== 'COMPLETED') throw new Error('The original retainer payment is not completed.');

  const amount = Number(payment?.amount_money?.amount || 0);
  const match = findPackageFromRetainer(amount);
  if (!match) throw new Error('This payment does not match a Wedding Goats booking retainer.');

  const paymentEmail = String(payment.buyer_email_address || '').trim().toLowerCase();
  const suppliedEmail = String(email || '').trim().toLowerCase();
  if (!suppliedEmail) throw new Error('Please enter the email used for your booking.');
  if (paymentEmail && paymentEmail !== suppliedEmail) throw new Error('That email does not match the original booking payment.');

  const [packageKey, selected] = match;
  const fullTax = Math.round(selected.total * TAX_RATE);
  const fullTotal = selected.total + fullTax;
  const balance = fullTotal - amount;
  const note = String(payment.note || '');
  const weddingMatch = note.match(/Wedding:\s*([^|]+)/i);
  const clientMatch = note.match(/Client:\s*([^|]+)/i);

  return {
    packageKey,
    packageName: selected.name,
    collectionSubtotal: selected.total,
    fullTax,
    fullTotal,
    retainerPaid: amount,
    balance,
    weddingDate: weddingMatch ? weddingMatch[1].trim() : '',
    clientName: clientMatch ? clientMatch[1].trim() : '',
    email: suppliedEmail
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
  if (!accessToken || !locationId) return res.status(503).json({ ok: false, error: 'Square is not configured yet.' });

  const body = parseBody(req);
  const action = String(body.action || 'lookup').toLowerCase();
  const paymentId = String(body.paymentId || '').trim().slice(0, 160);
  const email = String(body.email || '').trim().slice(0, 255);
  if (!paymentId || !email) return res.status(400).json({ ok: false, error: 'Enter your booking payment ID and email address.' });

  try {
    const original = await getOriginalPayment({ accessToken, environment, paymentId });
    const booking = verifiedBooking(original, email, locationId);

    if (action === 'lookup') {
      return res.status(200).json({ ok: true, booking: { ...booking, balanceFormatted: money(booking.balance), fullTotalFormatted: money(booking.fullTotal), retainerPaidFormatted: money(booking.retainerPaid) } });
    }

    if (action !== 'pay') return res.status(400).json({ ok: false, error: 'Invalid request.' });

    const sourceId = String(body.sourceId || '').trim();
    if (!sourceId) return res.status(400).json({ ok: false, error: 'Payment information is missing.' });

    const endpoint = environment === 'production' ? 'https://connect.squareup.com/v2/payments' : 'https://connect.squareupsandbox.com/v2/payments';
    const noteParts = [
      `${booking.packageName} remaining wedding balance`,
      booking.clientName && `Client: ${booking.clientName}`,
      booking.weddingDate && `Wedding: ${booking.weddingDate}`,
      `Original retainer payment: ${paymentId}`
    ].filter(Boolean);

    const squareResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2026-08-19'
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: crypto.randomUUID(),
        amount_money: { amount: booking.balance, currency: 'USD' },
        location_id: locationId,
        autocomplete: true,
        buyer_email_address: booking.email,
        note: noteParts.join(' | ').slice(0, 500)
      })
    });

    const data = await squareResponse.json().catch(() => ({}));
    if (!squareResponse.ok || !data.payment) {
      return res.status(400).json({ ok: false, error: data?.errors?.[0]?.detail || 'Square could not complete the balance payment.' });
    }

    return res.status(200).json({
      ok: true,
      paymentId: data.payment.id,
      status: data.payment.status,
      squareReceiptUrl: data.payment.receipt_url || null,
      amount: booking.balance,
      amountFormatted: money(booking.balance),
      packageName: booking.packageName,
      weddingDate: booking.weddingDate
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message || 'We could not verify this booking.' });
  }
}
