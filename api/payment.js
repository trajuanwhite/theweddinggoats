import crypto from 'node:crypto';

const TAX_RATE = 0.0825;
const CONTRACT_VERSION = 'TWG-2026-09-03-v1';
const SENDER = 'trajuan@theweddinggoats.com';
const INTERNAL_ARCHIVE_RECIPIENTS = ['trajuan@theweddinggoats.com', 'iesha@theweddinggoats.com'];
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function agreementSections() {
  return `
<h3>1. Event & Client Information</h3><p>This Wedding Videography Agreement (“Agreement”) is between <strong>The Wedding Goats LLC</strong> (“Company”) and the client identified in the booking confirmation (“Client”). The booking details, wedding date, venue/location and selected collection are incorporated into this Agreement.</p>
<h3>2. Collection & Contract Price</h3><p>Client has selected the collection shown in the booking confirmation. The collection price is subject to 8.25% Texas sales tax. A 30% booking retainer plus applicable sales tax is due when this Agreement is executed. The remaining balance must be paid in full no later than fourteen (14) calendar days before the wedding date. The wedding date is not reserved until this Agreement has been electronically signed and the required retainer successfully received.</p>
<h3>3. Services & Deliverables</h3><p>The Wedding Goats LLC will provide the wedding videography services and deliverables included in Client's selected collection as described on The Wedding Goats website and booking summary at the time this Agreement is executed. The selected collection and listed deliverables are incorporated into this Agreement. Additional services requested after booking may require additional fees and written approval.</p>
<h3>4. Booking Retainer</h3><p>The booking retainer compensates The Wedding Goats LLC for reserving the wedding date, declining other potential bookings for that date, and beginning preparation for Client's event. Except where otherwise required by applicable law or expressly provided in this Agreement, the booking retainer is non-refundable. No wedding date will be held without both a signed Agreement and successful payment of the required retainer.</p>
<h3>5. Cancellation by Client</h3><p>If Client cancels the wedding or videography services for any reason, Client must notify The Wedding Goats LLC in writing. The booking retainer will remain non-refundable except where otherwise required by law. Amounts paid beyond the booking retainer for services not yet performed will be handled according to applicable law and the circumstances of cancellation. If substantial preparation, travel, special purchases, subcontractor commitments, or other nonrecoverable expenses have been incurred specifically for Client's wedding, Client may remain responsible for those costs to the extent permitted by law.</p>
<h3>6. Rescheduling</h3><p>If the wedding is rescheduled, The Wedding Goats LLC will make reasonable efforts to transfer the booking to the new date, subject to availability. If available, payments already made may be applied to the rescheduled event. Reasonable additional expenses resulting from the date change, including travel or staffing expenses, may be charged with prior notice. If The Wedding Goats LLC is unavailable for the new date, the change may be treated as a Client cancellation under this Agreement.</p>
<h3>7. Cancellation or Inability to Perform by The Wedding Goats LLC</h3><p>If The Wedding Goats LLC cannot perform the contracted services because of circumstances within its reasonable control and cannot provide a reasonably suitable replacement professional for the contracted services, Client will receive a refund of amounts paid for services that cannot be performed. The Wedding Goats LLC will make reasonable efforts to notify Client promptly and assist with an appropriate solution.</p>
<h3>8. Force Majeure</h3><p>Neither party will be considered in breach for failure to perform caused by events beyond that party's reasonable control, including severe weather, natural disasters, fire, government restrictions, venue closure, widespread transportation disruption, serious illness or medical emergency, acts of terrorism, civil unrest, or other extraordinary circumstances that make performance impossible or unsafe. The parties will communicate promptly and make reasonable efforts to reschedule or otherwise resolve affected services.</p>
<h3>9. Coverage & Client Responsibilities</h3><p>Client is responsible for providing accurate event information, schedules, addresses, venue rules, and other information reasonably necessary to provide the contracted services. Client should notify The Wedding Goats LLC of important events, traditions, surprises, or individuals particularly desired to be captured. The Wedding Goats LLC will make reasonable professional efforts to capture significant moments; however, <strong>no specific shot, person, event, reaction, speech, or moment is guaranteed.</strong> Weddings are live, uncontrolled events and circumstances may prevent particular footage from being captured.</p>
<h3>10. Venue & Third-Party Restrictions</h3><p>The Wedding Goats LLC is not responsible for limitations caused by venue policies, officiants, churches, coordinators, security personnel, photographers, DJs, guests, or other third parties, including restrictions on camera placement, lighting, audio equipment, movement, access, or recording. Client agrees to obtain permissions reasonably necessary for videography at event locations.</p>
<h3>11. Interference With Coverage</h3><p>The Wedding Goats LLC is not responsible for missed or compromised footage caused by circumstances outside its reasonable control, including guests blocking cameras, other vendors obstructing shots, unexpected schedule changes, venue restrictions, weather, or Client/guest interference. The Wedding Goats LLC will make reasonable efforts to adapt.</p>
<h3>12. Creative Control</h3><p>Client acknowledges that The Wedding Goats LLC has been selected based upon its portfolio, filmmaking style, storytelling approach, and creative judgment. The Wedding Goats LLC retains reasonable artistic and editorial discretion regarding camera placement, shot selection, editing, pacing, color grading, audio treatment, music selection, storytelling, and overall creative presentation. The finished film may not include every recorded moment or piece of footage captured.</p>
<h3>13. Editing & Revision Requests</h3><p>The Wedding Goats LLC will professionally edit the final film according to its established creative style. Reasonable requests to correct factual errors such as misspelled names or an obvious technical mistake will be considered. Substantial re-editing, changes in creative direction, replacement of properly delivered content, or additional edits outside the selected collection may require an additional fee agreed upon before work begins.</p>
<h3>14. Delivery</h3><p>The standard delivery timeframe is <strong>within sixty (60) days following the wedding date</strong>, unless otherwise communicated because of extraordinary circumstances. Delivery timelines are estimates made in good faith and may be affected by circumstances beyond the Company's reasonable control. Final films will be provided through digital downloadable files unless otherwise specified in the selected collection.</p>
<h3>15. Raw Footage</h3><p>Raw footage is not included unless expressly listed as part of Client's selected collection or purchased separately. If included, Client understands raw footage may contain unedited clips, duplicate takes, incomplete moments, camera movement, unprocessed color and audio, and material that would not ordinarily appear in a finished film.</p>
<h3>16. Copyright</h3><p>To the extent permitted by law, The Wedding Goats LLC retains copyright and ownership of footage and completed creative works it produces. After full payment, Client receives a personal-use license to download, display, share, and reproduce delivered films for noncommercial purposes. Client may not sell, commercially license, or materially alter delivered films for commercial use without written permission from The Wedding Goats LLC.</p>
<h3>17. Storage & Archiving</h3><p>Client is responsible for downloading and maintaining backup copies of delivered files. The Wedding Goats LLC may retain project files and footage for a reasonable period after delivery but does not guarantee permanent archival storage unless separately agreed in writing.</p>
<h3>18. Equipment Failure, Data Loss & Technical Events</h3><p>The Wedding Goats LLC uses professional equipment and reasonable backup practices; however, digital media and electronic equipment can fail. If footage is lost, damaged, corrupted, or rendered unusable because of equipment failure, media corruption, theft, or another technical event despite reasonable professional precautions, any remedy will be determined according to the portion of contracted services materially affected, applicable law, and the limitation-of-liability provisions of this Agreement.</p>
<h3>19. Limitation of Liability</h3><p>To the maximum extent permitted by applicable law, The Wedding Goats LLC's total liability arising from this Agreement will not exceed the amount Client actually paid to The Wedding Goats LLC under this Agreement. To the extent permitted by law, neither party will be liable for indirect, incidental, special, exemplary, punitive, or consequential damages. Nothing in this Agreement waives liability that cannot legally be waived or limited.</p>
<h3>20. Safety</h3><p>The Wedding Goats LLC may stop or suspend coverage if its personnel reasonably determine that conditions are unsafe, threatening, illegal, or create a substantial risk of injury or equipment damage. When reasonably possible, The Wedding Goats LLC will communicate the concern and allow an opportunity for the condition to be corrected before ending coverage.</p>
<h3>21. Travel & Additional Expenses</h3><p>Any travel fees or extraordinary expenses not included in the selected collection will be disclosed and agreed upon before they are charged. Material changes in event locations after execution of this Agreement may result in reasonable additional travel expenses.</p>
<h3>22. Payment</h3><p>All payments must be made according to the payment schedule stated in this Agreement. Failure to pay the remaining balance by the due date may result in suspension of services or withholding of final deliverables until the account is paid in full, subject to applicable law.</p>
<h3>23. Dispute Resolution & Governing Law</h3><p>The parties agree to first make a good-faith effort to resolve any disagreement directly. Before filing a lawsuit, either party may request non-binding mediation in Texas unless immediate legal relief is reasonably necessary. This Agreement is governed by the laws of the State of Texas, without regard to conflict-of-law principles. Any legal proceeding arising from this Agreement will be brought in a court of competent jurisdiction in Texas as permitted by applicable law.</p>
<h3>24. Electronic Transactions & Signatures</h3><p>The parties consent to conducting this transaction electronically. Client agrees that a typed signature adopted with intent to sign, checkbox acceptance associated with the Agreement, or other legally recognized electronic signature method may execute this Agreement. The parties intend electronic signatures and records associated with this Agreement to have the same effect as permitted by applicable law.</p>
<h3>25. Entire Agreement</h3><p>This Agreement, together with the selected collection and written addenda expressly incorporated into it, constitutes the entire agreement regarding these services. Material modifications must be agreed upon by both parties in writing or another legally recognized electronic record. If any provision is found unenforceable, the remaining provisions remain in effect to the extent permitted by law.</p>
<h3>26. Acknowledgment & Acceptance</h3><p>By signing, Client confirms that Client has reviewed this Agreement; understands the selected collection, pricing, payment schedule, and cancellation terms; has had the opportunity to ask questions; agrees to conduct this transaction electronically; and agrees to be bound by this Agreement.</p>`;
}

