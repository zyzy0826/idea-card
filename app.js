const PROMPT_HEADER = '請依照 autobattler skill 的規則，幫我設計一個新機制。';
const STORAGE_KEY = 'idea-card:current';
const RARITIES = [
  { value: '★', label: '★ 普通' },
  { value: '★★', label: '★★ 稀有' },
  { value: '★★★', label: '★★★ 傳說' },
];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLIP_MS = reducedMotion ? 0 : 600;
const CHARGE_MS = reducedMotion ? 0 : 500;

const state = {
  cards: [],
  school: 'all',
  rarity: 'all',
  current: null,
  selected: null,
  busy: false,
};

const $ = (sel) => document.querySelector(sel);
const cardEl = $('#card');
const cardFront = $('#card-front');
const drawBtn = $('#draw-btn');
const decideBtn = $('#decide-btn');
const dialog = $('#decide-dialog');
const extraInput = $('#extra');
const preview = $('#preview');
const manualHint = $('#manual-hint');

init();

async function init() {
  try {
    const res = await fetch('cards.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.cards = await res.json();
  } catch (err) {
    showLoadError(err);
    return;
  }

  buildFilters();
  buildGallery();
  bindEvents();
  restoreCurrent();
  updatePoolCount();
}

/* ---------- 工具 ---------- */

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content);
  else if (content != null) node.textContent = content;
  return node;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rarityClass(card) {
  const level = Math.min(Math.max(card.rarity.length, 1), 3);
  return `r${level}`;
}

function storageGet() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function storageSet(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* 無痕模式等情況，忽略 */ }
}

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

function showLoadError(err) {
  const box = $('#load-error');
  $('#view-draw').hidden = true;
  box.hidden = false;
  if (location.protocol === 'file:') {
    box.innerHTML = `
      <h2>讀不到卡片資料 😢</h2>
      <p>直接雙擊開啟 HTML 時，瀏覽器會擋住 <code>fetch('cards.json')</code>。</p>
      <p>請在專案資料夾執行 <code>python -m http.server 8000</code>，再打開
      <code>http://localhost:8000</code>。詳細說明請看 README。</p>`;
  } else {
    box.innerHTML = '<h2>讀不到卡片資料 😢</h2><p>請檢查 <code>cards.json</code> 是否存在、格式是否正確。</p>';
    box.append(el('p', null, `錯誤訊息：${err.message}`));
  }
}

/* ---------- 篩選 ---------- */

function buildFilters() {
  const schools = [...new Set(state.cards.map((c) => c.school))];
  renderChips($('#school-chips'), [{ value: 'all', label: '全部' }, ...schools.map((s) => ({ value: s, label: s }))], 'school');
  renderChips($('#rarity-chips'), [{ value: 'all', label: '全部' }, ...RARITIES], 'rarity');
}

function renderChips(container, options, key) {
  container.replaceChildren(...options.map((opt) => {
    const chip = el('button', 'chip', opt.label);
    chip.type = 'button';
    chip.dataset.value = opt.value;
    chip.classList.toggle('active', opt.value === state[key]);
    chip.addEventListener('click', () => {
      state[key] = opt.value;
      container.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
      updatePoolCount();
    });
    return chip;
  }));
}

function filteredPool() {
  return state.cards.filter((c) =>
    (state.school === 'all' || c.school === state.school) &&
    (state.rarity === 'all' || c.rarity === state.rarity));
}

function updatePoolCount() {
  const count = filteredPool().length;
  $('#pool-count').textContent = count ? `卡池：${count} 張` : '沒有符合條件的卡片，換個篩選試試';
  drawBtn.disabled = state.busy || count === 0;
}

/* ---------- 抽卡 ---------- */

function fillFront(card) {
  cardEl.classList.remove('r1', 'r2', 'r3');
  cardEl.classList.add(rarityClass(card));
  cardFront.replaceChildren(
    el('div', 'card-top', [el('span', 'card-school', card.school), el('span', 'card-stars', card.rarity)]),
    el('div', 'card-emoji', card.emoji),
    el('h3', 'card-name', card.name),
    el('p', 'card-desc', card.description),
    el('p', 'card-hint', `💡 ${card.hint}`),
  );
}

function setCurrent(card) {
  state.current = card;
  storageSet(card.id);
  decideBtn.hidden = false;
  drawBtn.textContent = '再抽一張';
}

