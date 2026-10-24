const STORAGE_KEY = 'couple-house-state-v1';
const CHANNEL_NAME = 'couple-house-live';
const ONLINE_SYNC = location.protocol !== 'file:';
let ROOM_ID = localStorage.getItem('couple-house-room') || '';
const CLIENT_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const defaultState = {
  theme: 'pink', mood: '甜甜的', bound: false, partnerName: '', inviteCode: 'LUV-6281',
  tasks: [true, false, false],
  records: [{ id: 1, date: '今天 · 10:24', text: '一起把小屋的窗帘换成了喜欢的颜色。', author: '你们', tone: 'pink' }],
  wishes: [{ id: 1, text: '一起去看海', done: false }, { id: 2, text: '养一只真正的小猫', done: false }],
  pet: { name: '小团子', level: 1, xp: 30, coins: 18, mood: '好奇', outfit: 'default', unlocked: ['default'], lastChat: '我会陪你们把每一个小任务都变成回忆。' },
  games: {
    wins: 0,
    drawing: { status: 'idle', answer: '', image: '', guess: '', result: '', drawer: '', round: 0 },
    question: { index: 0, answer: '' }
  }
};

const clone = value => JSON.parse(JSON.stringify(value));
function normalizeState(value = {}) {
  const merged = { ...clone(defaultState), ...value };
  merged.tasks = Array.isArray(value.tasks) ? value.tasks : clone(defaultState.tasks);
  merged.records = Array.isArray(value.records) ? value.records : clone(defaultState.records);
  merged.wishes = Array.isArray(value.wishes) ? value.wishes : clone(defaultState.wishes);
  merged.pet = { ...clone(defaultState.pet), ...(value.pet || {}) };
  merged.pet.unlocked = Array.isArray(value.pet?.unlocked) ? value.pet.unlocked : ['default'];
  merged.games = { ...clone(defaultState.games), ...(value.games || {}) };
  merged.games.drawing = { ...clone(defaultState.games.drawing), ...(value.games?.drawing || {}) };
  merged.games.question = { ...clone(defaultState.games.question), ...(value.games?.question || {}) };
  return merged;
}
let state;
try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { state = clone(defaultState); }
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
  renderPet();
  renderGames();
  document.querySelector('#inviteCode').textContent = state.inviteCode || 'LUV-6281';
  const boundText = state.bound ? `已和 ${state.partnerName || 'TA'} 连接` : '还没有绑定另一半';
  document.querySelector('#bindingStatus').innerHTML = `<span class="binding-dot ${state.bound ? 'connected' : ''}"></span>${boundText}`;
}

const outfits = [
  { id: 'default', name: '原本的软乎乎', icon: '♡', cost: 0 },
  { id: 'rainbow', name: '彩虹围巾', icon: '🌈', cost: 25 },
  { id: 'date', name: '约会小西装', icon: '🎀', cost: 60 },
  { id: 'pajamas', name: '晚安睡衣', icon: '🌙', cost: 110 }
];
const drawingWords = ['奶茶', '小猫', '看电影', '拥抱', '旅行', '烟花', '冰淇淋', '一起做饭'];
const chatReplies = {
  '今天谁更想 TA？': ['我偷偷看了一下，今天是你更想 TA 一点点。', '答案是：你们都在想对方，平局！'],
  '给我们一句鼓励': ['把今天过好，就是你们正在写的情书。', '慢慢来，喜欢的人值得每一个认真对待的日子。'],
  '夸夸我的新衣服': ['这套衣服和你一样可爱，适合出门收集拥抱。', '今天的小团子闪闪发光，TA 一定会喜欢。']
};

function applyPetReward(xp, coins) {
  const pet = state.pet;
  pet.xp += xp;
  pet.coins += coins;
  pet.level = Math.min(9, Math.floor(pet.xp / 40) + 1);
  const newlyUnlocked = outfits.filter(outfit => pet.coins >= outfit.cost && !pet.unlocked.includes(outfit.id)).map(outfit => {
    pet.unlocked.push(outfit.id);
    return outfit.name;
  });
  return newlyUnlocked;
}

