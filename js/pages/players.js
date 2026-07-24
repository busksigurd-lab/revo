// ============================================================
//  PLAYERS.JS  (новая версия)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  restoreEvening();
  bindEvents();
});

// ── Константы ──────────────────────────────────────────────
let players     = [];   // [{name, active}]
let activeCount = 10;   // сколько игроков в игре
let gameCount   = 4;
let seatings    = [];

// ── Дата ───────────────────────────────────────────────────
function initDate() {
  const el = document.getElementById('eveningDate');
  if (el) el.textContent = new Date().toLocaleDateString('ru', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ══════════════════════════════════════════════════════════
//  МОДЕЛЬ ДАННЫХ
// ══════════════════════════════════════════════════════════

// Синхронизирует activeCount с реальным количеством игроков:
// первые activeCount — активные, остальные — резерв
function syncActive() {
  players.forEach((p, i) => {
    p.active = i < activeCount;
  });
}

function getActivePlayers() {
  return players.filter(p => p.active).map(p => p.name);
}

// ══════════════════════════════════════════════════════════
//  РЕНДЕР СПИСКА
// ══════════════════════════════════════════════════════════

function renderPlayerList() {
  syncActive();

  const list = document.getElementById('playerList');
  list.innerHTML = '';

  players.forEach((player, index) => {
    const isReserve = index >= activeCount;
    const row = createPlayerRow(player, index, isReserve);
    list.appendChild(row);

    // Черта перед первым резервистом
    if (index === activeCount && players.length > activeCount) {
      list.insertBefore(createDivider(), row);
    }
  });

  updateActiveCounterUI();
}

function createPlayerRow(player, index, isReserve) {
  const row = document.createElement('div');
  row.className = 'player-slot' + (isReserve ? ' player-reserve' : '');
  row.dataset.index = index;
  row.draggable = true;

  row.innerHTML = `
    <span class="drag-handle-players">⠿</span>
    <span class="slot-number">${index + 1}</span>
    <input
      type="text"
      class="player-input"
      data-index="${index}"
      value="${escapeHtml(player.name)}"
      placeholder="Имя игрока"
    />
    <button class="btn-icon clear-slot" data-index="${index}" title="Удалить">✕</button>
  `;

  bindDragEvents(row);
  return row;
}

function createDivider() {
  const div = document.createElement('div');
  div.className = 'reserve-divider';
  div.id = 'reserveDivider';
  div.innerHTML = '<span>резерв</span>';
  return div;
}

function updateActiveCounterUI() {
  const el = document.getElementById('activeCount');
  if (el) el.textContent = activeCount;

  // Ограничения кнопок
  const btnMinus = document.getElementById('btnActiveMinus');
  const btnPlus  = document.getElementById('btnActivePlus');
  if (btnMinus) btnMinus.disabled = activeCount <= 1;
  if (btnPlus)  btnPlus.disabled  = activeCount >= players.length;
}

// ══════════════════════════════════════════════════════════
//  DRAG-AND-DROP
// ══════════════════════════════════════════════════════════

let dragIndex     = null;  // откуда тащим
let dragMode      = null;  // 'insert' | 'swap'
let lastTarget    = null;
let lastMode      = null;

function bindDragEvents(row) {
  row.addEventListener('dragstart', onDragStart);
  row.addEventListener('dragend',   onDragEnd);
  row.addEventListener('dragover',  onDragOver);
  row.addEventListener('dragleave', onDragLeave);
  row.addEventListener('drop',      onDrop);
}

function onDragStart(e) {
  dragIndex = +this.dataset.index;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';

  // Сохраняем текущие значения инпутов в модель перед перетаскиванием
  syncInputsToModel();
}

function onDragEnd() {
  dragIndex = null;
  dragMode  = null;
  lastTarget = null;
  lastMode   = null;
  clearDragStyles();
}

function onDragOver(e) {
  e.preventDefault();
  if (dragIndex === null) return;

  const targetIndex = +this.dataset.index;
  if (targetIndex === dragIndex) return;

  // Определяем режим по позиции курсора в строке
  const rect = this.getBoundingClientRect();
  const relY  = e.clientY - rect.top;
  const ratio = relY / rect.height;

  const mode = (ratio < 0.25 || ratio > 0.75) ? 'insert' : 'swap';

  // Перерисовываем только при изменении
  if (targetIndex !== lastTarget || mode !== lastMode) {
    clearDragStyles();
    lastTarget = targetIndex;
    lastMode   = mode;
    dragMode   = mode;

    if (mode === 'swap') {
      this.classList.add('drag-swap-target');
    } else {
      // Показываем линию: сверху или снизу строки
      if (ratio < 0.5) {
        this.classList.add('drag-insert-before');
      } else {
        this.classList.add('drag-insert-after');
      }
    }
  }

  e.dataTransfer.dropEffect = 'move';
}

function onDragLeave(e) {
  // Проверяем, что мышь действительно ушла из строки
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-swap-target', 'drag-insert-before', 'drag-insert-after');
  }
}

function onDrop(e) {
  e.preventDefault();
  if (dragIndex === null) return;

  const targetIndex = +this.dataset.index;
  if (targetIndex === dragIndex) { clearDragStyles(); return; }

  const rect  = this.getBoundingClientRect();
  const relY  = e.clientY - rect.top;
  const ratio = relY / rect.height;
  const mode  = (ratio < 0.25 || ratio > 0.75) ? 'insert' : 'swap';

  if (mode === 'swap') {
    // Меняем местами
    [players[dragIndex], players[targetIndex]] =
    [players[targetIndex], players[dragIndex]];
  } else {
    // Вставляем: убираем из старой позиции, вставляем на новую
    const [moved] = players.splice(dragIndex, 1);
    let insertAt = targetIndex;
    if (dragIndex < targetIndex) insertAt = targetIndex; // уже скорректировано splice
    // Если вставляем после — insertAt+1, если перед — insertAt
    const insertAfter = ratio >= 0.5;
    const finalIndex  = dragIndex < targetIndex
      ? (insertAfter ? targetIndex : targetIndex)
      : (insertAfter ? targetIndex + 1 : targetIndex);
    players.splice(finalIndex, 0, moved);
  }

  clearDragStyles();
  renderPlayerList();
}

function clearDragStyles() {
  document.querySelectorAll('.player-slot').forEach(row => {
    row.classList.remove(
      'dragging',
      'drag-swap-target',
      'drag-insert-before',
      'drag-insert-after'
    );
  });
}

// ══════════════════════════════════════════════════════════
//  СИНХРОНИЗАЦИЯ ИНПУТОВ ↔ МОДЕЛЬ
// ══════════════════════════════════════════════════════════

function syncInputsToModel() {
  document.querySelectorAll('.player-input').forEach(input => {
    const idx = +input.dataset.index;
    if (players[idx] !== undefined) {
      players[idx].name = input.value.trim();
    }
  });
}

// ══════════════════════════════════════════════════════════
//  СЧЁТЧИК АКТИВНЫХ ИГРОКОВ
// ══════════════════════════════════════════════════════════

function changeActiveCount(delta) {
  syncInputsToModel();
  const newCount = activeCount + delta;
  if (newCount < 1 || newCount > players.length) return;
  activeCount = newCount;
  renderPlayerList();
}

// ══════════════════════════════════════════════════════════
//  ДОБАВИТЬ / УДАЛИТЬ ИГРОКА
// ══════════════════════════════════════════════════════════

function addPlayer() {
  syncInputsToModel();
  players.push({ name: '', active: false });
  // Новый игрок идёт в резерв — activeCount не меняем
  renderPlayerList();

  // Фокус на новый инпут
  setTimeout(() => {
    const inputs = document.querySelectorAll('.player-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function removePlayer(index) {
  syncInputsToModel();
  players.splice(index, 1);

  // Корректируем счётчик если удалили активного
  if (activeCount > players.length) {
    activeCount = Math.max(1, players.length);
  }

  renderPlayerList();
}

// ══════════════════════════════════════════════════════════
//  ВСТАВКА ИЗ БУФЕРА
// ══════════════════════════════════════════════════════════

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) { showToast('Буфер обмена пуст', 'error'); return; }

    const names = parseNames(text);
    if (!names.length) { showToast('Не удалось распознать имена', 'error'); return; }

    players = names.map(name => ({ name, active: true }));

    // Счётчик = ровно столько, сколько пришло из буфера
    activeCount = players.length;

    renderPlayerList();
    showToast(`Вставлено ${names.length} игроков`, 'success');
  } catch (e) {
    showToast('Нет доступа к буферу обмена', 'error');
  }
}

function parseNames(text) {
  return text
    .split('\n')
    .map(line => line
      .replace(/^\s*[№#]?\d+\s*[.):>\-–—]?\s*/, '')
      .replace(/^\s*[-•–—*]\s*/, '')
      .trim()
    )
    .filter(line => line.length > 0 && line.length < 60);
}

// ══════════════════════════════════════════════════════════
//  ОЧИСТИТЬ
// ══════════════════════════════════════════════════════════

function clearAllSlots() {
  players     = [];
  activeCount = 10;
  renderPlayerList();
}

// ══════════════════════════════════════════════════════════
//  СЧЁТЧИК ИГР
// ══════════════════════════════════════════════════════════

function updateCounterUI() {
  document.getElementById('gameCount').textContent = gameCount;
}

// ══════════════════════════════════════════════════════════
//  ГЕНЕРАЦИЯ РАССАДОК
// ══════════════════════════════════════════════════════════

function generateSeatings() {
  syncInputsToModel();
  const names = getActivePlayers().filter(Boolean);

  if (names.length < 4) {
    showToast('Нужно минимум 4 активных игрока!', 'error');
    return;
  }

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
  let best = null, bestScore = -1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = fisherYates([...names]);
    const score = evalCandidate(candidate, names, prev, minShift);
    if (score > bestScore) { bestScore = score; best = candidate; }
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

// ══════════════════════════════════════════════════════════
//  ВКЛАДКИ РАССАДОК
// ══════════════════════════════════════════════════════════

function renderTabs() {
  const nav  = document.getElementById('tabsNav');
  const body = document.getElementById('tabsBody');
  nav.innerHTML  = '';
  body.innerHTML = '';

  for (let idx = 1; idx < seatings.length; idx++) {
    const isFirst = idx === 1;

    const btn = document.createElement('button');
    btn.className   = 'tab-btn' + (isFirst ? ' active' : '');
    btn.textContent = `Игра ${idx}`;
    btn.dataset.tab = idx;
    nav.appendChild(btn);

    const panel = document.createElement('div');
    panel.className   = 'tab-panel' + (isFirst ? ' active' : '');
    panel.dataset.tab = idx;
    panel.appendChild(buildSeatingList(seatings[idx]));
    body.appendChild(panel);
  }

  document.getElementById('tabsWrapper').hidden = false;
}

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

function switchTab(tabIndex) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.tab === tabIndex);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', +panel.dataset.tab === tabIndex);
  });
}

