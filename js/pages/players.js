// ============================================================
//  PLAYERS.JS
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  renderPlayerSlots();
  restoreEvening();
  bindEvents();
});

// ── Константы ──────────────────────────────────────────────
const MAIN_SLOTS  = 15;

let gameCount = 4;
let seatings  = []; // seatings[0] — исходный (не показывается во вкладках)
                    // seatings[1..N] — игры 1..N

// ── Дата ───────────────────────────────────────────────────
function initDate() {
  const el = document.getElementById('eveningDate');
  if (el) el.textContent = new Date().toLocaleDateString('ru', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Слоты игроков ──────────────────────────────────────────
function renderPlayerSlots() {
  const saved = JSON.parse(localStorage.getItem('players') || '[]');

  const mainList = document.getElementById('playerList');
  mainList.innerHTML = '';
  for (let i = 0; i < MAIN_SLOTS; i++) {
    mainList.appendChild(createSlot(i, saved[i] || ''));
  }

  updatePlayerCount();
}

function createSlot(index, value) {
  const row = document.createElement('div');
  row.className = 'player-slot';
  row.innerHTML = `
    <span class="slot-number">${index + 1}</span>
    <input
      type="text"
      class="player-input"
      data-index="${index}"
      value="${escapeHtml(value)}"
      placeholder="Имя игрока"
    />
    <button class="btn-icon clear-slot" data-index="${index}" title="Очистить">✕</button>
  `;
  return row;
}

function updatePlayerCount() {
  const filled = getFilledNames().length;
  const el = document.getElementById('playerCount');
  if (el) el.textContent = `${filled} игроков`;
}

function getAllNames() {
  return [...document.querySelectorAll('.player-input')]
    .map(i => i.value.trim());
}

function getFilledNames() {
  return getAllNames().filter(Boolean);
}

// ── Счётчик игр ────────────────────────────────────────────
function updateCounterUI() {
  document.getElementById('gameCount').textContent = gameCount;
}

// ── Восстановить сохранённый вечер ─────────────────────────
function restoreEvening() {
  const data = JSON.parse(localStorage.getItem('evening') || 'null');
  if (!data) return;

  const titleEl = document.getElementById('eveningTitle');
  if (titleEl && data.title) titleEl.value = data.title;

  if (data.gameCount) {
    gameCount = data.gameCount;
    updateCounterUI();
  }

  if (data.seatings && data.seatings.length) {
    seatings = data.seatings;
    renderTabs();
  }
}

// ── Генерация рассадок ─────────────────────────────────────
function generateSeatings() {
  const names = getFilledNames();
  if (names.length < 4) {
    showToast('Нужно минимум 4 игрока!', 'error');
    return;
  }

  // seatings[0] — исходный порядок (служебный, не отображается как вкладка)
  seatings = [names];

  for (let g = 1; g <= gameCount; g++) {
    const prev = seatings[g - 1];
    seatings.push(shuffle(prev, prev));
  }

  renderTabs();
  document.getElementById('tabsWrapper').hidden = false;
  showToast(`Сгенерировано ${gameCount} рассадок ✅`);
}

// ── Перемешивание ──────────────────────────────────────────
function shuffle(names, prev) {
  const n = names.length;
  const minShift = Math.max(2, Math.floor(n / 3));
  const MAX_ATTEMPTS = 200;

  let best = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = fisherYates([...names]);
    const score = evalCandidate(candidate, names, prev, minShift);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
    if (score === n) break;
  }

  return best;
}

function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function evalCandidate(candidate, original, prev, minShift) {
  const n = candidate.length;
  let score = 0;

  for (let i = 0; i < n; i++) {
    const origPos = original.indexOf(candidate[i]);
    if (Math.abs(i - origPos) >= minShift) score += 1;
  }

  const prevPairs = new Set();
  for (let i = 0; i < prev.length; i++) {
    prevPairs.add(`${prev[i]}→${prev[(i + 1) % prev.length]}`);
  }
  for (let i = 0; i < n; i++) {
    const pair = `${candidate[i]}→${candidate[(i + 1) % n]}`;
    if (prevPairs.has(pair)) score -= 0.5;
  }

  return score;
}

// ── Вкладки ────────────────────────────────────────────────
// Показываем только игры 1..N (вкладка 0 — исходный — скрыта)
function renderTabs() {
  const nav  = document.getElementById('tabsNav');
  const body = document.getElementById('tabsBody');
  nav.innerHTML  = '';
  body.innerHTML = '';

  // Начинаем с idx=1, первая вкладка сразу активна
  for (let idx = 1; idx < seatings.length; idx++) {
    const isFirst = idx === 1;

    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (isFirst ? ' active' : '');
    btn.textContent = `Игра ${idx}`;
    btn.dataset.tab = idx;
    nav.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'tab-panel' + (isFirst ? ' active' : '');
    panel.dataset.tab = idx;
    // Нумерация в каждом списке своя — от 1, по порядку слота
    panel.appendChild(buildSeatingList(seatings[idx]));
    body.appendChild(panel);
  }

  document.getElementById('tabsWrapper').hidden = false;
}

// Строим список: нумерация = порядковый номер слота (1, 2, 3...)
// Без пометки «сдвиг»
function buildSeatingList(seating) {
  const list = document.createElement('div');
  list.className = 'seating-list';

  seating.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'seating-row';
    row.innerHTML = `
      <span class="seat-num">${i + 1}</span>
      <span class="seat-name">${escapeHtml(name)}</span>
    `;
    list.appendChild(row);
  });

  return list;
}