function renderPet() {
  const pet = state.pet;
  const outfit = outfits.find(item => item.id === pet.outfit) || outfits[0];
  const progress = Math.min(100, Math.round((pet.xp % 40) / 40 * 100));
  document.querySelector('#petLevel').textContent = `Lv.${pet.level}`;
  document.querySelector('#petCoins').textContent = `♡ ${pet.coins}`;
  document.querySelector('#petXpBar').style.width = `${progress || 4}%`;
  document.querySelector('#petBubble').textContent = pet.lastChat || '今天也要一起玩！';
  document.querySelector('#petOutfit').textContent = outfit.icon;
  document.querySelector('#petOutfitLabel').textContent = outfit.name;
  document.querySelector('#petChatText').textContent = pet.lastChat || '我会陪你们把每一个小任务都变成回忆。';
  const outfitList = document.querySelector('#outfitList');
  outfitList.innerHTML = outfits.map(item => {
    const unlocked = pet.unlocked.includes(item.id);
    return `<button class="outfit-option ${item.id === pet.outfit ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-outfit="${item.id}" ${unlocked ? '' : 'disabled'}><span>${item.icon}</span><small>${unlocked ? item.name : `完成任务解锁 · ${item.cost}♡`}</small></button>`;
  }).join('');
  outfitList.querySelectorAll('.outfit-option:not(:disabled)').forEach(button => button.addEventListener('click', () => {
    state.pet.outfit = button.dataset.outfit;
    outfitList.hidden = false;
    saveState(`小团子换上了${outfits.find(item => item.id === state.pet.outfit).name} ✨`);
  }));
}

function renderGames() {
  const drawing = state.games.drawing;
  const canvas = document.querySelector('#drawCanvas');
  const image = document.querySelector('#drawImage');
  const isDrawer = drawing.drawer === CLIENT_ID;
  document.querySelector('#gameWins').textContent = state.games.wins;
  document.querySelector('#drawStatus').textContent = drawing.status === 'idle' ? '还没有开始' : drawing.status === 'drawing' ? '画画中' : drawing.status === 'guessing' ? '轮到猜啦' : '本局结束';
  document.querySelector('#drawPrompt').textContent = drawing.status === 'idle' ? '点击开始，随机抽一个只有画画的人能看到的词。' : isDrawer ? `你的词是「${drawing.answer}」，画好后提交给 TA。` : drawing.status === 'guessing' ? 'TA 已经提交画作，猜猜看画的是什么？' : drawing.result;
  document.querySelector('#guessRow').hidden = drawing.status !== 'guessing' || isDrawer;
  document.querySelector('#submitDrawing').disabled = !isDrawer || drawing.status !== 'drawing';
  document.querySelector('#clearCanvas').disabled = !isDrawer || drawing.status !== 'drawing';
  canvas.hidden = !isDrawer && drawing.status !== 'drawing';
  image.hidden = !(!isDrawer && drawing.status === 'guessing') || !drawing.image;
  if (drawing.image && image.src !== drawing.image) image.src = drawing.image;
  document.querySelector('#drawResult').textContent = drawing.result || '';
}