// ══════════════════════════════════════════════════════════
//  СОХРАНЕНИЕ
// ══════════════════════════════════════════════════════════

function saveToFile() {
  if (!seatings.length) { showToast('Сначала сгенерируйте рассадки', 'error'); return; }

  const title = document.getElementById('eveningTitle').value.trim() || 'Мафия';
  const date  = document.getElementById('eveningDate').textContent;
  let text    = `${title} — ${date}\n${'='.repeat(40)}\n\n`;

  for (let idx = 1; idx < seatings.length; idx++) {
    text += `Игра ${idx}:\n`;
    seatings[idx].forEach((name, i) => { text += `  ${i + 1}. ${name}\n`; });
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
  syncInputsToModel();
  const title = document.getElementById('eveningTitle').value.trim() || 'Игровой вечер';
  const date  = document.getElementById('eveningDate').textContent.trim();
  const names = getActivePlayers().filter(Boolean);

  if (!names.length) { showToast('Добавьте игроков!', 'error'); return; }

  // Сохраняем полный список (с резервом) для восстановления
  localStorage.setItem('players', JSON.stringify(
    players.map(p => p.name)
  ));
  localStorage.setItem('activeCount', activeCount);
  localStorage.setItem('evening', JSON.stringify({
    title, gameCount, seatings, date,
    players, activeCount,
  }));

  const existingResults = JSON.parse(localStorage.getItem('eveningResults') || 'null');
  const games = existingResults?.games || {};

  for (let i = 1; i <= gameCount; i++) {
    if (games[i]?.finished) continue;

    const seating = seatings[i] ? [...seatings[i]] : names;

    games[i] = {
      gameNum: i,
      winner:  null,
      finished: false,
      seating,
      players: seating.map((name, idx) => ({
        seat: idx + 1, name,
        role: '', team: '', won: null,
        base: 0, extra: 0, total: 0, fouls: 0,
      })),
    };
  }

  localStorage.setItem('eveningResults', JSON.stringify({
    title, date, games,
    createdAt: existingResults?.createdAt || Date.now(),
  }));

  showToast('Вечер сохранён ✅', 'success');
}

// ══════════════════════════════════════════════════════════
//  ВОССТАНОВЛЕНИЕ
// ══════════════════════════════════════════════════════════

function restoreEvening() {
  const data = JSON.parse(localStorage.getItem('evening') || 'null');

  if (data) {
    const titleEl = document.getElementById('eveningTitle');
    if (titleEl && data.title) titleEl.value = data.title;

    if (data.gameCount) {
      gameCount = data.gameCount;
      updateCounterUI();
    }

    if (data.players && data.players.length) {
      players     = data.players;
      activeCount = data.activeCount || players.length;
    } else if (data.seatings && data.seatings[0]) {
      // Совместимость со старым форматом
      players     = data.seatings[0].map(name => ({ name, active: true }));
      activeCount = players.length;
    }

    if (data.seatings && data.seatings.length) {
      seatings = data.seatings;
      renderTabs();
    }
  }

  renderPlayerList();
}

// ══════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ══════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

// ══════════════════════════════════════════════════════════
//  ПРИВЯЗКА СОБЫТИЙ
// ══════════════════════════════════════════════════════════

function bindEvents() {

  // Сайдбар
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('visible');
  });
  const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  };
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Инпуты — синхронизация при вводе
  document.addEventListener('input', e => {
    if (e.target.classList.contains('player-input')) {
      const idx = +e.target.dataset.index;
      if (players[idx] !== undefined) {
        players[idx].name = e.target.value.trim();
      }
    }
  });

  // Удалить игрока (×)
  document.addEventListener('click', e => {
    if (e.target.classList.contains('clear-slot')) {
      removePlayer(+e.target.dataset.index);
    }
  });

  // Счётчик активных
  document.getElementById('btnActiveMinus')
    .addEventListener('click', () => changeActiveCount(-1));
  document.getElementById('btnActivePlus')
    .addEventListener('click', () => changeActiveCount(+1));

  // Добавить игрока
  document.getElementById('btnAddPlayer')
    .addEventListener('click', addPlayer);

  // Буфер / очистить
  document.getElementById('btnPasteClipboard')
    .addEventListener('click', pasteFromClipboard);
  document.getElementById('btnClearAll')
    .addEventListener('click', clearAllSlots);

  // Счётчик игр
  document.getElementById('btnCountMinus').addEventListener('click', () => {
    if (gameCount > 1) { gameCount--; updateCounterUI(); }
  });
  document.getElementById('btnCountPlus').addEventListener('click', () => {
    if (gameCount < 10) { gameCount++; updateCounterUI(); }
  });

  // Рассадки
  document.getElementById('btnGenerate').addEventListener('click', generateSeatings);
  document.getElementById('tabsNav').addEventListener('click', e => {
    if (e.target.classList.contains('tab-btn')) switchTab(+e.target.dataset.tab);
  });
    // Кнопки рассадки
  document.getElementById('btnSaveFile')
    .addEventListener('click', saveToFile);

  document.getElementById('btnImportFile')
    .addEventListener('click', importSeatingFromFile);

  document.getElementById('importFileInput')
    .addEventListener('change', handleImportFile);

  document.getElementById('btnExportImages')
    ?.addEventListener('click', exportSeatingsAsImages);

  document.getElementById('btnSendToTelegram')
    ?.addEventListener('click', () => {
      const title = document.getElementById('eveningTitle')?.value.trim() || 'МАФИЯ';
      if (!seatings || seatings.length <= 1) {
        showToast('Сначала сгенерируйте рассадки', 'error');
        return;
      }
      sendSeatingsToTelegram(seatings.slice(1), title);
    });

  // Новый вечер
  document.getElementById('btnSaveEvening')?.addEventListener('click', () => {
    localStorage.removeItem('eveningResults');
    localStorage.removeItem('gameState');
    localStorage.removeItem('evening');
    localStorage.removeItem('activeCount');
    players     = [];
    activeCount = 10;
    seatings    = [];
    renderPlayerList();
    document.getElementById('tabsWrapper').hidden = true;
    showToast('Новый вечер начат ✅', 'success');
  });

  // Старт
  document.getElementById('btnStartEvening').addEventListener('click', () => {
    saveEvening();
    window.location.href = 'game.html';
  });
}

