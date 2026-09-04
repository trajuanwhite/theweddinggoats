import { createBalanceKey } from './_balance-link.js';

const SENDER = 'trajuan@theweddinggoats.com';
const TAX_RATE = 0.0825;
const PACKAGES = [
  { name: 'The Alpine', total: 300000, retainer: 90000 },
  { name: 'The Savannah', total: 360000, retainer: 108000 },
  { name: 'The Kamori', total: 420000, retainer: 126000 }
];

function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((cents||0)/100)}
function escapeHtml(value=''){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function chicagoDatePlusDays(days){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));const d=new Date(`${values.year}-${values.month}-${values.day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function prettyDate(dateString){const d=new Date(`${dateString}T12:00:00Z`);return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(d)}
function packageFromRetainerAmount(amount){return PACKAGES.find(pkg=>pkg.retainer+Math.round(pkg.retainer*TAX_RATE)===amount)||null}

async function getGraphToken(){
  const tenantId=process.env.MICROSOFT_TENANT_ID,clientId=process.env.MICROSOFT_CLIENT_ID,clientSecret=process.env.MICROSOFT_CLIENT_SECRET;
  if(!tenantId||!clientId||!clientSecret)return null;
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})});
  const data=await response.json().catch(()=>({}));return response.ok?data.access_token||null:null;
}

async function listSquarePayments(accessToken,environment,locationId){
  const base=environment==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';const payments=[];let cursor='',pages=0;
  do{const qs=new URLSearchParams({location_id:locationId,sort_order:'DESC',limit:'100'});if(cursor)qs.set('cursor',cursor);const response=await fetch(`${base}/v2/payments?${qs.toString()}`,{headers:{Authorization:`Bearer ${accessToken}`,'Square-Version':'2026-08-19'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.errors?.[0]?.detail||'Could not read Square payments.');payments.push(...(data.payments||[]));cursor=data.cursor||'';pages+=1}while(cursor&&pages<20);return payments;
}

async function sendReminder(graphToken,booking){
  const fullTax=Math.round(booking.pkg.total*TAX_RATE);const fullTotal=booking.pkg.total+fullTax;const balance=fullTotal-booking.retainerPaid;
  const key=createBalanceKey(booking.paymentId,booking.email);if(!key)return false;
  const balanceUrl=`https://theweddinggoats.com/balance-secure.html?key=${encodeURIComponent(key)}`;
  const html=`<div style="font-family:Arial,Helvetica,sans-serif;color:#1e1d1a;line-height:1.65;max-width:680px;margin:auto"><p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8f7459">The Wedding Goats</p><h2 style="font-size:30px;font-weight:400;margin-bottom:10px">Your remaining balance is due.</h2><p>Hi ${escapeHtml(booking.clientName||'there')},</p><p>Your wedding is coming up on <strong>${escapeHtml(prettyDate(booking.weddingDate))}</strong>. Per your Wedding Videography Agreement, your remaining balance is due today.</p><div style="background:#f7f3eb;padding:22px;margin:24px 0"><p style="margin:4px 0"><strong>Collection:</strong> ${escapeHtml(booking.pkg.name)}</p><p style="margin:4px 0"><strong>Remaining balance:</strong> ${money(balance)}</p><p style="margin:4px 0"><strong>Wedding date:</strong> ${escapeHtml(prettyDate(booking.weddingDate))}</p></div><p>Use the button below to open your verified booking directly. No payment code or email re-entry is required.</p><p style="margin:28px 0"><a href="${balanceUrl}" style="display:inline-block;background:#24211d;color:#fff;text-decoration:none;padding:15px 24px;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Pay Remaining Balance</a></p><p>We can’t wait to capture your day.</p><p>The Wedding Goats LLC</p></div>`;
  const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${graphToken}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:`Wedding Goats Balance Reminder — ${prettyDate(booking.weddingDate)}`,body:{contentType:'HTML',content:html},toRecipients:[{emailAddress:{address:booking.email,name:booking.clientName||undefined}}],bccRecipients:[{emailAddress:{address:'trajuan@theweddinggoats.com'}},{emailAddress:{address:'iesha@theweddinggoats.com'}}]},saveToSentItems:true})});
  return response.ok;
}

export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Method not allowed'})}
  const cronSecret=process.env.CRON_SECRET;if(!cronSecret||req.headers.authorization!==`Bearer ${cronSecret}`)return res.status(401).json({ok:false,error:'Unauthorized'});
  const accessToken=process.env.SQUARE_ACCESS_TOKEN,locationId=process.env.SQUARE_LOCATION_ID,environment=(process.env.SQUARE_ENVIRONMENT||'sandbox').toLowerCase();if(!accessToken||!locationId)return res.status(503).json({ok:false,error:'Square is not configured.'});
  try{
    const targetWeddingDate=chicagoDatePlusDays(14);const payments=await listSquarePayments(accessToken,environment,locationId);const completedBalanceFor=new Set();
    for(const payment of payments){if(payment.status!=='COMPLETED')continue;const match=String(payment.note||'').match(/Original retainer payment:\s*([^|]+)/i);if(match)completedBalanceFor.add(match[1].trim())}
    const dueBookings=[];
    for(const payment of payments){if(payment.status!=='COMPLETED'||completedBalanceFor.has(payment.id))continue;const amount=Number(payment?.amount_money?.amount||0);const pkg=packageFromRetainerAmount(amount);if(!pkg)continue;const note=String(payment.note||'');if(!/30% wedding retainer/i.test(note))continue;const weddingMatch=note.match(/Wedding:\s*([^|]+)/i);if(!weddingMatch||weddingMatch[1].trim()!==targetWeddingDate)continue;const email=String(payment.buyer_email_address||'').trim();if(!email)continue;const clientMatch=note.match(/Client:\s*([^|]+)/i);dueBookings.push({paymentId:payment.id,email,clientName:clientMatch?clientMatch[1].trim():'',weddingDate:targetWeddingDate,retainerPaid:amount,pkg})}
    if(!dueBookings.length)return res.status(200).json({ok:true,targetWeddingDate,found:0,sent:0});const graphToken=await getGraphToken();if(!graphToken)return res.status(503).json({ok:false,error:'Email is not configured.'});let sent=0;const failed=[];
    for(const booking of dueBookings){try{if(await sendReminder(graphToken,booking))sent+=1;else failed.push(booking.paymentId)}catch(error){failed.push(booking.paymentId);console.error('Balance reminder email error',booking.paymentId,error?.message||error)}}
    return res.status(200).json({ok:true,targetWeddingDate,found:dueBookings.length,sent,failed});
  }catch(error){console.error('Balance reminder job error',error);return res.status(500).json({ok:false,error:error?.message||'Reminder job failed.'})}
}
