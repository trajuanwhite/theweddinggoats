import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import handler from '../api/payment.js';
import balanceHandler from '../api/balance-payment.js';
process.env.SQUARE_ACCESS_TOKEN='test-token';process.env.SQUARE_LOCATION_ID='location';process.env.SQUARE_ENVIRONMENT='sandbox';
delete process.env.MICROSOFT_TENANT_ID;
let payments=new Map(),attempts=new Map(),charges=0;
global.fetch=async(url, options={})=>{
 if(options.method!=='POST'){const payment=payments.get(url.split('/').at(-1));return {ok:!!payment,json:async()=>({payment})}}
 const body=JSON.parse(options.body),key=body.idempotency_key;
 if(attempts.has(key)){const prev=attempts.get(key);if(JSON.stringify(prev.body)!==JSON.stringify(body))return {ok:false,status:400,json:async()=>({errors:[{code:'IDEMPOTENCY_KEY_REUSED',detail:'Key reused with changed request'}]})};return prev.response}
 let response;
 if(body.source_id==='decline')response={ok:false,status:400,json:async()=>({errors:[{code:'CARD_DECLINED',detail:'Card declined'}]})};
 else{const payment={...body,id:'pay'+(++charges),status:'COMPLETED',receipt_url:'https://squareup.com/receipt/'+charges,refunded_money:{amount:0}};payments.set(payment.id,payment);response={ok:true,status:200,json:async()=>({payment})}}
 attempts.set(key,{body,response});return response;
};
const base={sourceId:'card1',packageKey:'kamori',name:'Test Couple',partnerName:'Partner',email:'test@example.com',weddingDate:'2027-04-10',venue:'Venue',signature:'Test Couple',contractAccepted:true,contractVersion:'TWG-2026-09-03-v1',acceptedAt:'2026-10-07T21:00:00Z',splitPayment:true,firstCardAmount:100000,requestId:crypto.randomUUID()};
async function call(body,fn=handler){let status=200,out;await fn({method:'POST',body},{setHeader(){},status(s){status=s;return this},json(v){out=v;return v}});return {status,...out}}
const invalid=await call({...base,firstCardAmount:136395});assert.equal(invalid.status,400);assert.equal(charges,0);
const first=await call(base);assert.equal(first.partial,true);assert.equal(first.paidAmount,100000);assert.equal(first.remainingAmount,36395);assert.equal(first.confirmationUrl,undefined);
assert.equal((await call(base)).firstPaymentId,first.firstPaymentId);assert.equal(charges,1);
const secondBody={...base,sourceId:'decline',firstPaymentId:first.firstPaymentId};
const tamper=await call({...secondBody,name:'Another Client'});assert.equal(tamper.status,400);assert.equal(charges,1);
const declined=await call(secondBody);assert.equal(declined.status,400);assert.ok(declined.nextRetryAttempt);assert.equal(charges,1);
assert.equal((await call({...secondBody,retryAttempt:'fake'})).status,400);
const successfulBody={...secondBody,sourceId:'card2',retryAttempt:declined.nextRetryAttempt};
const completed=await call(successfulBody);assert.equal(completed.ok,true);assert.equal(completed.amount,136395);assert.equal(charges,2);assert.equal(payments.get(completed.paymentId).amount_money.amount,36395);
const confirmation=JSON.parse(Buffer.from(completed.confirmationUrl.split('#')[1],'base64url').toString());assert.equal(confirmation.receipts.length,2);assert.equal(confirmation.paymentId,`${first.firstPaymentId}, ${completed.paymentId}`);
assert.equal((await call(successfulBody)).paymentId,completed.paymentId);assert.equal(charges,2);
const balance=await call({action:'lookup',paymentId:completed.paymentId,email:base.email},balanceHandler);assert.equal(balance.booking.retainerPaid,136395);assert.equal(balance.booking.balance,318255);
assert.equal((await call({action:'lookup',paymentId:first.firstPaymentId,email:base.email},balanceHandler)).status,400);
payments.get(first.firstPaymentId).refunded_money.amount=100;assert.equal((await call(successfulBody)).status,400);payments.get(first.firstPaymentId).refunded_money.amount=0;
const single=await call({...base,requestId:crypto.randomUUID(),splitPayment:false,sourceId:'single'});assert.equal(single.amount,136395);assert.equal(single.partial,undefined);
// Execute the actual client script with DOM stubs to verify amounts and refresh restoration.
const html=fs.readFileSync(new URL('../payment-v2.html',import.meta.url),'utf8');const script=html.split('<script>')[1].split('</script>')[0];
function ui(saved){const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{id,value:id==='package'?'kamori':id==='paymentMode'?'single':'',style:{},classList:{add(){},remove(){}},addEventListener(){},scrollIntoView(){},checked:false});return elements.get(id)};
 const context=vm.createContext({document:{getElementById:el},localStorage:{getItem:()=>saved?JSON.stringify(saved):null},location:{search:'?package=kamori'},URLSearchParams,Intl,console,crypto,fetch:()=>new Promise(()=>{})});vm.runInContext(script,context);return {context,el}}
let client=ui();assert.equal(client.el('firstCardAmount').value,'1000.00');client.el('paymentMode').value='split';vm.runInContext('updateSummary()',client.context);assert.match(client.el('splitBreakdown').textContent, /\$1,000.00.*\$363.95/);assert.equal(vm.runInContext('amountToCharge()',client.context),1000);
client=ui({booking:base,firstPaymentId:first.firstPaymentId,sourceId:null});assert.equal(vm.runInContext('amountToCharge()',client.context),363.95);assert.equal(client.el('package').disabled,true);assert.match(client.el('payButton').textContent,/second card/);
console.log('PASS: split amounts, duplicate retry, declined-card retry, tamper/refund rejection, full confirmation, remaining balance, single-card payment, UI defaults and refresh recovery.');
