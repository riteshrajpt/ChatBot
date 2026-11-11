const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
const root = process.env.COMPILEON_TEST_ROOT || 'http://127.0.0.1:5000';
const marker = '__COMPILEON_SIGNALR_TEST__:' + crypto.randomBytes(8).toString('hex');
const statePath = path.join(__dirname, '..', '.local', 'signalr-test-state.json');
const state = { marker, sessions: [], inquiryId: crypto.randomUUID ? crypto.randomUUID() : id() };
function id() {
  const b = crypto.randomBytes(16); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex'); return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function save() { fs.writeFileSync(statePath, JSON.stringify(state)); }
function client() { return new HubConnectionBuilder().withUrl(root + '/hubs/chat', { transport: HttpTransportType.WebSockets, headers: { Origin: 'http://127.0.0.1:4200' } }).configureLogging(LogLevel.None).build(); }
async function main() {
  const first = client(), observer = client();
  const deadline = setTimeout(() => { console.error('SignalR test timed out.'); first.stop(); observer.stop(); process.exitCode = 1; }, 30000);
  const replies = [], unrelated = [];
  first.on('ReceiveMessage', message => replies.push(message));
  observer.on('ReceiveMessage', message => unrelated.push(message));
  save();
  try {
    await Promise.all([first.start(), observer.start()]);
    console.log('PASS: two SignalR WebSocket clients connected with the website origin.');
    const suggestions = await first.invoke('GetSuggestions');
    assert(suggestions.length >= 5 && suggestions.every(q => !q.includes('(starter)')));
    console.log('PASS: company-specific FAQ suggestions.');
    const session = await first.invoke('OpenSession'); state.sessions.push(session); save();
    const message = { ...session, messageId: id(), text: marker + ' Can you build a website?' };
    await first.invoke('SendMessage', message);
    assert(replies.some(r => r.messageId === message.messageId && /website/i.test(r.text)));
    assert.strictEqual(unrelated.length, 0);
    console.log('PASS: private server-pushed reply received only by the caller.');
    await first.invoke('SendMessage', message);
    let history = await first.invoke('GetHistory', session.sessionId, session.token);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].messageId, message.messageId);
    console.log('PASS: duplicate message retry does not duplicate stored history.');
    for (const text of ['How can AI help my business?', 'Do you work with cloud and real-time applications?', 'How do I start a project?']) {
      const messageId = id(); await first.invoke('SendMessage', { ...session, messageId, text });
      assert(replies.some(r => r.messageId === messageId && r.text.length > 20));
    }
    history = await first.invoke('GetHistory', session.sessionId, session.token);
    assert.strictEqual(history.length, 4);
    await assert.rejects(observer.invoke('GetHistory', session.sessionId, 'wrong-token'));
    console.log('PASS: repeated questions and protected session history.');
    await first.stop(); await first.start();
    history = await first.invoke('GetHistory', session.sessionId, session.token);
    assert.strictEqual(history.length, 4);
    console.log('PASS: conversation survives a new connection.');
    await assert.rejects(first.invoke('SendMessage', { ...session, messageId: id(), text: 'x'.repeat(2001) }));
    const inquiry = { id: state.inquiryId, fullName: marker, email: 'compileon-test@example.com', service: 'Product engineering', brief: marker + ' This is a synthetic integration-test enquiry only.', consent: true, website: '' };
    await assert.rejects(first.invoke('SubmitInquiry', { ...inquiry, consent: false }));
    const result = await first.invoke('SubmitInquiry', inquiry);
    const duplicate = await first.invoke('SubmitInquiry', inquiry);
    assert(result.reference && duplicate.reference === result.reference);
    console.log('PASS: enquiry validation, storage acknowledgement and idempotent retry.');
    console.log('SIGNALR_TESTS_PASSED');
  } finally { clearTimeout(deadline); await Promise.allSettled([first.stop(), observer.stop()]); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

