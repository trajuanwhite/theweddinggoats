const RECIPIENTS = ['trajuan@theweddinggoats.com', 'iesha@theweddinggoats.com'];
const SENDER = 'trajuan@theweddinggoats.com';

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
      website
    } = req.body || {};

    // Honeypot: silently accept bot submissions without sending email.
    if (clean(website)) return res.status(200).json({ ok: true });

    const required = [yourName, partnerName, email, weddingDate, venueOrCity, vision, acknowledgement];
    if (required.some((value) => !clean(value))) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const emailAddress = clean(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      return res.status(400).json({ ok: false, error: 'Invalid email address' });
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
