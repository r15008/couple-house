const STORAGE_KEY = 'couple-house-state-v1';
const CHANNEL_NAME = 'couple-house-live';
const ONLINE_SYNC = location.protocol !== 'file:';
let ROOM_ID = localStorage.getItem('couple-house-room') || '';
const CLIENT_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const defaultState = {
  theme: 'pink', mood: '甜甜的', bound: false, partnerName: '', inviteCode: 'LUV-6281',
  tasks: [true, false, false],
  records: [{ id: 1, date: '今天 · 10:24', text: '一起把小屋的窗帘换成了喜欢的颜色。', author: '你们', tone: 'pink' }],
  wishes: [{ id: 1, text: '一起去看海', done: false }, { id: 2, text: '养一只真正的小猫', done: false }]
};

const clone = value => JSON.parse(JSON.stringify(value));
let state;
try { state = { ...clone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { state = clone(defaultState); }
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function saveState(message, shouldBroadcast = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (shouldBroadcast && channel) channel.postMessage({ type: 'state:update', state });
  if (shouldBroadcast && ONLINE_SYNC) {
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: ROOM_ID, state, source: CLIENT_ID }) }).catch(() => showToast('本地已保存，云端连接稍后重试'));
  }
  if (message) showToast(message);
  render();
}

function render() {
  const appShell = document.querySelector('#appShell');
  appShell.dataset.theme = state.theme;
  document.querySelector('#moodText').textContent = state.mood;
  document.querySelector('#taskCount').textContent = `${state.tasks.filter(Boolean).length} / ${state.tasks.length}`;
  document.querySelectorAll('[data-task="true"]').forEach((task, index) => {
    const done = Boolean(state.tasks[index]);
    task.classList.toggle('task-done', done);
    task.querySelector('.check-circle').textContent = done ? '✓' : '';
    task.querySelector('small').textContent = done ? '已完成' : '去完成';
  });
  renderTimeline();
  renderWishes();
  renderCouple();
  document.querySelector('#inviteCode').textContent = state.inviteCode || 'LUV-6281';
  const boundText = state.bound ? `已和 ${state.partnerName || 'TA'} 连接` : '还没有绑定另一半';
  document.querySelector('#bindingStatus').innerHTML = `<span class="binding-dot ${state.bound ? 'connected' : ''}"></span>${boundText}`;
}

function renderTimeline() {
  const timeline = document.querySelector('#timeline');
  timeline.innerHTML = state.records.map(record => `<article class="record-card"><div class="record-date">${record.date}</div><div class="record-body"><span class="record-avatar ${record.tone}">${record.author === 'TA' ? 'TA' : '你们'}</span><p>${record.text}</p><button class="record-heart" data-record-id="${record.id}" aria-label="喜欢这条记录">♡</button></div></article>`).join('');
  timeline.querySelectorAll('.record-heart').forEach(button => button.addEventListener('click', () => { button.textContent = '♥'; button.classList.add('liked'); showToast('已收藏这份小小的幸福 ♥'); }));
}

function renderWishes() {
  const list = document.querySelector('#wishList');
  list.innerHTML = state.wishes.map(wish => `<button class="wish-item ${wish.done ? 'wish-done' : ''}" data-wish-id="${wish.id}"><span class="wish-check">${wish.done ? '✓' : '♡'}</span><span>${wish.text}</span><small>${wish.done ? '完成啦' : '一起实现'}</small></button>`).join('');
  list.querySelectorAll('.wish-item').forEach(item => item.addEventListener('click', () => { const wish = state.wishes.find(entry => String(entry.id) === item.dataset.wishId); wish.done = !wish.done; saveState(wish.done ? '心愿完成，记得庆祝一下 ✨' : '心愿重新加入清单'); }));
}

function renderCouple() {
  const profile = document.querySelector('#coupleProfile');
  profile.innerHTML = state.bound ? `<div class="couple-avatars"><span class="avatar avatar-you">你</span><span class="connection-line">♥</span><span class="avatar avatar-partner">TA</span></div><strong>你和 ${state.partnerName || 'TA'}</strong><span>已经一起走过 128 天</span><em><span class="binding-dot connected"></span>实时同步已开启</em>` : `<div class="couple-avatars single"><span class="avatar avatar-you">你</span><span class="connection-line">＋</span><span class="avatar avatar-empty">?</span></div><strong>等待另一半加入</strong><span>绑定后就能共同经营这间小屋</span><button id="profileBindButton">去绑定 TA</button>`;
  document.querySelector('#profileBindButton')?.addEventListener('click', openBind);
}

function switchPage(page) {
  document.querySelectorAll('.home-only').forEach(element => { element.hidden = page !== 'home'; });
  document.querySelectorAll('.page-view').forEach(element => { element.hidden = element.dataset.page !== page; });
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.pageTarget === page));
}

const decorateModal = document.querySelector('#decorateModal');
const bindModal = document.querySelector('#bindModal');
function closeModal(modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
function openBind() { bindModal.classList.add('open'); bindModal.setAttribute('aria-hidden', 'false'); render(); }
function closeAllModals() { closeModal(decorateModal); closeModal(bindModal); }

document.querySelector('#decorateButton').addEventListener('click', () => { decorateModal.classList.add('open'); decorateModal.setAttribute('aria-hidden', 'false'); document.querySelectorAll('.theme-option').forEach(option => option.classList.toggle('active', option.dataset.theme === state.theme)); });
document.querySelector('#closeDecorate').addEventListener('click', () => closeModal(decorateModal));
document.querySelector('#closeBind').addEventListener('click', () => closeModal(bindModal));
document.querySelector('.avatar-button').addEventListener('click', openBind);
document.querySelector('#openBindFromPage').addEventListener('click', openBind);
document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllModals(); });