function buildSignedAgreement({ name, partnerName, email, weddingDate, venue, selected, signature, signedAt, paymentId, squareReceiptUrl, amountDue, tax }) {
  const fullTax = Math.round(selected.total * TAX_RATE);
  const fullTotal = selected.total + fullTax;
  const balance = fullTotal - amountDue;
  const couple = [name, partnerName].filter(Boolean).join(' + ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Signed Wedding Videography Agreement</title><style>body{font-family:Arial,sans-serif;color:#1e1d1a;max-width:860px;margin:40px auto;line-height:1.65;padding:0 24px}h1{font-weight:400}h2{margin-top:34px}h3{margin:24px 0 6px;font-size:15px}.meta{background:#f7f3eb;padding:24px;margin:24px 0}.meta p{margin:5px 0}.sig{font-size:28px;margin:10px 0}.small{color:#6c655d;font-size:12px}</style></head><body><h1>The Wedding Goats LLC</h1><h2>Signed Wedding Videography Agreement</h2><div class="meta"><p><strong>Couple:</strong> ${escapeHtml(couple)}</p><p><strong>Client email:</strong> ${escapeHtml(email)}</p><p><strong>Wedding date:</strong> ${escapeHtml(weddingDate)}</p><p><strong>Venue / location:</strong> ${escapeHtml(venue || 'Not provided')}</p><p><strong>Collection:</strong> ${escapeHtml(selected.name)}</p><p><strong>Collection subtotal:</strong> ${money(selected.total)}</p><p><strong>Booking retainer:</strong> ${money(selected.retainer)}</p><p><strong>Sales tax paid at booking:</strong> ${money(tax)}</p><p><strong>Paid at booking:</strong> ${money(amountDue)}</p><p><strong>Remaining balance incl. tax:</strong> ${money(balance)}</p><p><strong>Square payment ID:</strong> ${escapeHtml(paymentId)}</p><p><strong>Contract version:</strong> ${CONTRACT_VERSION}</p></div><h2>Electronic Signature</h2><div class="sig">${escapeHtml(signature)}</div><p class="small">Electronically accepted on ${escapeHtml(signedAt)}.</p>${squareReceiptUrl ? `<p><a href="${escapeHtml(squareReceiptUrl)}">View Square payment receipt</a></p>` : ''}<hr>${agreementSections()}</body></html>`;
}

async function emailSignedAgreement(record) {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return false;

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) return false;

  const agreementHtml = buildSignedAgreement(record);
  const couple = [record.name, record.partnerName].filter(Boolean).join(' + ');
  const subject = `Signed Wedding Videography Agreement — ${couple} — ${record.weddingDate}`;
  const emailHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e1d1a;line-height:1.65"><h2>You're officially booked.</h2><p>Thank you for choosing The Wedding Goats. Your booking retainer was received and your electronically signed Wedding Videography Agreement is attached for your records.</p><p><strong>Collection:</strong> ${escapeHtml(record.selected.name)}<br><strong>Paid today:</strong> ${money(record.amountDue)}<br><strong>Wedding date:</strong> ${escapeHtml(record.weddingDate)}<br><strong>Signed by:</strong> ${escapeHtml(record.signature)}</p>${record.squareReceiptUrl ? `<p><a href="${escapeHtml(record.squareReceiptUrl)}">View your Square receipt</a></p>` : ''}<p>We also retain a copy of this signed agreement in our business email records.</p><p>The Wedding Goats LLC</p></div>`;
  const filenameSafe = record.weddingDate.replace(/[^0-9-]/g, '') || 'wedding';

  const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: emailHtml },
        toRecipients: [{ emailAddress: { address: record.email, name: record.name } }],
        bccRecipients: INTERNAL_ARCHIVE_RECIPIENTS.map((address) => ({ emailAddress: { address } })),
        attachments: [{
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: `Wedding-Goats-Signed-Agreement-${filenameSafe}.html`,
          contentType: 'text/html',
          contentBytes: Buffer.from(agreementHtml, 'utf8').toString('base64')
        }]
      },
      saveToSentItems: true
    })
  });
  return graphResponse.ok;
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
  const endpoint = environment === 'production' ? 'https://connect.squareup.com/v2/payments' : 'https://connect.squareupsandbox.com/v2/payments';

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
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Square-Version': '2026-08-19' },
      body: JSON.stringify(squarePayload)
    });

    const data = await squareResponse.json().catch(() => ({}));
    if (!squareResponse.ok || !data.payment) {
      const detail = data?.errors?.[0]?.detail || 'Square could not complete the payment.';
      return res.status(400).json({ ok: false, error: detail });
    }

    const signedAt = acceptedAt || new Date().toISOString();
    const confirmationData = { name, partnerName, weddingDate, venue, packageKey, packageName: selected.name, signature, contractVersion: CONTRACT_VERSION, acceptedAt: signedAt, paymentId: data.payment.id, squareReceiptUrl: data.payment.receipt_url || null };
    const confirmationToken = Buffer.from(JSON.stringify(confirmationData), 'utf8').toString('base64url');
    const confirmationUrl = `/confirmation.html#${confirmationToken}`;

    let archiveEmailSent = false;
    try {
      archiveEmailSent = await emailSignedAgreement({ name, partnerName, email, weddingDate, venue, selected, signature, signedAt, paymentId: data.payment.id, squareReceiptUrl: data.payment.receipt_url || null, amountDue, tax });
      if (!archiveEmailSent) console.error('Signed agreement archive email was not sent');
    } catch (archiveError) {
      console.error('Signed agreement archive error', archiveError?.message || archiveError);
    }

    return res.status(200).json({ ok: true, paymentId: data.payment.id, status: data.payment.status, receiptUrl: confirmationUrl, squareReceiptUrl: data.payment.receipt_url || null, confirmationUrl, packageName: selected.name, retainer: selected.retainer, tax, amount: amountDue, contractVersion: CONTRACT_VERSION, signedBy: signature, acceptedAt: signedAt, archiveEmailSent });
  } catch (error) {
    console.error('Square payment error', error);
    return res.status(500).json({ ok: false, error: 'Payment processing is temporarily unavailable.' });
  }
}
