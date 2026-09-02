const RECIPIENTS = ['trajuan@theweddinggoats.com', 'iesha@theweddinggoats.com'];
const SENDER = 'trajuan@theweddinggoats.com';

function clean(value = '') { return String(value).trim(); }
function escapeHtml(value = '') { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDate(value) {
  if (!value) return 'Not provided';
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(d);
}
function row(label, value) {
  return `<tr><td style="padding:9px 12px 9px 0;color:#746d63;vertical-align:top;width:190px;">${escapeHtml(label)}</td><td style="padding:9px 0;vertical-align:top;white-space:pre-wrap;">${escapeHtml(clean(value) || 'Not provided')}</td></tr>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ok:false,error:'Method not allowed'}); }
  try {
    const data = req.body || {};
    if (clean(data.website)) return res.status(200).json({ok:true});
    const required = [data.yourName, data.partnerName, data.email, data.weddingDate];
    if (required.some(v => !clean(v))) return res.status(400).json({ok:false,error:'Missing required fields'});
    const email = clean(data.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ok:false,error:'Invalid email address'});

    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return res.status(500).json({ok:false,error:'Email service is not configured'});

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return res.status(502).json({ok:false,error:'Unable to authenticate email service'});

    const couple = `${clean(data.yourName)} + ${clean(data.partnerName)}`;
    const prettyDate = formatDate(clean(data.weddingDate));
    const subject = `Wedding Details — ${couple} — ${prettyDate}`;
    const html = `<div style="margin:0;padding:32px;background:#f7f3eb;font-family:Arial,Helvetica,sans-serif;color:#1e1d1a;"><div style="max-width:760px;margin:0 auto;background:#fffdf9;border:1px solid #ddd5ca;"><div style="padding:34px 40px 20px;border-bottom:1px solid #e5ddd2;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#746d63;margin-bottom:12px;">The Wedding Goats</div><h1 style="font-size:30px;font-weight:400;margin:0 0 8px;">Wedding Details</h1><div style="font-size:16px;color:#5f5951;">${escapeHtml(couple)} · ${escapeHtml(prettyDate)}</div></div><div style="padding:30px 40px;"><table style="border-collapse:collapse;width:100%;font-size:15px;line-height:1.55;">${row('Couple',couple)}${row('Email',email)}${row('Phone',data.phone)}${row('Wedding date',prettyDate)}${row('Wedding party size',data.weddingPartySize)}${row('Coordinator / planner',data.coordinator)}${row('Coordinator contact',data.coordinatorContact)}${row('Getting ready — partner 1',data.gettingReadyOne)}${row('Getting ready — partner 2',data.gettingReadyTwo)}${row('Ceremony location',data.ceremonyLocation)}${row('Reception location',data.receptionLocation)}${row('Wedding colors / style',data.colors)}${row('Personal vows / letters',data.vowsLetters)}${row('Timeline / key times',data.timeline)}${row('Interview requests',data.interviews)}${row('Photo / video considerations',data.photoVideo)}${row('Sentimental details / people',data.sentimental)}${row('Special traditions / surprises',data.traditions)}${row('Questions / requests',data.requests)}</table></div><div style="padding:20px 40px;background:#eee7dc;color:#625c54;font-size:12px;">Reply to this email to respond directly to ${escapeHtml(clean(data.yourName))}.</div></div></div>`;

    const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
      method:'POST', headers:{Authorization:`Bearer ${tokenData.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({message:{subject,body:{contentType:'HTML',content:html},toRecipients:RECIPIENTS.map(address=>({emailAddress:{address}})),replyTo:[{emailAddress:{address:email,name:couple}}]},saveToSentItems:true})
    });
    if (!graphResponse.ok) { const t=await graphResponse.text(); console.error('Microsoft details sendMail failed',graphResponse.status,t.slice(0,500)); return res.status(502).json({ok:false,error:'Unable to send details email'}); }
    return res.status(200).json({ok:true});
  } catch (error) { console.error('Details endpoint error',error?.message||error); return res.status(500).json({ok:false,error:'Unexpected server error'}); }
}