document.querySelectorAll('.theme-option').forEach(option => option.addEventListener('click', () => {
  state.theme = option.dataset.theme;
  document.querySelector('#appShell').dataset.theme = state.theme;
  document.querySelectorAll('.theme-option').forEach(item => item.classList.toggle('active', item === option));
}));
document.querySelector('#saveDecorate').addEventListener('click', () => { closeModal(decorateModal); saveState('小屋布置保存成功，等 TA 回来看 ✨'); });

document.querySelector('#feedButton').addEventListener('click', event => { document.querySelector('#petBubble').textContent = '好满足呀，谢谢你！'; event.currentTarget.textContent = '♥'; setTimeout(() => { document.querySelector('#petBubble').textContent = '今天也要一起玩！'; }, 2300); saveState('小团子吃饱啦，心情 +10'); });
const moods = ['甜甜的', '想抱抱', '元气满满', '有一点想你'];
document.querySelector('#moodButton').addEventListener('click', () => { state.mood = moods[(moods.indexOf(state.mood) + 1) % moods.length]; saveState(`今天的心情更新成「${state.mood}」`); });
document.querySelectorAll('[data-task="true"]').forEach((task, index) => task.addEventListener('click', () => { state.tasks[index] = !state.tasks[index]; saveState(state.tasks[index] ? '打卡成功，今天也有好好相爱 ♥' : '已取消这次打卡'); }));

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.pageTarget)));
document.querySelector('#addButton').addEventListener('click', () => { const text = prompt('写一句今天想记录的话：', '今天也有好好想念 TA。'); if (!text?.trim()) return; state.records.unshift({ id: Date.now(), date: '刚刚', text: text.trim(), author: '你', tone: 'pink' }); saveState('已把这句话放进你们的时光里 ♥'); switchPage('timeline'); });
document.querySelector('#quickRecord').addEventListener('click', () => document.querySelector('#addButton').click());
document.querySelector('#addWish').addEventListener('click', () => { const input = document.querySelector('#wishInput'); const text = input.value.trim(); if (!text) { showToast('先写下一个小心愿吧'); input.focus(); return; } state.wishes.push({ id: Date.now(), text, done: false }); input.value = ''; saveState('心愿添加成功，一起实现它 ✨'); });

document.querySelector('#copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(document.querySelector('#inviteCode').textContent); showToast('邀请码已复制'); } catch { showToast('邀请码：' + document.querySelector('#inviteCode').textContent); } });
document.querySelector('#bindPartner').addEventListener('click', async () => {
  const code = document.querySelector('#partnerCode').value.trim().toUpperCase();
  if (!code) { showToast('请输入 TA 的邀请码'); return; }
  if (ONLINE_SYNC) {
    try {
      const response = await fetch('/api/room/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: 'TA', source: CLIENT_ID }) });
      if (!response.ok) throw new Error('invite code not found');
      const joined = await response.json();
      ROOM_ID = joined.room; localStorage.setItem('couple-house-room', ROOM_ID); state = { ...state, ...joined.state, bound: true, partnerName: 'TA', inviteCode: ROOM_ID }; closeModal(bindModal); saveState('绑定成功，你们的小屋连在一起了 ♥'); return;
    } catch { showToast('邀请码不存在，请确认 TA 发来的代码'); return; }
  }
  state.bound = true; state.partnerName = 'TA'; state.inviteCode = code; closeModal(bindModal); saveState('绑定成功，你们的小屋连在一起了 ♥');
});
document.querySelector('#resetDemo').addEventListener('click', () => { if (!confirm('确定要重置本地演示数据吗？')) return; state = clone(defaultState); localStorage.removeItem(STORAGE_KEY); saveState('演示数据已重置'); switchPage('home'); });

window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY || !event.newValue) return; state = JSON.parse(event.newValue); render(); showToast('另一端刚刚更新了你们的小屋'); });
channel?.addEventListener('message', event => { if (event.data?.type !== 'state:update') return; state = event.data.state; render(); showToast('另一端刚刚更新了你们的小屋'); });

render();

async function startRemoteSync() {
  if (!ROOM_ID) {
    const response = await fetch('/api/room/create', { method: 'POST' });
    const created = await response.json();
    ROOM_ID = created.room; state = { ...state, ...created.state, inviteCode: ROOM_ID };
    localStorage.setItem('couple-house-room', ROOM_ID); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render();
  } else {
    const remoteResponse = await fetch(`/api/state?room=${encodeURIComponent(ROOM_ID)}`);
    const remote = await remoteResponse.json();
    if (remote?.state) { state = { ...state, ...remote.state, inviteCode: ROOM_ID }; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
    else { const createdResponse = await fetch('/api/room/create', { method: 'POST' }); const created = await createdResponse.json(); ROOM_ID = created.room; state = { ...state, ...created.state, inviteCode: ROOM_ID }; localStorage.setItem('couple-house-room', ROOM_ID); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
  }
  const events = new EventSource(`/api/events?room=${encodeURIComponent(ROOM_ID)}`);
  events.onmessage = event => { try { const incoming = JSON.parse(event.data); if (incoming.source === CLIENT_ID || !incoming.state) return; state = { ...state, ...incoming.state }; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); showToast('另一台设备刚刚更新了你们的小屋'); } catch { /* ignore malformed events */ } };
}
if (ONLINE_SYNC) startRemoteSync().catch(() => showToast('云端暂时不可用，本地模式仍可继续使用'));
if (ONLINE_SYNC && 'serviceWorker' in navigator) navigator.serviceWorker.register(new URL('./sw.js', location.href)).catch(() => {});
