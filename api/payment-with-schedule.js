import paymentHandler from './payment.js';

const TAX_RATE = 0.0825;
const SENDER = 'trajuan@theweddinggoats.com';
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dueDateFromWedding(weddingDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDate || '')) return '';
  const d = new Date(`${weddingDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
}

function prettyDate(dateString) {
  if (!dateString) return '14 days before your wedding';
  const d = new Date(`${dateString}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

async function getGraphToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? data.access_token || null : null;
}

async function sendPaymentSchedule({ name, email, weddingDate, packageKey, paymentId }) {
  const selected = PACKAGES[packageKey];
  if (!selected || !email || !paymentId) return false;

  const token = await getGraphToken();
  if (!token) return false;

  const fullTax = Math.round(selected.total * TAX_RATE);
  const retainerTax = Math.round(selected.retainer * TAX_RATE);
  const retainerPaid = selected.retainer + retainerTax;
  const fullTotal = selected.total + fullTax;
  const balance = fullTotal - retainerPaid;
  const dueDate = dueDateFromWedding(weddingDate);
  const balanceUrl = `https://theweddinggoats.com/balance.html?payment=${encodeURIComponent(paymentId)}`;

  const emailHtml = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e1d1a;line-height:1.65;max-width:680px;margin:auto">
    <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8f7459">The Wedding Goats</p>
    <h2 style="font-size:30px;font-weight:400;margin-bottom:10px">Your payment schedule</h2>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>Your wedding date is officially reserved. Here is the remaining payment information for your ${escapeHtml(selected.name)} collection.</p>
    <div style="background:#f7f3eb;padding:22px;margin:24px 0">
      <p style="margin:4px 0"><strong>Total contract:</strong> ${money(fullTotal)}</p>
      <p style="margin:4px 0"><strong>Retainer received:</strong> ${money(retainerPaid)}</p>
      <p style="margin:4px 0"><strong>Remaining balance:</strong> ${money(balance)}</p>
      <p style="margin:4px 0"><strong>Balance due:</strong> ${escapeHtml(prettyDate(dueDate))}</p>
    </div>
    <p>You can pay the remaining balance securely through The Wedding Goats website using the button below. Your original booking is already connected to the link.</p>
    <p style="margin:28px 0"><a href="${balanceUrl}" style="display:inline-block;background:#24211d;color:#fff;text-decoration:none;padding:15px 24px;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Pay Remaining Balance</a></p>
    <p style="font-size:13px;color:#6c655d">For security, the balance page will also ask you to confirm the email address used for your booking.</p>
    <p>We’ll also send a reminder when your balance due date is approaching.</p>
    <p>The Wedding Goats LLC</p>
  </div>`;

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: `Your Wedding Goats Payment Schedule — Balance due ${prettyDate(dueDate)}`,
        body: { contentType: 'HTML', content: emailHtml },
        toRecipients: [{ emailAddress: { address: email, name: name || undefined } }],
        bccRecipients: [
          { emailAddress: { address: 'trajuan@theweddinggoats.com' } },
          { emailAddress: { address: 'iesha@theweddinggoats.com' } }
        ]
      },
      saveToSentItems: true
    })
  });
  return response.ok;
}

export default async function handler(req, res) {
  const requestBody = parseBody(req);
  let statusCode = 200;
  const captureRes = {
    setHeader: (...args) => res.setHeader(...args),
    status(code) { statusCode = code; return this; },
    async json(payload) {
      if (statusCode >= 200 && statusCode < 300 && payload?.ok && payload?.paymentId) {
        try {
          await sendPaymentSchedule({
            name: String(requestBody.name || '').trim(),
            email: String(requestBody.email || '').trim(),
            weddingDate: String(requestBody.weddingDate || '').trim(),
            packageKey: String(requestBody.packageKey || '').toLowerCase(),
            paymentId: payload.paymentId
          });
        } catch (error) {
          console.error('Payment schedule email error', error?.message || error);
        }
      }
      return res.status(statusCode).json(payload);
    }
  };

  return paymentHandler(req, captureRes);
}
