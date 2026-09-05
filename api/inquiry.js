const RECIPIENTS = ['trajuan@theweddinggoats.com', 'iesha@theweddinggoats.com'];
const SENDER = 'trajuan@theweddinggoats.com';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;
const rateBuckets = globalThis.__weddingGoatsInquiryRateBuckets || new Map();
globalThis.__weddingGoatsInquiryRateBuckets = rateBuckets;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clean(value = '') {
  return String(value).trim();
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  }).format(d);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || 'unknown';
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim() || 'unknown';
  return req.headers['x-real-ip'] || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(ip, recent);

  if (rateBuckets.size > 1000) {
    for (const [key, values] of rateBuckets.entries()) {
      const active = values.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
      if (active.length) rateBuckets.set(key, active);
      else rateBuckets.delete(key);
    }
  }

  return recent.length > RATE_LIMIT;
}

function looksLikeHumanName(value) {
  const name = clean(value);
  if (name.length < 2 || name.length > 60) return false;
  if (/https?:\/\/|www\.|@|\d/.test(name)) return false;
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(name)) return false;

  const compact = name.replace(/[^A-Za-z]/g, '');
  if (compact.length >= 18) {
    const caseTransitions = (compact.match(/[a-z][A-Z]|[A-Z][a-z]/g) || []).length;
    if (caseTransitions >= 5) return false;
  }
  return true;
}

function isValidWeddingDate(value) {
  const dateText = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;

  const wedding = new Date(`${dateText}T12:00:00Z`);
  if (Number.isNaN(wedding.getTime())) return false;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const latest = new Date(today);
  latest.setUTCFullYear(latest.getUTCFullYear() + 5);

  return wedding >= today && wedding <= latest;
}

function isValidPhone(value) {
  const phone = clean(value);
  if (!phone) return true;
  if (/https?:\/\/|www\.|@/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function looksSuspiciousText(value, minLength = 2) {
  const text = clean(value);
  if (text.length < minLength || text.length > 2000) return true;
  if (/https?:\/\/|\[url|<a\s/i.test(text)) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const {
      yourName,
      partnerName,
      email,
      phone,
      weddingDate,
      venueOrCity,
      filmPackage,
      vision,
      planner,
      heard,
      acknowledgement,
      website,
      formStartedAt
    } = req.body || {};

    // Honeypot: silently accept bot submissions without sending email.
    if (clean(website)) return res.status(200).json({ ok: true });

    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return res.status(429).json({ ok: false, error: 'Too many inquiry attempts. Please try again shortly.' });
    }

    const required = [yourName, partnerName, email, weddingDate, venueOrCity, vision, acknowledgement];
    if (required.some((value) => !clean(value))) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Most automated form spam posts immediately after the page loads.
    const startedAt = Number(formStartedAt);
    if (Number.isFinite(startedAt)) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 0 && elapsed < 2500) return res.status(200).json({ ok: true });
    }

    if (!looksLikeHumanName(yourName) || !looksLikeHumanName(partnerName)) {
      return res.status(400).json({ ok: false, error: 'Please enter valid names' });
    }

    const emailAddress = clean(email).toLowerCase();
    if (emailAddress.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailAddress)) {
      return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ ok: false, error: 'Invalid phone number' });
    }

    if (!isValidWeddingDate(weddingDate)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid upcoming wedding date' });
    }

    if (looksSuspiciousText(venueOrCity, 2) || looksSuspiciousText(vision, 10)) {
      return res.status(400).json({ ok: false, error: 'Please check the wedding details and try again' });
    }

    if (clean(acknowledgement) !== 'Confirmed') {
      return res.status(400).json({ ok: false, error: 'Please confirm the inquiry acknowledgement' });
    }

    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      console.error('Missing Microsoft environment variables');
      return res.status(500).json({ ok: false, error: 'Email service is not configured' });
    }

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Microsoft token request failed', tokenResponse.status, tokenData?.error);
      return res.status(502).json({ ok: false, error: 'Unable to authenticate email service' });
    }

    const couple = `${clean(yourName)} + ${clean(partnerName)}`;
    const prettyDate = formatDate(clean(weddingDate));
    const subject = `New Wedding Inquiry — ${couple} — ${prettyDate}`;

    const html = `
      <div style="margin:0;padding:32px;background:#f7f3eb;font-family:Arial,Helvetica,sans-serif;color:#1e1d1a;">
        <div style="max-width:700px;margin:0 auto;background:#fffdf9;border:1px solid #ddd5ca;">
          <div style="padding:34px 40px 20px;border-bottom:1px solid #e5ddd2;">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#746d63;margin-bottom:12px;">The Wedding Goats</div>
            <h1 style="font-size:30px;line-height:1.2;font-weight:400;margin:0 0 8px;">New Wedding Inquiry</h1>
            <div style="font-size:16px;color:#5f5951;">${escapeHtml(couple)} · ${escapeHtml(prettyDate)}</div>
          </div>
          <div style="padding:30px 40px;">
            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">Couple</h2>
            <p style="margin:0 0 26px;font-size:17px;line-height:1.6;"><strong>${escapeHtml(couple)}</strong></p>

            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">Contact</h2>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.75;">
              Email: <a href="mailto:${escapeHtml(emailAddress)}">${escapeHtml(emailAddress)}</a><br>
              Phone: ${escapeHtml(clean(phone) || 'Not provided')}
            </p>

            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">Wedding</h2>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.75;">
              Date: ${escapeHtml(prettyDate)}<br>
              Venue / City: ${escapeHtml(clean(venueOrCity))}<br>
              Planner: ${escapeHtml(clean(planner) || 'Not provided')}
            </p>

            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">Interested In</h2>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.7;">${escapeHtml(clean(filmPackage) || 'Not sure yet')}</p>

            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">What They Want to Remember Most</h2>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(clean(vision))}</p>

            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">How They Found Us</h2>
            <p style="margin:0;font-size:15px;line-height:1.7;">${escapeHtml(clean(heard) || 'Not provided')}</p>
          </div>
          <div style="padding:20px 40px;background:#eee7dc;color:#625c54;font-size:12px;line-height:1.6;">
            Reply to this email to respond directly to ${escapeHtml(clean(yourName))}.
          </div>
        </div>
      </div>`;

    const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: RECIPIENTS.map((address) => ({ emailAddress: { address } })),
          replyTo: [{ emailAddress: { address: emailAddress, name: couple } }]
        },
        saveToSentItems: true
      })
    });

    if (!graphResponse.ok) {
      const graphText = await graphResponse.text();
      console.error('Microsoft sendMail failed', graphResponse.status, graphText.slice(0, 500));
      return res.status(502).json({ ok: false, error: 'Unable to send inquiry email' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Inquiry endpoint error', error?.message || error);
    return res.status(500).json({ ok: false, error: 'Unexpected server error' });
  }
}