// ─── ЭКСПОРТ РАССАДОК КАК КАРТИНОК ───────────────────────────────────────────

async function exportSeatingsAsImages() {
  if (!seatings || seatings.length <= 1) {
    showToast('Сначала сгенерируйте рассадки', 'error');
    return;
  }

  // Берём название прямо из инпута — он всегда актуален
  const eveningTitle = document.getElementById('eveningTitle')?.value.trim() || 'МАФИЯ';
  const totalGames = seatings.length - 1;

  showToast(`Генерирую ${totalGames} картинок...`, 'info');

  for (let i = 1; i <= totalGames; i++) {
    await exportSingleSeating(
      seatings[i],
      i,
      totalGames,
      eveningTitle
    );
    await new Promise(r => setTimeout(r, 600));
  }

  showToast('✅ Все картинки скачаны!', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────

async function exportSingleSeating(players, gameNum, totalGames, eveningTitle) {

  // Открываем шаблон в скрытом iframe
  return new Promise((resolve) => {

    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 1080px;
      height: 1920px;
      border: none;
      visibility: hidden;
    `;
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      const doc = iframe.contentDocument;

      // Подставляем данные
      doc.getElementById('tplEveningTitle').textContent =
      eveningTitle.toUpperCase();

      doc.getElementById('tplGameTitle').textContent = `${gameNum}/${totalGames}`;

      // Строим список игроков
      const list = doc.getElementById('tplPlayersList');
      list.innerHTML = players.map((name, idx) => `
        <div class="player-row">
          <span class="player-num">${idx + 1}</span>
          <div class="player-sep"></div>
          <span class="player-name">${escapeHtml(name)}</span>
        </div>
      `).join('');

      // Ждём загрузки шрифтов внутри iframe
      await iframe.contentDocument.fonts.ready;
      // Небольшая доп. пауза для фона
      await new Promise(r => setTimeout(r, 400));

      // Делаем скриншот
      const canvas = await html2canvas(
        doc.getElementById('card'),
        {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          width: 1080,
          height: 1920,
          windowWidth: 1080,
          windowHeight: 1920,
          backgroundColor: '#1a1a1a',
        }
      );

      // Скачиваем
      const link = document.createElement('a');
      link.download = `рассадка_игра_${gameNum}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Убираем iframe
      document.body.removeChild(iframe);
      resolve();
    };

    // Загружаем шаблон
    iframe.src = './seating-template.html';
  });
}

async function sendSeatingsToTelegram(seatings, eveningTitle) {
  const TG_BOT_TOKEN = '8820048575:AAE3qfYwdREErcvVUmVjR1CcmByeHr2nw0w';
  const TG_CHAT_ID   = '-1003786838980';

  showToast(`Генерирую ${seatings.length} картинок...`, 'info');

  // 1. Рендерим все canvas параллельно
  const canvases = await Promise.all(
    seatings.map((players, i) =>
      renderSeatingsCanvas(players, i + 1, seatings.length, eveningTitle)
    )
  );

  // 2. Конвертируем все canvas в blob
  const blobs = await Promise.all(
    canvases.map(canvas =>
      new Promise(res => canvas.toBlob(res, 'image/png'))
    )
  );

  showToast(`Отправляю в Telegram...`, 'info');

  // 3. Telegram принимает максимум 10 фото за раз — делим на чанки
  const chunks = [];
  for (let i = 0; i < blobs.length; i += 10) {
    chunks.push(blobs.slice(i, i + 10));
  }

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const formData = new FormData();
    formData.append('chat_id', TG_CHAT_ID);

    // media — массив объектов, файлы передаём как attach://имя
    const media = chunk.map((blob, i) => {
      const globalIndex = c * 10 + i;
      const attachName  = `photo${globalIndex}`;

      formData.append(attachName, blob, `игра_${globalIndex + 1}.png`);

      return {
        type:    'photo',
        media:   `attach://${attachName}`,
        // Подпись только к первой картинке в группе
        ...(i === 0 ? { caption: `🎮 ${eveningTitle} — рассадки` } : {}),
      };
    });

    formData.append('media', JSON.stringify(media));

    const res  = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMediaGroup`,
      { method: 'POST', body: formData }
    );
    const json = await res.json();

    if (!json.ok) {
      console.error('TG Error:', json);
      showToast(`❌ Ошибка: ${json.description}`, 'error');
      return;
    }
  }

  showToast('✅ Отправлено в Telegram!', 'success');
}

async function renderSeatingsCanvas(players, gameNum, totalGames, eveningTitle) {
  return new Promise((resolve) => {

    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 1080px;
      height: 1920px;
      border: none;
      visibility: hidden;
    `;
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      const doc = iframe.contentDocument;

      doc.getElementById('tplEveningTitle').textContent =
        eveningTitle.toUpperCase();

      doc.getElementById('tplGameTitle').textContent =
        `${gameNum}/${totalGames}`;

      const list = doc.getElementById('tplPlayersList');
      list.innerHTML = players.map((name, idx) => `
        <div class="player-row">
          <span class="player-num">${idx + 1}</span>
          <div class="player-sep"></div>
          <span class="player-name">${escapeHtml(name)}</span>
        </div>
      `).join('');

      await iframe.contentDocument.fonts.ready;
      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(
        doc.getElementById('card'),
        {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          width: 1080,
          height: 1920,
          windowWidth: 1080,
          windowHeight: 1920,
          backgroundColor: '#1a1a1a',
        }
      );

      document.body.removeChild(iframe);
      resolve(canvas); // ← возвращаем canvas, не скачиваем
    };

    iframe.src = './seating-template.html';
  });
}