function restoreCurrent() {
  const id = storageGet();
  const card = id && state.cards.find((c) => c.id === id);
  if (!card) return;
  cardEl.classList.add('no-anim');
  fillFront(card);
  cardEl.classList.add('flipped');
  void cardEl.offsetWidth; // 強制套用，避免觸發翻牌動畫
  cardEl.classList.remove('no-anim');
  setCurrent(card);
}

function pickCard() {
  const pool = filteredPool();
  // 卡池大於 1 張時，避免連續抽到同一張
  const candidates = pool.length > 1 && state.current
    ? pool.filter((c) => c.id !== state.current.id)
    : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function draw() {
  if (state.busy) return;
  const card = pickCard();
  if (!card) return;

  state.busy = true;
  drawBtn.disabled = true;
  decideBtn.hidden = true;

  if (cardEl.classList.contains('flipped')) {
    cardEl.classList.remove('flipped');
    await wait(FLIP_MS);
  }

  cardEl.classList.add('charging');
  await wait(CHARGE_MS);
  cardEl.classList.remove('charging');

  fillFront(card);
  cardEl.classList.add('flipped');
  await wait(FLIP_MS / 2);
  playFlash(card);
  await wait(FLIP_MS / 2);

  setCurrent(card);
  state.busy = false;
  updatePoolCount();
}

function playFlash(card) {
  const level = rarityClass(card);
  if (level === 'r1') return;
  const flash = $('#flash');
  flash.style.setProperty('--flash-color', level === 'r3' ? 'rgba(255, 210, 100, 0.9)' : 'rgba(110, 170, 255, 0.8)');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
}

/* ---------- 圖鑑 ---------- */

function buildGallery() {
  const schools = [...new Set(state.cards.map((c) => c.school))];
  $('#gallery').replaceChildren(...schools.map((school) => {
    const cards = state.cards
      .filter((c) => c.school === school)
      .sort((a, b) => a.rarity.length - b.rarity.length);
    const grid = el('div', 'gallery-grid', cards.map((card) => {
      const mini = el('button', `mini ${rarityClass(card)}`, [
        el('span', 'mini-emoji', card.emoji),
        el('span', 'mini-name', card.name),
        el('span', 'mini-stars', card.rarity),
      ]);
      mini.type = 'button';
      mini.title = card.description;
      mini.addEventListener('click', () => openDecide(card));
      return mini;
    }));
    return el('div', 'gallery-group', [el('h2', null, `${school} 流派`), grid]);
  }));
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $('#view-draw').hidden = name !== 'draw';
  $('#view-gallery').hidden = name !== 'gallery';
}

/* ---------- 就決定是它了 ---------- */

function buildPrompt(card, extra) {
  const parts = [PROMPT_HEADER, `【機制】${card.name}（${card.school} 流派）\n${card.prompt}`];
  const note = extra.trim();
  if (note) parts.push(`【我的想法】\n${note}`);
  return parts.join('\n\n');
}

function updatePreview() {
  preview.value = buildPrompt(state.selected, extraInput.value);
}

function openDecide(card) {
  state.selected = card;
  $('#dialog-title').textContent = `${card.emoji} ${card.name}（${card.school}・${card.rarity}）`;
  extraInput.value = '';
  manualHint.hidden = true;
  updatePreview();
  dialog.showModal();
}

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* 改用舊方法 */ }
  }
  try {
    const ta = el('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    dialog.append(ta); // 放在 dialog 裡，modal 開啟時外面的元素無法被選取
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

async function copyPrompt() {
  const text = preview.value;
  if (await writeClipboard(text)) {
    dialog.close();
    toast('已複製！快貼給 Agent 吧 🚀');
    return;
  }
  manualHint.hidden = false;
  preview.focus();
  preview.select();
  preview.setSelectionRange(0, text.length);
}

/* ---------- 事件 ---------- */

function bindEvents() {
  drawBtn.addEventListener('click', draw);
  decideBtn.addEventListener('click', () => state.current && openDecide(state.current));
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  extraInput.addEventListener('input', () => {
    manualHint.hidden = true;
    updatePreview();
  });
  $('#copy-btn').addEventListener('click', copyPrompt);
  $('#cancel-btn').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // 點背景關閉
  });
}
