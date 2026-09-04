import balancePaymentHandler from './balance-payment.js';
import { verifyBalanceKey } from './_balance-link.js';

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

  const body = parseBody(req);
  const verified = verifyBalanceKey(body.key);
  if (!verified) {
    return res.status(401).json({ ok: false, error: 'This balance link is invalid or no longer available.' });
  }

  req.body = {
    ...body,
    paymentId: verified.paymentId,
    email: verified.email
  };

  return balancePaymentHandler(req, res);
}