// ══════════════════════════════════════════════════════════
//  ИМПОРТ РАССАДКИ ИЗ ФАЙЛА
// ══════════════════════════════════════════════════════════

function importSeatingFromFile() {
  const input = document.getElementById('importFileInput');
  input.value = ''; // сброс, чтобы можно было выбрать тот же файл повторно
  input.click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload  = (e) => applyImportedSeating(e.target.result);
  reader.onerror = ()  => showToast('Ошибка чтения файла', 'error');
  reader.readAsText(file, 'utf-8');
}

function parseSeatingFile(text) {
  const lines = text.split('\n');

  // Заголовок — первая непустая строка без «=»
  let title = '';
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith('=')) {
      // «Царский — 24 июля 2026 г.» → берём часть до тире
      const dashIdx = t.search(/[—–-]/);
      title = dashIdx > 0 ? t.slice(0, dashIdx).trim() : t;
      break;
    }
  }

  // Ищем блоки «Игра N:» — любое количество
  const games   = [];
  let currentGame = null;

  for (const line of lines) {
    const t = line.trim();

    const gameMatch = t.match(/^Игра\s+(\d+)\s*:?$/i);
    if (gameMatch) {
      currentGame = [];
      games.push(currentGame);
      continue;
    }

    if (currentGame !== null) {
      // «  1. Ведьма» или «1) Ведьма»
      const playerMatch = t.match(/^\d+\s*[.)]\s+(.+)$/);
      if (playerMatch) {
        const name = playerMatch[1].trim();
        if (name) currentGame.push(name);
      }
    }
  }

  if (!games.length) return null;

  return {
    title,
    // seatings[0] = исходный порядок (из первой игры)
    // seatings[1..N] = Игра 1, Игра 2, ...
    seatings:    [games[0], ...games],
    playerNames: [...games[0]],
    gameCount:   games.length,
  };
}