// ── Сохранить в .txt ───────────────────────────────────────
// Нумерация в файле: для каждой игры своя, с 1
// Номера игрокам присваиваются здесь, а не в интерфейсе
function saveToFile() {
  if (!seatings.length) {
    showToast('Сначала сгенерируйте рассадки', 'error');
    return;
  }

  const title = document.getElementById('eveningTitle').value.trim() || 'Мафия';
  const date  = document.getElementById('eveningDate').textContent;
  let text    = `${title} — ${date}\n${'='.repeat(40)}\n\n`;

  // Пишем только игры 1..N, без исходного списка (idx=0)
  for (let idx = 1; idx < seatings.length; idx++) {
    text += `Игра ${idx}:\n`;
    seatings[idx].forEach((name, i) => {
      // Нумерация для каждого списка своя: 1, 2, 3...
      text += `  ${i + 1}. ${name}\n`;
    });
    text += '\n';
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${title}_${date}.txt`.replace(/\s/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}

function saveEvening() {
  const title = document.getElementById('eveningTitle').value.trim()
             || 'Игровой вечер';
  const date  = document.getElementById('eveningDate').textContent.trim();
  const names = getAllNames();

  if (!names.length) {
    showToast('Добавьте игроков!', 'error');
    return;
  }

  localStorage.setItem('players', JSON.stringify(names));
  localStorage.setItem('evening', JSON.stringify({
    title,
    gameCount,
    seatings,
    date,
  }));

  // ── Загружаем существующие результаты чтобы НЕ перетереть ──
  const existingResults = JSON.parse(
    localStorage.getItem('eveningResults') || 'null'
  );

  // Формируем игры — только те, которых ещё НЕТ в existingResults
  const games = existingResults?.games || {};

  for (let i = 1; i <= gameCount; i++) {
    // ✅ Если игра уже сохранена (finished) — не трогаем её!
    if (games[i]?.finished) continue;

    // ✅ ИСПРАВЛЕНО: seatings[i], а не seatings[i-1]
    const seating = seatings[i]
      ? [...seatings[i]]
      : getFilledNames();

    games[i] = {
      gameNum:  i,
      winner:   null,
      finished: false,
      seating,
      players: seating.map((name, idx) => ({
        seat:  idx + 1,
        name,
        role:  '',
        team:  '',
        won:   null,
        base:  0,
        extra: 0,
        total: 0,
        fouls: 0,
      })),
    };
  }

  localStorage.setItem('eveningResults', JSON.stringify({
    title,
    date,
    games,
    createdAt: existingResults?.createdAt || Date.now(),
  }));

  showToast('Вечер сохранён ✅', 'success');
}

// ── Вставить из буфера обмена ──────────────────────────────
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast('Буфер обмена пуст', 'error');
      return;
    }
    const names = parseNames(text);
    if (!names.length) {
      showToast('Не удалось распознать имена', 'error');
      return;
    }
    fillSlots(names);
    showToast(`Вставлено ${names.length} игроков`, 'success');
  } catch (e) {
    showToast('Нет доступа к буферу обмена', 'error');
  }
}

function parseNames(text) {
  return text
    .split('\n')
    .map(line => line
      // Убираем нумерацию в любом формате:
      // "1. " "1) " "1: " "№1 " "#1 " "1 " — в начале строки
      .replace(/^\s*[№#]?\d+\s*[.):>\-–—]?\s*/, '')  // ← добавили ? после [...] — символ теперь необязателен
      // Убираем маркеры списков: - • – — * в начале
      .replace(/^\s*[-•–—*]\s*/, '')
      .trim()
    )
    .filter(line => line.length > 0 && line.length < 60);
}

function fillSlots(names) {
  const inputs = [...document.querySelectorAll('.player-input')];

   inputs.forEach((input, i) => {
    input.value = names[i] || '';
  });

  updatePlayerCount();
}

// ── Очистить все слоты ─────────────────────────────────────
function clearAllSlots() {
  document.querySelectorAll('.player-input').forEach(input => {
    input.value = '';
  });
  updatePlayerCount();
}

// ── Переключение вкладок ───────────────────────────────────
function switchTab(tabIndex) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.tab === tabIndex);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', +panel.dataset.tab === tabIndex);
  });
}

// ── Тосты ──────────────────────────────────────────────────
function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

// ── Утилиты ────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Привязка событий ───────────────────────────────────────
function bindEvents() {

  document.getElementById('burgerBtn')
    .addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.add('visible');
    });

  document.getElementById('sidebarClose')
    .addEventListener('click', closeSidebar);

  document.getElementById('sidebarOverlay')
    .addEventListener('click', closeSidebar);

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  }

  document.addEventListener('input', e => {
    if (e.target.classList.contains('player-input')) {
      updatePlayerCount();
    }
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('clear-slot')) {
      const idx = +e.target.dataset.index;
      document.querySelector(`.player-input[data-index="${idx}"]`).value = '';
      updatePlayerCount();
    }
  });

  document.getElementById('btnPasteClipboard')
    .addEventListener('click', pasteFromClipboard);

  document.getElementById('btnClearAll')
    .addEventListener('click', clearAllSlots);

  document.getElementById('btnCountMinus')
    .addEventListener('click', () => {
      if (gameCount > 1) { gameCount--; updateCounterUI(); }
    });

  document.getElementById('btnCountPlus')
    .addEventListener('click', () => {
      if (gameCount < 10) { gameCount++; updateCounterUI(); }
    });

  document.getElementById('btnGenerate')
    .addEventListener('click', generateSeatings);

  document.getElementById('tabsNav')
    .addEventListener('click', e => {
      if (e.target.classList.contains('tab-btn')) {
        switchTab(+e.target.dataset.tab);
      }
    });

  document.getElementById('btnSaveFile')
    .addEventListener('click', saveToFile);

  document.getElementById('btnSaveEvening')?.addEventListener('click', () => {

  // ❌ Удалить эти две строки:
  // gameCount = 4;
  // updateCounterUI();

  // Удаляем результаты и состояние игры
  localStorage.removeItem('eveningResults');
  localStorage.removeItem('gameState');
  localStorage.removeItem('evening');

  // Очищаем список игроков на экране
  clearAllSlots();
  seatings = [];
  document.getElementById('tabsWrapper').hidden = true;

  showToast('Новый вечер начат ✅', 'success');
});

  document.getElementById('btnStartEvening')
    .addEventListener('click', () => {
      saveEvening();
      window.location.href = 'game.html';
    });
}