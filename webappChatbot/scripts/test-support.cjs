const assert=require('assert'),http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {HubConnectionBuilder,HttpTransportType,LogLevel}=require('@microsoft/signalr');
const root='http://127.0.0.1:5000',statePath=path.join(__dirname,'..','.local','support-test-state.json');
const state=JSON.parse(fs.readFileSync(statePath,'utf8').replace(/^\uFEFF/,''));
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state));
function id(){const b=crypto.randomBytes(16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=b.toString('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function api(method,url,body,token){
 return new Promise((resolve,reject)=>{const text=body===undefined?null:JSON.stringify(body);const headers={Origin:'http://127.0.0.1:4200'};if(text){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(text);}if(token)headers.Authorization='Bearer '+token;
 const req=http.request(root+url,{method,headers},res=>{let content='';res.on('data',chunk=>content+=chunk);res.on('end',()=>{let data;try{data=content?JSON.parse(content):null;}catch{data=content;}resolve({status:res.statusCode,body:data});});});req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('API test request timed out.')));if(text)req.write(text);req.end();});
}
function hub(name,token){return new HubConnectionBuilder().withUrl(root+'/hubs/'+name,{transport:HttpTransportType.WebSockets,headers:{Origin:'http://127.0.0.1:4200'},accessTokenFactory:()=>token||''}).configureLogging(LogLevel.None).build();}
async function waitFor(predicate){for(let i=0;i<120;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}assert(predicate(),'Expected cross-connection SignalR event was not received.');}
async function main(){
 const customer=hub('chat'),observer=hub('chat'),anonymousAdmin=hub('admin');let agent;let token;const customerMessages=[],observerMessages=[],botMessages=[],ticketUpdates=[];
 customer.on('SupportMessage',m=>customerMessages.push(m));observer.on('SupportMessage',m=>observerMessages.push(m));customer.on('ReceiveMessage',m=>botMessages.push(m));customer.on('SupportTicketChanged',t=>ticketUpdates.push(t));
 const timeout=setTimeout(()=>{console.error('Support integration test timed out.');process.exitCode=1;customer.stop();observer.stop();if(agent)agent.stop();},60000);
 try{
  for(const endpoint of ['/api/admin/tickets','/api/admin/inquiries','/api/Botknowledge/GetChatConversationID'])assert.strictEqual((await api('GET',endpoint)).status,401);
  await assert.rejects(anonymousAdmin.start());console.log('PASS: customer data and admin hub reject anonymous access.');
  const credentials={email:process.env.COMPILEON_TEST_ADMIN_EMAIL,password:process.env.COMPILEON_TEST_ADMIN_PASSWORD};
  let response=await api('POST','/api/admin/auth/login',credentials);assert.strictEqual(response.status,200);const temporary=response.body.token;
  assert(response.body.user.mustChangePassword);assert.strictEqual((await api('GET','/api/admin/tickets',undefined,temporary)).status,403);
  const newPassword=crypto.randomBytes(24).toString('base64');
  response=await api('POST','/api/admin/auth/change-password',{currentPassword:credentials.password,newPassword},temporary);
  assert.strictEqual(response.status,200);token=response.body.token;assert(!response.body.user.mustChangePassword);
  assert.strictEqual((await api('GET','/api/admin/auth/me',undefined,temporary)).status,401);
  assert.strictEqual((await api('GET','/api/admin/mail-status',undefined,token)).body.mode,'Disabled');
  console.log('PASS: first-login password change, role gating and old-session revocation.');
  const agents=(await api('GET','/api/admin/agents',undefined,token)).body;assert.strictEqual(agents.length,3);
  assert.deepStrictEqual(agents.map(a=>a.email).sort(),['rsinghfsd@gmail.com','compileon.directors@gmail.com','r.sritesh799@gmail.com'].sort());
  agent=hub('admin',token);await Promise.all([customer.start(),observer.start(),agent.start()]);
  const session=await customer.invoke('OpenSession');state.sessions.push(session);save();
  await customer.invoke('SendMessage',{...session,messageId:id(),text:state.marker+' Can you build a website?'});assert.strictEqual(botMessages.length,1);
  await assert.rejects(observer.invoke('JoinConversation',session.sessionId,'invalid-token'));
  const request={...session,customerName:state.marker,customerEmail:'support-test@example.invalid',subject:state.marker+' Real-time support test'};
  const ticket=await customer.invoke('RequestHuman',request);assert(agents.some(a=>a.id===ticket.assignedAdminId));assert.strictEqual(ticket.status,'Waiting');
  assert.strictEqual((await customer.invoke('RequestHuman',request)).id,ticket.id);
  let emails=(await api('GET','/api/admin/emails',undefined,token)).body.filter(e=>e.entityId===ticket.id);
  assert.strictEqual(emails.length,3);assert.deepStrictEqual(emails.map(e=>e.recipient).sort(),agents.map(a=>a.email).sort());
  console.log('PASS: random eligible-admin assignment and one queued alert for each of the three admins.');
  await agent.invoke('WatchTicket',ticket.id);
  const customerMessageId=id();await customer.invoke('SendMessage',{...session,messageId:customerMessageId,text:state.marker+' Customer message for the agent.'});
  assert(customerMessages.some(m=>m.id===customerMessageId&&m.senderRole==='customer'));assert.strictEqual(botMessages.length,1);
  response=await api('POST','/api/admin/tickets/'+ticket.id+'/claim',{},token);assert.strictEqual(response.status,200);assert.strictEqual(response.body.status,'Active');
  assert(ticketUpdates.some(t=>t.id===ticket.id&&t.status==='Active'));
  await agent.invoke('SetAvailability',false);await waitFor(()=>ticketUpdates.some(t=>t.id===ticket.id&&t.status==='Active'&&!t.agentOnline));
  await agent.invoke('SetAvailability',true);await waitFor(()=>ticketUpdates.some(t=>t.id===ticket.id&&t.status==='Active'&&t.agentOnline));
  const reply={ticketId:ticket.id,messageId:id(),text:'This is a synthetic agent reply for the end-to-end test.'};
  await agent.invoke('SendReply',reply);await agent.invoke('SendReply',reply);
  assert(customerMessages.some(m=>m.id===reply.messageId&&m.senderRole==='agent'));assert.strictEqual(observerMessages.length,0);
  let thread=(await api('GET','/api/admin/tickets/'+ticket.id,undefined,token)).body.messages;
  assert.strictEqual(thread.filter(m=>m.id.toLowerCase()===reply.messageId).length,1);
  response=await api('POST','/api/admin/tickets/'+ticket.id+'/reassign',{assignedAdminId:agents[0].id},token);assert.strictEqual(response.status,200);
  await assert.rejects(agent.invoke('SendReply',{...reply,messageId:id()}));
  assert.strictEqual((await api('POST','/api/admin/tickets/'+ticket.id+'/claim',{},token)).status,200);
  assert.strictEqual((await api('POST','/api/admin/tickets/'+ticket.id+'/close',{},token)).status,200);
  assert(ticketUpdates.some(t=>t.id===ticket.id&&t.status==='Closed'));
  const reopened=await customer.invoke('RequestHuman',request);assert.notStrictEqual(reopened.id,ticket.id);
  assert.strictEqual((await customer.invoke('EndSupport',session.sessionId,session.token)).status,'Closed');
  console.log('PASS: private two-way chat, idempotent replies, ownership, transfers and both close paths.');
  const inquiry={id:state.inquiryId,fullName:state.marker,email:'support-test@example.invalid',service:'Cloud engineering',brief:state.marker+' Synthetic project enquiry to verify the durable email workflow.',consent:true,website:''};
  await customer.invoke('SubmitInquiry',inquiry);await customer.invoke('SubmitInquiry',inquiry);
  emails=(await api('GET','/api/admin/emails',undefined,token)).body.filter(e=>e.entityId===inquiry.id);
  assert.strictEqual(emails.length,2);assert.deepStrictEqual(emails.map(e=>e.recipient).sort(),[inquiry.email,'compileon.directors@gmail.com'].sort());
  const inquiryResponse={id:id(),body:'This synthetic response confirms the project response workflow only.'};
  assert.strictEqual((await api('POST','/api/admin/inquiries/'+inquiry.id+'/reply',inquiryResponse,token)).status,200);
  assert.strictEqual((await api('POST','/api/admin/inquiries/'+inquiry.id+'/reply',inquiryResponse,token)).status,200);
  response=await api('GET','/api/admin/inquiries/'+inquiry.id,undefined,token);assert.strictEqual(response.body.replies.length,1);
  emails=(await api('GET','/api/admin/emails',undefined,token)).body.filter(e=>e.entityId===inquiry.id);assert.strictEqual(emails.length,4);assert(emails.every(e=>e.status==='Pending'));
  console.log('PASS: enquiry persistence and exactly two email copies for each receipt and admin response.');
  const closed=new Promise(resolve=>agent.onclose(()=>resolve()));
  await api('POST','/api/admin/auth/logout',{},token);await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Admin connection did not revoke on logout.')),3000))]);
  assert.strictEqual((await api('GET','/api/admin/tickets',undefined,token)).status,401);
  for(let i=0;i<5;i++)assert.strictEqual((await api('POST','/api/admin/auth/login',{email:credentials.email,password:'incorrect-test-password'})).status,401);
  assert.strictEqual((await api('POST','/api/admin/auth/login',{email:credentials.email,password:newPassword})).status,401);
  console.log('PASS: logout disconnects the admin hub, revoked tokens fail and repeated bad logins lock out.');
  console.log('SUPPORT_INTEGRATION_TESTS_PASSED');
 }finally{clearTimeout(timeout);await Promise.allSettled([customer.stop(),observer.stop(),anonymousAdmin.stop(),agent?agent.stop():Promise.resolve()]);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