function applyImportedSeating(text) {
  const parsed = parseSeatingFile(text);

  if (!parsed) {
    showToast('Не удалось распознать файл рассадки', 'error');
    return;
  }

  const { title, seatings: imported, playerNames, gameCount: gc } = parsed;

  const confirmed = confirm(
    `Импортировать рассадку?\n\n` +
    `📋 ${title}\n` +
    `🎮 Игр: ${gc}\n` +
    `👥 Игроков: ${playerNames.length}\n\n` +
    `Текущие данные будут заменены.`
  );
  if (!confirmed) return;

  // Применяем данные
  players     = playerNames.map(name => ({ name, active: true }));
  activeCount = playerNames.length;
  seatings    = imported;
  gameCount   = gc;

  // Восстанавливаем название
  const titleEl = document.getElementById('eveningTitle');
  if (titleEl && title) titleEl.value = title;

  // Обновляем UI
  updateCounterUI();
  renderPlayerList();
  renderTabs();
  document.getElementById('tabsWrapper').hidden = false;

  // Сохраняем в localStorage
  localStorage.setItem('evening', JSON.stringify({
    title, gameCount, seatings, players, activeCount,
    date: document.getElementById('eveningDate')?.textContent || '',
  }));

  showToast(`✅ Импортировано: ${gc} игр, ${playerNames.length} игроков`, 'success');
}