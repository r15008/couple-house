const encoder = new TextEncoder();
const defaultState = () => ({
  theme: 'pink', mood: '甜甜的', bound: false, partnerName: '', inviteCode: '',
  tasks: [true, false, false],
  records: [{ id: 1, date: '今天 · 10:24', text: '一起把小屋的窗帘换成了喜欢的颜色。', author: '你们', tone: 'pink' }],
  wishes: [{ id: 1, text: '一起去看海', done: false }, { id: 2, text: '养一只真正的小猫', done: false }]
});

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function roomStub(env, code) { return env.ROOMS.get(env.ROOMS.idFromName(code)); }
function newCode() { return `LUV-${Math.floor(1000 + Math.random() * 9000)}`; }
const petSystemPrompt = `你是情侣共同小屋里的 AI 宠物“小团子”。你温柔、活泼、会记得对方正在经营小屋和完成任务。请用自然的中文回答普通问题，可以聊天、解释知识、给建议、陪伴和创作。回答要简洁但有帮助，通常不超过 180 个字。不要假装自己是人类，不要索取密码、验证码、银行卡、住址等隐私。遇到伤害自己或他人、违法、危险操作、色情剥削、恶意入侵、医疗或法律高风险问题时，简短说明不能协助，并给出安全、合法的替代建议；不要提供可执行的危险步骤。`;

async function petChat(request, env) {
  const payload = await request.json().catch(() => ({}));
  const message = String(payload.message || '').trim().slice(0, 600);
  if (!message) return json({ error: 'message is required' }, 400);
  if (!env.AI?.run) return json({ error: 'ai binding is not enabled' }, 503);
  const history = Array.isArray(payload.history) ? payload.history.slice(-10).map(item => ({
    role: item.role === 'pet' ? 'assistant' : 'user',
    content: String(item.text || '').slice(0, 600)
  })).filter(item => item.content) : [];
  try {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [{ role: 'system', content: petSystemPrompt }, ...history, { role: 'user', content: message }],
      max_tokens: 280,
      temperature: 0.7
    });
    const reply = String(result?.response || result?.output_text || result?.text || '').trim();
    if (!reply) return json({ error: 'empty ai response' }, 502);
    return json({ reply: reply.slice(0, 800), provider: 'cloudflare-workers-ai' });
  } catch (error) {
    return json({ error: 'ai request failed', detail: String(error?.message || 'unknown') }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, provider: 'cloudflare-workers' });
    if (request.method === 'POST' && url.pathname === '/api/pet-chat') return petChat(request, env);
    if (request.method === 'POST' && url.pathname === '/api/room/create') {
      const room = newCode();
      const state = defaultState(); state.inviteCode = room;
      await roomStub(env, room).fetch('https://room/state', { method: 'POST', body: JSON.stringify({ state, source: 'system' }) });
      return json({ room, state }, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/room/join') {
      const payload = await request.json(); const code = String(payload.code || '').trim().toUpperCase();
      if (!/^LUV-\d{4}$/.test(code)) return json({ error: 'invite code not found' }, 404);
      const response = await roomStub(env, code).fetch('https://room/join', { method: 'POST', body: JSON.stringify(payload) });
      return new Response(response.body, response);
    }
    const room = String(url.searchParams.get('room') || '').trim().toUpperCase();
    if (!room) return json({ error: 'room is required' }, 400);
    if (url.pathname === '/api/state') return roomStub(env, room).fetch(new Request('https://room/state', request));
    if (url.pathname === '/api/events') return roomStub(env, room).fetch('https://room/events');
    return json({ error: 'not found' }, 404);
  }
};

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    this.listeners = new Set();
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  }

  read() {
    const row = this.ctx.storage.sql.exec('SELECT data FROM state WHERE id = 1').one();
    return row ? JSON.parse(row.data) : defaultState();
  }

  write(state, source) {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO state (id, data) VALUES (1, ?)', JSON.stringify(state));
    const message = encoder.encode(`data: ${JSON.stringify({ state, source })}\n\n`);
    for (const listener of this.listeners) { try { listener.enqueue(message); } catch { this.listeners.delete(listener); } }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/events') {
      const room = this;
      return new Response(new ReadableStream({ start(controller) { room.listeners.add(controller); controller.enqueue(encoder.encode(': connected\n\n')); request.signal.addEventListener('abort', () => { room.listeners.delete(controller); try { controller.close(); } catch {} }); } }), { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' } });
    }
    if (request.method === 'GET') return json({ state: this.read() });
    const payload = await request.json();
    if (url.pathname === '/join') {
      const state = { ...this.read(), bound: true, partnerName: payload.name || 'TA' };
      this.write(state, payload.source || null); return json({ room: payload.code, state });
    }
    if (!payload.state || typeof payload.state !== 'object') return json({ error: 'state is required' }, 400);
    this.write(payload.state, payload.source || null); return json({ ok: true });
  }
}
