import crypto from 'node:crypto';

function secret() {
  return String(process.env.CRON_SECRET || '').trim();
}

export function createBalanceKey(paymentId, email) {
  const key = secret();
  if (!key || !paymentId || !email) return '';
  const payload = Buffer.from(JSON.stringify({
    p: String(paymentId).trim(),
    e: String(email).trim().toLowerCase()
  }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', `wedding-goats-balance:${key}`).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyBalanceKey(value) {
  const key = secret();
  const token = String(value || '').trim();
  if (!key || !token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', `wedding-goats-balance:${key}`).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const paymentId = String(data?.p || '').trim();
    const email = String(data?.e || '').trim().toLowerCase();
    if (!paymentId || !email) return null;
    return { paymentId, email };
  } catch {
    return null;
  }
}