function showPetChat(promptText) {
  const replies = chatReplies[promptText] || ['我会一直陪着你们。'];
  state.pet.lastChat = replies[Math.floor(Math.random() * replies.length)];
  document.querySelector('#petChat').hidden = false;
  saveState('小团子回复你啦');
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

document.querySelector('#feedButton').addEventListener('click', event => { state.pet.lastChat = '好满足呀，谢谢你！'; event.currentTarget.textContent = '♥'; setTimeout(() => { state.pet.lastChat = '今天也要一起玩！'; renderPet(); }, 2300); saveState('小团子吃饱啦，心情 +10'); });
const moods = ['甜甜的', '想抱抱', '元气满满', '有一点想你'];
document.querySelector('#moodButton').addEventListener('click', () => { state.mood = moods[(moods.indexOf(state.mood) + 1) % moods.length]; saveState(`今天的心情更新成「${state.mood}」`); });
document.querySelectorAll('[data-task="true"]').forEach((task, index) => task.addEventListener('click', () => {
  state.tasks[index] = !state.tasks[index];
  if (state.tasks[index]) {
    const unlocked = applyPetReward(10, 8);
    saveState(unlocked.length ? `打卡成功，小团子解锁了${unlocked.join('、')} ✨` : '打卡成功，获得小团子成长奖励 ♥');
  } else saveState('已取消这次打卡');
}));

document.querySelector('#petChatButton').addEventListener('click', () => { document.querySelector('#petChat').hidden = !document.querySelector('#petChat').hidden; document.querySelector('#outfitList').hidden = true; });
document.querySelector('#outfitButton').addEventListener('click', () => { document.querySelector('#outfitList').hidden = !document.querySelector('#outfitList').hidden; document.querySelector('#petChat').hidden = true; });
document.querySelectorAll('[data-pet-chat]').forEach(button => button.addEventListener('click', () => showPetChat(button.dataset.petChat)));
document.querySelector('#openGamesButton').addEventListener('click', () => switchPage('games'));

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

const canvas = document.querySelector('#drawCanvas');
const context = canvas.getContext('2d');
let drawing = false;
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}
function startDrawing(event) { if (state.games.drawing.status !== 'drawing' || state.games.drawing.drawer !== CLIENT_ID) return; drawing = true; const point = canvasPoint(event); context.beginPath(); context.moveTo(point.x, point.y); }
function draw(event) { if (!drawing) return; const point = canvasPoint(event); context.lineTo(point.x, point.y); context.stroke(); }
function stopDrawing() { drawing = false; }
canvas.addEventListener('pointerdown', startDrawing); canvas.addEventListener('pointermove', draw); canvas.addEventListener('pointerup', stopDrawing); canvas.addEventListener('pointerleave', stopDrawing);
function clearCanvas() { context.clearRect(0, 0, canvas.width, canvas.height); }
function prepareCanvas() { context.clearRect(0, 0, canvas.width, canvas.height); context.lineWidth = 7; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#d77e78'; }
prepareCanvas();
document.querySelector('#startGame').addEventListener('click', () => {
  prepareCanvas();
  state.games.drawing = { status: 'drawing', answer: drawingWords[Math.floor(Math.random() * drawingWords.length)], image: '', guess: '', result: '', drawer: CLIENT_ID, round: state.games.drawing.round + 1 };
  saveState('新的一局开始啦，把词画给 TA 看吧 ✎');
});
document.querySelector('#clearCanvas').addEventListener('click', clearCanvas);
document.querySelector('#submitDrawing').addEventListener('click', () => {
  if (state.games.drawing.status !== 'drawing' || state.games.drawing.drawer !== CLIENT_ID) return;
  state.games.drawing.image = canvas.toDataURL('image/jpeg', .72); state.games.drawing.status = 'guessing'; state.games.drawing.result = '画作已经同步给 TA，等 TA 猜答案。'; saveState('画作发给 TA 啦');
});
document.querySelector('#submitGuess').addEventListener('click', () => {
  const input = document.querySelector('#guessInput'); const guess = input.value.trim();
  if (!guess) { showToast('先写下你的答案吧'); input.focus(); return; }
  state.games.drawing.guess = guess;
  if (guess.includes(state.games.drawing.answer) || state.games.drawing.answer.includes(guess)) {
    state.games.drawing.status = 'result'; state.games.drawing.result = `猜对啦！答案是「${state.games.drawing.answer}」，小团子奖励你们 +15 XP、+12♡。`;
    state.games.wins += 1; const unlocked = applyPetReward(15, 12); if (unlocked.length) state.games.drawing.result += ` 解锁了${unlocked.join('、')}！`;
    saveState('默契挑战成功，情侣经验值上涨 ✨');
  } else { state.games.drawing.result = '差一点，再猜猜看？'; saveState('再猜一次，你们一定可以'); }
});
document.querySelectorAll('.question-options button').forEach(button => button.addEventListener('click', () => {
  state.games.question.answer = button.dataset.answer;
  state.pet.lastChat = `我选了「${button.textContent}」，等 TA 看看是不是一样。`;
  document.querySelector('#questionResult').textContent = `你选择了「${button.textContent}」，答案已同步给 TA。`;
  saveState('每日默契答案已记录');
}));

window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY || !event.newValue) return; state = normalizeState(JSON.parse(event.newValue)); render(); showToast('另一端刚刚更新了你们的小屋'); });
channel?.addEventListener('message', event => { if (event.data?.type !== 'state:update') return; state = normalizeState(event.data.state); render(); showToast('另一端刚刚更新了你们的小屋'); });

render();

async function startRemoteSync() {
  if (!ROOM_ID) {
    const response = await fetch('/api/room/create', { method: 'POST' });
    const created = await response.json();
    ROOM_ID = created.room; state = normalizeState({ ...state, ...created.state, inviteCode: ROOM_ID });
    localStorage.setItem('couple-house-room', ROOM_ID); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render();
  } else {
    const remoteResponse = await fetch(`/api/state?room=${encodeURIComponent(ROOM_ID)}`);
    const remote = await remoteResponse.json();
    if (remote?.state) { state = normalizeState({ ...state, ...remote.state, inviteCode: ROOM_ID }); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
    else { const createdResponse = await fetch('/api/room/create', { method: 'POST' }); const created = await createdResponse.json(); ROOM_ID = created.room; state = normalizeState({ ...state, ...created.state, inviteCode: ROOM_ID }); localStorage.setItem('couple-house-room', ROOM_ID); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
  }
  const events = new EventSource(`/api/events?room=${encodeURIComponent(ROOM_ID)}`);
  events.onmessage = event => { try { const incoming = JSON.parse(event.data); if (incoming.source === CLIENT_ID || !incoming.state) return; state = normalizeState({ ...state, ...incoming.state }); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); showToast('另一台设备刚刚更新了你们的小屋'); } catch { /* ignore malformed events */ } };
}
if (ONLINE_SYNC) startRemoteSync().catch(() => showToast('云端暂时不可用，本地模式仍可继续使用'));
if (ONLINE_SYNC && 'serviceWorker' in navigator) navigator.serviceWorker.register(new URL('./sw.js', location.href)).catch(() => {});
