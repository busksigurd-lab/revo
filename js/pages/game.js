// ============================================================
//  GAME.JS
// ============================================================

// ── Конфигурация ролей ──────────────────────────────────────
const ROLES_CONFIG = {
  sheriff:  { label: 'Шериф',    short: 'ШЕР', max: 1 },
  don:      { label: 'Дон',      short: 'ДОН', max: 1 },
  mafia:    { label: 'Мафия',    short: 'МАФ', max: null },
  peaceful: { label: 'Мирный',   short: 'МИР', max: null },
  maniac:   { label: 'Маньяк',   short: 'МАН', max: 1 },
  doctor:   { label: 'Доктор',   short: 'ДОК', max: 1 },
  beauty:   { label: 'Красотка', short: 'КРА', max: 1 },
};

const MENU_PHASES = ['roles', 'night0', 'day', 'vote', 'night'];

// ── Состояние ───────────────────────────────────────────────
const GameState = {
  evening:        null,
  players:        [],
  currentSeating: [],
  currentGameNum: 1,
  phase:          'seating',
  roles:          [],
  currentSeatIdx: 0,
};

// ── Инициализация ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadEveningData();
  renderSeatingPhase();
  bindSeatingEvents();
  bindRolesEvents();
  bindNight0Events();
  bindDayEvents();
  bindNightEvents();
  bindGameMenuEvents();
  initVotePhase();
});

// ════════════════════════════════════════════════════════════
//  ЗАГРУЗКА ДАННЫХ
// ════════════════════════════════════════════════════════════

function loadEveningData() {
  const evening = JSON.parse(localStorage.getItem('evening') || 'null');
  const players = JSON.parse(localStorage.getItem('players') || '[]');

  if (!evening) { window.location.href = 'index.html'; return; }

  GameState.evening = evening;
  GameState.players = players.filter(Boolean);

  const saved = JSON.parse(localStorage.getItem('gameState') || 'null');
  if (saved?.currentGameNum) GameState.currentGameNum = saved.currentGameNum;

  if (saved?.currentSeating?.length) {
    GameState.currentSeating = saved.currentSeating;
  } else {
    GameState.currentSeating = [...GameState.players];
  }
}

// ════════════════════════════════════════════════════════════
//  ФАЗА 1 — РАССАДКА
// ════════════════════════════════════════════════════════════

function renderSeatingPhase() {
  const ev = GameState.evening;
  document.getElementById('gameTitle').textContent = ev.title || 'Мафия-клуб';
  document.getElementById('gameDate').textContent  = ev.date  || '';
  document.getElementById('currentGameNumber').textContent = GameState.currentGameNum;

  const hasSeating = ev.seatings?.[GameState.currentGameNum];
  const btnApply   = document.getElementById('btnApplySeating');
  btnApply.disabled = !hasSeating;
  if (hasSeating) btnApply.textContent = `🔀 Применить рассадку №${GameState.currentGameNum}`;

  renderSeatingList();
}

function renderSeatingList() {
  const list = document.getElementById('seatingList');
  list.innerHTML = '';

  GameState.currentSeating.forEach((name, i) => {
    const li = document.createElement('li');
    li.className     = 'seat-drag-item';
    li.draggable     = true;
    li.dataset.index = i;
    li.innerHTML = `
      <span class="drag-handle">⠿</span>
      <span class="seat-number">${i + 1}</span>
      <span class="seat-name">${escapeHtml(name)}</span>
    `;
    list.appendChild(li);
  });

  initDragAndDrop(list);
}

function initDragAndDrop(list) {
  let dragIndex = null;

  const fresh = list.cloneNode(true);
  list.parentNode.replaceChild(fresh, list);

  fresh.querySelectorAll('.seat-drag-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragIndex = +item.dataset.index;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      fresh.querySelectorAll('.seat-drag-item')
        .forEach(el => el.classList.remove('dragging', 'drag-over'));
      dragIndex = null;
    });
    item.addEventListener('dragenter', e => {
      e.preventDefault();
      if (+item.dataset.index === dragIndex) return;
      fresh.querySelectorAll('.drag-over')
        .forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('dragover',  e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('dragleave', e => {
      if (!item.contains(e.relatedTarget)) item.classList.remove('drag-over');
    });
    item.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      const dropIdx = +item.dataset.index;
      if (dropIdx === dragIndex || dragIndex === null) return;
      const arr = GameState.currentSeating;
      [arr[dragIndex], arr[dropIdx]] = [arr[dropIdx], arr[dragIndex]];
      renderSeatingList();
    });
  });
}

function applyGeneratedSeating() {
  const seatings = GameState.evening.seatings;
  const num      = GameState.currentGameNum;
  if (!seatings?.[num]) return;
  GameState.currentSeating = [...seatings[num]];
  renderSeatingList();
  showToast(`Рассадка №${num} применена ✅`);
}

function startGame() {
  if (GameState.currentSeating.length < 4) {
    showToast('Нужно минимум 4 игрока!', 'error'); return;
  }
  saveGameState();
  initRolesPhase();
  switchPhase('roles');
}

function bindSeatingEvents() {
  document.getElementById('btnBackToPlayers')
    .addEventListener('click', () => { window.location.href = 'index.html'; });
  document.getElementById('btnApplySeating')
    .addEventListener('click', applyGeneratedSeating);
  document.getElementById('btnStartGame')
    .addEventListener('click', startGame);
}

// ════════════════════════════════════════════════════════════
//  ФАЗА 2 — РАЗДАЧА РОЛЕЙ
// ════════════════════════════════════════════════════════════

function getRoleLimits(playerCount) {
  const mafia    = playerCount >= 14 ? 3 : 2;
  const special  = 5;
  const peaceful = playerCount - mafia - special;
  return {
    sheriff:  1,
    don:      1,
    mafia,
    peaceful: Math.max(0, peaceful),
    maniac:   1,
    doctor:   1,
    beauty:   1,
  };
}

function initRolesPhase() {
  GameState.roles          = new Array(GameState.currentSeating.length).fill(null);
  GameState.currentSeatIdx = 0;

  document.getElementById('roleGameTitle').textContent =
    GameState.evening.title || 'Мафия-клуб';
  document.getElementById('roleGameNumber').textContent =
    GameState.currentGameNum;

  renderRolesList();
  renderRolesCounter();
  updateRoleButtons();
}

function renderRolesList() {
  const list = document.getElementById('rolesList');
  list.innerHTML = '';

  GameState.currentSeating.forEach((name, i) => {
    const role = GameState.roles[i];
    const cfg  = role ? ROLES_CONFIG[role] : null;
    const isActive = i === GameState.currentSeatIdx;

    const li = document.createElement('li');
    li.className = 'role-player-item' + (isActive ? ' current' : '');
    li.innerHTML = `
      <span class="role-seat-num">${i + 1}</span>
      <span class="role-seat-name">${escapeHtml(name)}</span>
      <span class="role-tag-slot">
        ${cfg
          ? `<span class="role-tag role-tag--${role}">${cfg.short}</span>`
          : '<span class="role-tag-empty"></span>'}
      </span>
    `;
    list.appendChild(li);
  });

  const activeEl = list.querySelector('.current');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderRolesCounter() {
  const limits = getRoleLimits(GameState.currentSeating.length);
  const counts = {};
  Object.keys(ROLES_CONFIG).forEach(r => counts[r] = 0);
  GameState.roles.forEach(r => { if (r) counts[r]++; });

  const parts = Object.entries(ROLES_CONFIG).map(([key, cfg]) => {
    const max     = limits[key] ?? 0;
    const current = counts[key];
    const done    = current >= max;
    return `<span class="counter-item ${done ? 'counter-done' : ''}">
      ${cfg.label} ${current}/${max}
    </span>`;
  });

  document.getElementById('rolesCounter').innerHTML = parts.join('');
}

function updateRoleButtons() {
  const limits = getRoleLimits(GameState.currentSeating.length);
  const counts = {};
  Object.keys(ROLES_CONFIG).forEach(r => counts[r] = 0);
  GameState.roles.forEach(r => { if (r) counts[r]++; });

  const allAssigned = GameState.currentSeatIdx >= GameState.currentSeating.length;

  document.querySelectorAll('.role-btn[data-role]').forEach(btn => {
    const role = btn.dataset.role;
    const max  = limits[role] ?? 0;
    btn.disabled = allAssigned || counts[role] >= max;
  });

  const allDone = GameState.roles.every(r => r !== null);
  document.getElementById('btnRolesDone').disabled = !allDone;
}

function assignRole(role) {
  const idx = GameState.currentSeatIdx;
  if (idx >= GameState.currentSeating.length) return;
  GameState.roles[idx]     = role;
  GameState.currentSeatIdx = idx + 1;
  renderRolesList();
  renderRolesCounter();
  updateRoleButtons();
}

function cancelLastRole() {
  const idx = GameState.currentSeatIdx;
  if (idx === 0) return;
  const prevIdx = idx - 1;
  GameState.roles[prevIdx]  = null;
  GameState.currentSeatIdx  = prevIdx;
  renderRolesList();
  renderRolesCounter();
  updateRoleButtons();
}

function finishRoles() {
  if (GameState.roles.some(r => r === null)) {
    showToast('Не все игроки получили роли!', 'error'); return;
  }
  saveGameState();
  startNight0();
}

function bindRolesEvents() {
  document.getElementById('btnRolesBack')
    .addEventListener('click', () => switchPhase('seating'));

  document.querySelectorAll('.role-btn[data-role]').forEach(btn => {
    btn.addEventListener('click', () => assignRole(btn.dataset.role));
  });

  document.getElementById('btnCancelRole')
    .addEventListener('click', cancelLastRole);

  document.getElementById('btnRolesDone')
    .addEventListener('click', finishRoles);
}

// ════════════════════════════════════════════════════════════
//  ФАЗА 3 — НУЛЕВАЯ НОЧЬ
// ════════════════════════════════════════════════════════════

let night0Interval = null;
let night0Seconds  = 0;

function startNight0() {
  
  const src  = document.getElementById('rolesList');
  const dest = document.getElementById('night0List');
  dest.innerHTML = src.innerHTML;

  night0Seconds = 0;
  document.getElementById('night0Timer').textContent = formatTime(0);
  clearInterval(night0Interval);
  night0Interval = setInterval(() => {
    night0Seconds++;
    document.getElementById('night0Timer').textContent = formatTime(night0Seconds);
  }, 1000);

   document.getElementById('night0GameTitle').textContent = GameState.evening?.title || 'Мафия-клуб'; // ← ДОБАВЬ ЭТУ СТРОКУ

  switchPhase('night0');
}

function stopNight0() {
  clearInterval(night0Interval);
  night0Interval = null;
}

function bindNight0Events() {
 
  document.getElementById('btnCityWakes').addEventListener('click', () => {
    stopNight0();
    dayState.round = 0;
    startDay();  // ← просто startDay() без аргумента
  });
}

// ════════════════════════════════════════════════════════════
//  ФАЗА 4 — ДЕНЬ
// ════════════════════════════════════════════════════════════

const SPEECH_SECONDS  = 45;
const WARN_SECONDS    = 10;
const TOURNAMENT_MODE = false;

const dayState = {
  players:           [],
  currentIdx:        -1,
  timerSec:          SPEECH_SECONDS,
  timerRunning:      false,
  timerInterval:     null,
  round:             0,
  eliminatedThisDay: false,  // был ли убран игрок в этот день
  startSeatIdx:      0,      // с какого места начинается день
  speechRound:       0,
  lastSpeech:        false,
};

// ── Вычисление стартового игрока для раунда ─────────────────
function getStartIdxForRound(round) {
  const players = dayState.players;
  const total   = players.length;

  // День 0 → первый живой от начала
  if (round === 0) return players.findIndex(p => p.alive);

  // День N → N-й живой игрок (0-based)
  let count = 0;
  for (let i = 0; i < total * 2; i++) {
    const p = players[i % total];
    if (p.alive) {
      if (count === round) return i % total;
      count++;
    }
  }
  return players.findIndex(p => p.alive);
}

// ── Запуск дня ──────────────────────────────────────────────
function startDay() {
    console.log('▶ startDay, round =', dayState.round); // добавь эту строку

  // Инициализируем игроков если ещё не заполнены
  if (dayState.players.length === 0) {
    dayState.players = GameState.currentSeating.map((name, i) => ({
  seat:               i + 1,
  name,
  role:               ROLES_CONFIG[GameState.roles[i]]?.short || '',
  alive:              true,
  fouls:              0,
  extra:              0,
  skipNext:           false,
  nominee:            null,
  nomineeOrder:       null,   // ← ДОБАВЬ: порядок выдвижения
  nightDead:          false,
  eliminationReason:  null,
}));
  }

  // Сбрасываем номинации каждый день
  dayState.players.forEach(p => { 
  p.nominee      = null; 
  p.nomineeOrder = null;  // ← ДОБАВЬ
});

  // Сброс состояния дня
  dayState.eliminatedThisDay = false;
  dayState.currentIdx        = -1;
  dayState.timerSec          = SPEECH_SECONDS;
  dayState.timerRunning      = false;
  dayState.speechRound       = 0;
  dayState.lastSpeech        = false;
  clearInterval(dayState.timerInterval);

  // Вычисляем стартового игрока
  const startIdx = getStartIdxForRound(dayState.round);
  if (startIdx === -1) {
    console.error('Нет живых игроков');
    return;
  }
  dayState.startSeatIdx = startIdx;

  rolesVisible = false;
  applyRolesVisibility();

  renderDayList();
  renderNominationRow();
  renderDayTimer();
  document.getElementById('dayTimerLabel').textContent = '— — —';
  document.getElementById('btnSpeech').textContent     = '▶ Речь';

  switchPhase('day');
  document.getElementById('dayPhaseTitle').textContent = `${dayState.round} ДЕНЬ`;
  document.getElementById('dayGameTitle').textContent = GameState.evening?.title || 'Мафия-клуб'; // ← ДОБАВЬ ЭТУ СТРОКУ
}

// ── Переход из ночи в день ──────────────────────────────────
function startDayFromNight(roundNum) {
  dayState.round = roundNum;
  startDay();
}

function renderDayList() {
  const ul = document.getElementById('dayList');
  ul.innerHTML = '';

  const alive   = dayState.players.filter(p => p.alive);
  const dead    = dayState.players.filter(p => !p.alive);
  const ordered = [...alive, ...dead];

  ordered.forEach((p) => {
    const idx = dayState.players.indexOf(p);

    const li = document.createElement('li');
    li.className = 'day-player-item';
    if (!p.alive)                    li.classList.add('eliminated');
    if (idx === dayState.currentIdx) li.classList.add('speaking');
    if (p.skipNext)                  li.classList.add('skip-speech');

    const roleClass = roleTagClass(p.role);

    li.innerHTML = `
      <span class="day-seat-num">${p.seat}</span>
      <span class="day-seat-name">${p.name}</span>
      <div class="day-role-slot">
        ${roleClass
          ? `<span class="role-tag ${roleClass} day-role-tag">${p.role}</span>`
          : ''}
      </div>
      <div class="foul-cell">
        <span class="foul-cell-label">ФОЛ</span>
        <div class="foul-cell-controls">
          <button class="foul-btn" data-idx="${idx}" data-action="foul-dec">−</button>
          <div class="foul-circle ${p.fouls >= 3 ? 'foul-warn' : ''}">${p.fouls}</div>
          <button class="foul-btn" data-idx="${idx}" data-action="foul-inc">+</button>
        </div>
      </div>
      <div class="extra-cell">
        <span class="extra-cell-label">ДОП</span>
        <div class="extra-cell-controls">
          <button class="extra-btn" data-idx="${idx}" data-action="extra-dec">−</button>
          <span class="extra-value">${p.extra}</span>
          <button class="extra-btn" data-idx="${idx}" data-action="extra-inc">+</button>
        </div>
      </div>
      <div class="nominated-cell ${p.nominee !== null ? 'has-nominee' : ''}">
        ${p.nominee !== null ? p.nominee : ''}
      </div>
    `;

    ul.appendChild(li);
  });
}

function roleTagClass(role) {
  const map = {
    'ШЕР': 'role-tag--sheriff',
    'ДОН': 'role-tag--don',
    'МАФ': 'role-tag--mafia',
    'МИР': 'role-tag--peaceful',
    'МАН': 'role-tag--maniac',
    'ДОК': 'role-tag--doctor',
    'КРА': 'role-tag--beauty',
  };
  return map[role] || '';
}

// ── Клики: фолы / допы ──────────────────────────────────────
function handleDayListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx    = parseInt(btn.dataset.idx);
  const action = btn.dataset.action;
  const p      = dayState.players[idx];

  if (action === 'foul-inc') {
    if (p.fouls >= 3) {
      openConfirm(
        `Четвёртый фол — игрок #${p.seat} ${p.name} будет удалён. Точно?`,
        () => eliminatePlayer(idx, 'foul')
      );
      return;
    }
    p.fouls++;
    if (p.fouls === 3) p.skipNext = true;
    renderDayList();
    return;
  }

  if (action === 'foul-dec' && p.fouls > 0) {
    p.fouls--;
    if (p.fouls < 3) p.skipNext = false;
    renderDayList();
    return;
  }

  if (action === 'extra-inc') { p.extra++; renderDayList(); return; }
  if (action === 'extra-dec') { p.extra--; renderDayList(); return; }

  if (action === 'eliminate') {
    if (p.alive) {
      openConfirm(
        `Убрать игрока #${p.seat} ${p.name} из игры?`,
        () => eliminatePlayer(idx, 'manual')
      );
    } else {
      openConfirm(
        `Вернуть игрока #${p.seat} ${p.name} в игру?`,
        () => revivePlayer(idx)
      );
    }
  }
}

// ── Убрать игрока из игры ────────────────────────────────────
function eliminatePlayer(idx, reason) {
  const p = dayState.players[idx];
  p.alive = false;
  p.eliminationReason = reason;

  if (reason === 'foul') p.fouls = 4;

  // Помечаем: в этот день был удалён игрок → голосования не будет
  dayState.eliminatedThisDay = true;

  if (idx === dayState.currentIdx) {
    clearInterval(dayState.timerInterval);
    dayState.timerRunning = false;
    dayState.currentIdx   = -1;
    document.getElementById('dayTimerLabel').textContent = '— — —';
    document.getElementById('btnSpeech').textContent = '▶ Речь';
  }

  showToast(`#${p.seat} ${p.name} вне игры`, 'error');
  renderDayList();
  renderNominationRow();
}

// ── Вернуть игрока в игру ────────────────────────────────────
function revivePlayer(idx) {
  const p = dayState.players[idx];
  p.alive = true;
  p.eliminationReason = null;
  if (p.fouls >= 4) p.fouls = 3;

  showToast(`#${p.seat} ${p.name} возвращён в игру`);
  renderDayList();
  renderNominationRow();
}

// ── Таймер ──────────────────────────────────────────────────
function renderDayTimer() {
  const el = document.getElementById('dayTimer');
  el.textContent = formatTime(dayState.timerSec);
  el.classList.toggle('timer-warn',
    dayState.timerSec <= WARN_SECONDS && dayState.timerSec > 0 && dayState.timerRunning);
  el.classList.toggle('timer-done', dayState.timerSec === 0);
}

function startSpeechTimer() {
  clearInterval(dayState.timerInterval);
  dayState.timerSec     = SPEECH_SECONDS;
  dayState.timerRunning = true;
  renderDayTimer();

  dayState.timerInterval = setInterval(() => {
    dayState.timerSec--;
    renderDayTimer();
    if (dayState.timerSec <= 0) {
      clearInterval(dayState.timerInterval);
      dayState.timerRunning = false;
      renderDayTimer();
    }
  }, 1000);

  document.getElementById('dayTimerLabel').textContent =
    `Говорит #${dayState.players[dayState.currentIdx]?.seat}`;
  document.getElementById('btnSpeech').textContent = '⏭ Далее';
}

// ── Следующий говорящий ──────────────────────────────────────

function nextSpeaker() {
  const players = dayState.players;
  const alive   = players.filter(p => p.alive);

  if (alive.length === 0) return;

  // ── Если стартовый только что закончил своё ПОСЛЕДНЕЕ слово (день 0) ──
  if (dayState.round === 0 && dayState.lastSpeech) {
    // Таймер уже идёт — это была его вторая речь, она завершилась
    // Следующий клик "Далее" должен завершить день
    dayState.lastSpeech   = false;
    dayState.currentIdx   = -1;
    clearInterval(dayState.timerInterval);
    dayState.timerRunning = false;
    document.getElementById('dayTimerLabel').textContent = '— — —';
    document.getElementById('btnSpeech').textContent     = '▶ Речь';
    renderDayList();
    renderNominationRow();
    openSleepModal();
    return;
  }

  // ── Первый вызов — стартуем с startSeatIdx ──
  if (dayState.currentIdx === -1) {
    if (dayState.startSeatIdx === -1) {
      dayState.startSeatIdx = players.findIndex(p => p.alive);
    }
    if (dayState.startSeatIdx === -1) return;

    dayState.currentIdx = dayState.startSeatIdx;
    startSpeechTimer();
    renderDayList();
    renderNominationRow();
    return;
  }

  const startPlayer = players[dayState.startSeatIdx];
  const total       = players.length;

  // ── Ищем следующего живого ──
  let nextIdx = -1;
  for (let i = 1; i <= total; i++) {
    const candidate = players[(dayState.currentIdx + i) % total];
    if (candidate.alive) {
      nextIdx = players.indexOf(candidate);
      break;
    }
  }

  if (nextIdx === -1) return;

  const nextPlayer = players[nextIdx];

  // ── Круг завершён ──
  if (nextPlayer.seat === startPlayer.seat) {

    // ДЕНЬ 0: стартовый говорит последним → ставим флаг и даём речь
    if (dayState.round === 0) {
      dayState.lastSpeech = true;      // следующий клик → завершение
      dayState.currentIdx = nextIdx;
      startSpeechTimer();
      renderDayList();
      renderNominationRow();
      return;
    }

    // ДЕНЬ 1+: завершаем круг
    dayState.currentIdx   = -1;
    clearInterval(dayState.timerInterval);
    dayState.timerRunning = false;

    if (dayState.eliminatedThisDay) {
      openSleepModal();
    } else {
      openVotingModal();
    }
    return;
  }

  // ── Обычный следующий игрок ──
  dayState.currentIdx = nextIdx;
  startSpeechTimer();
  renderDayList();
  renderNominationRow();
}

// ── Номинации ────────────────────────────────────────────────
function renderNominationRow() {
  const row = document.getElementById('nominationRow');
  row.innerHTML = '';

  dayState.players.forEach(p => {
    const btn = document.createElement('button');
    btn.className   = 'nom-btn';
    btn.textContent = p.seat;
    if (!p.alive) btn.classList.add('nom-eliminated');

    const cur = dayState.currentIdx >= 0
      ? dayState.players[dayState.currentIdx] : null;
    if (cur && cur.nominee === p.seat) btn.classList.add('nom-selected');

    btn.addEventListener('click', () => {
      if (dayState.currentIdx < 0) return;

      const voter = dayState.players[dayState.currentIdx];
      voter.nominee = p.seat;

      // Записываем порядок выдвижения если ещё не выдвинут
      if (p.nomineeOrder === null) {
        const orders = dayState.players
          .filter(pl => pl.nomineeOrder !== null)
          .map(pl => pl.nomineeOrder);
        const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;
        p.nomineeOrder = maxOrder + 1;
      }

      renderDayList();
      renderNominationRow();
    });

    row.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.className   = 'nom-cancel-btn';
  cancel.textContent = '✕';
  cancel.title       = 'Снять кандидатуру';
  cancel.addEventListener('click', () => {
    if (dayState.currentIdx < 0) return;

    const voter = dayState.players[dayState.currentIdx];

    // Сбрасываем nomineeOrder если никто другой не выдвинул
    if (voter.nominee !== null) {
      const oldNominee = dayState.players.find(pl => pl.seat === voter.nominee);
      if (oldNominee) {
        const stillNominated = dayState.players.some(
          pl => pl.nominee === oldNominee.seat && pl.seat !== voter.seat
        );
        if (!stillNominated) oldNominee.nomineeOrder = null;
      }
    }

    voter.nominee = null;
    renderDayList();
    renderNominationRow();
  });

  row.appendChild(cancel);
}

// ── Видимость ролей ──────────────────────────────────────────
let rolesVisible = false;

function applyRolesVisibility() {
  const list = document.getElementById('dayList');
  const btn  = document.getElementById('btnToggleRoles');

  list.classList.toggle('roles-hidden', !rolesVisible);
  btn.classList.toggle('active', rolesVisible);
  btn.querySelector('.eye-icon').textContent  = rolesVisible ? '👁'  : '🙈';
  btn.querySelector('.eye-label').textContent = rolesVisible ? 'Роли видны' : 'Роли скрыты';
}

// ── Голосование (День 1+) ────────────────────────────────────
function openVotingModal() {
  const votesMap = {};
  dayState.players.forEach(p => {
    if (p.nominee !== null && p.alive) {
      votesMap[p.nominee] = (votesMap[p.nominee] || 0) + 1;
    }
  });

  const nominees = Object.entries(votesMap)
    .map(([seat, votes]) => ({ seat: +seat, votes }))
    .sort((a, b) => {
      // Берём nomineeOrder из dayState.players
      const orderA = dayState.players.find(pl => pl.seat === a.seat)?.nomineeOrder ?? 999;
      const orderB = dayState.players.find(pl => pl.seat === b.seat)?.nomineeOrder ?? 999;
      return orderA - orderB; // сортируем по порядку выдвижения
    });

  let text = 'Голосование! <br> <br>';
if (nominees.length === 0) {
  text += 'Нет номинантов.';
} else {
  text += nominees.map(n => {
    const p = dayState.players.find(pl => pl.seat === n.seat);
    return `#${n.seat} ${p?.name || '<br>'}`;
  }).join('<br>');
}

  confirmCallback = () => enterVotePhase();

  document.getElementById('confirmText').innerHTML = text;
  document.getElementById('confirmYes').textContent = 'К голосованию →';
  document.getElementById('confirmNo').style.display = 'none';
  document.getElementById('confirmModal').classList.add('open');
}

// ── Город засыпает ───────────────────────────────────────────
function openSleepModal() {

     console.log('💤 openSleepModal, dayState.round =', dayState.round); // временно

  document.getElementById('confirmText').textContent = 'Город засыпает 🌙';

  confirmCallback = () => {
    stopDay();
    startNight(dayState.round + 1);
  };

  document.getElementById('confirmYes').textContent  = 'Далее →';
  document.getElementById('confirmNo').style.display = 'none';
  document.getElementById('confirmModal').classList.add('open');
}

function stopDay() {
  clearInterval(dayState.timerInterval);
  dayState.timerRunning = false;
}

// ── Привязка событий дня ─────────────────────────────────────
function bindDayEvents() {
  document.getElementById('btnSpeech')
    .addEventListener('click', nextSpeaker);

   document.getElementById('btnToggleRoles')
    .addEventListener('click', () => {
      rolesVisible = !rolesVisible;
      applyRolesVisibility();
    });

  

  document.getElementById('dayList')
    .addEventListener('click', handleDayListClick);
 
}

function bindGameMenuEvents() {
  const gameDropdown = document.getElementById('gameDropdown');

  document.getElementById('btnGameMenu').addEventListener('click', e => {
    e.stopPropagation();
    gameDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    gameDropdown.classList.remove('open');
  });

  document.getElementById('ddFinish').addEventListener('click', () => {
    gameDropdown.classList.remove('open');
    openConfirm('Завершить игру?', () => {
      stopDay();
      showToast('Игра завершена!', 'info');
    });
  });

  document.getElementById('ddRestart').addEventListener('click', () => {
    gameDropdown.classList.remove('open');
    openConfirm('Перезапустить игру? Весь прогресс будет потерян.', () => {
      stopDay();
      switchPhase('seating');
    });
  });

  document.getElementById('ddKick').addEventListener('click', () => {
    gameDropdown.classList.remove('open');
    openKickModal();
  });
}

// ════════════════════════════════════════════════════════════
//  ФАЗА 5 — НОЧЬ
// ════════════════════════════════════════════════════════════

const NIGHT_STEPS = [
  { key: 'mafia',   label: 'Мафия',    seconds: 45 },
  { key: 'don',     label: 'Дон',      seconds: 15 },
  { key: 'sheriff', label: 'Шериф',    seconds: 15 },
  { key: 'maniac',  label: 'Маньяк',   seconds: 15 },
  { key: 'doctor',  label: 'Доктор',   seconds: 15 },
  { key: 'beauty',  label: 'Красотка', seconds: 15 },
];

const nightState = {
  round:          1,
  stepIdx:        0,
  stepDone:       false,
  selectedSeat:   null,
  timerSec:       0,
  timerRunning:   false,
  timerInterval:  null,
  killedBySeat:   null,
  killedByManiac: null,
  healedByDoc:    null,
  beautyTarget:   null,
  donChecked:     null,
  sheriffChecked: null,
  nightKilled:    {},
  flashMap:       {},
  bgMap:          {},
  isDebrief:      false,
};

// ── Запуск ночи ──────────────────────────────────────────────
function startNight(roundNum) {
     console.log('🌙 startNight, roundNum =', roundNum); // добавь эту строку  
  nightState.round          = roundNum;
  nightState.stepIdx        = 0;
  nightState.stepDone       = false;
  nightState.selectedSeat   = null;
  nightState.killedBySeat   = null;
  nightState.killedByManiac = null;
  nightState.healedByDoc    = null;
  nightState.beautyTarget   = null;
  nightState.donChecked     = null;
  nightState.sheriffChecked = null;
  nightState.nightKilled    = {};
  nightState.flashMap       = {};
  nightState.bgMap          = {};
  nightState.isDebrief      = false;

  document.getElementById('nightGameTitle').textContent =
    GameState.evening.title || 'Мафия-клуб';
  document.getElementById('nightPhaseTitle').textContent =
    `${roundNum} НОЧЬ`;

  document.getElementById('btnNightNext').style.display    = '';
  document.getElementById('btnNightDebrief').style.display = 'none';
  document.getElementById('btnLastWord').style.display     = 'none';
  document.getElementById('btnGoToDay').style.display      = 'none';
  document.getElementById('nightNumRow').style.display     = '';

  switchPhase('night');
  renderNightStep();
}

function renderNightStep() {
  const step = NIGHT_STEPS[nightState.stepIdx];

  document.getElementById('nightStepLabel').textContent =
    `Просыпается ${step.label}`;
  document.getElementById('btnNightNext').textContent =
    nightState.stepIdx < NIGHT_STEPS.length - 1
      ? `Далее: ${NIGHT_STEPS[nightState.stepIdx + 1].label} ▶`
      : 'Итоги ночи ▶';

  nightState.selectedSeat = null;
  nightState.stepDone     = false;

  const stepPlayerAlive = isCurrentStepPlayerAlive();

  // ✅ Если игрок роли мёртв — сразу разблокируем, иначе блокируем
  document.getElementById('btnNightNext').disabled = stepPlayerAlive;

  renderNightList();
  renderNightNumRow(stepPlayerAlive);
  startNightTimer(step.seconds);
}

// ── Список игроков ───────────────────────────────────────────
function renderNightList() {
  const ul = document.getElementById('nightList');
  ul.innerHTML = '';

  const step    = NIGHT_STEPS[nightState.stepIdx];
  const isMafia = step.key === 'mafia';

  dayState.players.forEach(p => {
    const li = document.createElement('li');
    li.className = 'night-player-item';

    if (!p.alive) li.classList.add('eliminated');

    if (!nightState.isDebrief && isMafia &&
        (p.role === 'МАФ' || p.role === 'ДОН')) {
      li.classList.add('mafia-team');
    }

    const bg = nightState.bgMap[p.seat];
    if (bg === 'night-killed') li.classList.add('night-killed');

    if (nightState.flashMap[p.seat]) {
      li.classList.add(nightState.flashMap[p.seat]);
    }

    if (!nightState.isDebrief && nightState.selectedSeat === p.seat) {
      li.classList.add('night-selected');
    }

    const roleKey = Object.keys(ROLES_CONFIG)
      .find(k => ROLES_CONFIG[k].short === p.role) || '';
    const roleClass = roleKey ? `role-tag--${roleKey}` : '';

    li.innerHTML = `
      <span class="night-seat-num">${p.seat}</span>
      <span class="night-seat-name">${p.name}</span>
      <div class="night-role-slot">
        ${roleClass
          ? `<span class="role-tag ${roleClass}">${p.role}</span>`
          : ''}
      </div>
    `;

    ul.appendChild(li);
  });

  nightState.flashMap = {};
}

// ── Числовой ряд ─────────────────────────────────────────────
function renderNightNumRow(actionsAllowed = true) {
  const row = document.getElementById('nightNumRow');
  row.innerHTML = '';

  dayState.players.forEach(p => {
    const btn = document.createElement('button');
    btn.className   = 'night-num-btn';
    btn.textContent = p.seat;

    if (!p.alive) btn.classList.add('num-eliminated');
    if (nightState.selectedSeat === p.seat) btn.classList.add('num-selected');

    // ✅ Если носитель роли мёртв — все кнопки заблокированы
    if (!actionsAllowed) {
      btn.disabled = true;
      btn.classList.add('num-disabled');
    } else {
      btn.addEventListener('click', () => handleNightNumClick(p.seat));
    }

    row.appendChild(btn);
  });

  // Кнопка отмены
  const cancel = document.createElement('button');
  cancel.className   = 'night-num-cancel';
  cancel.textContent = '✕';
  cancel.title       = 'Отмена';
  if (!actionsAllowed) {
    cancel.disabled = true;
  } else {
    cancel.addEventListener('click', () => cancelNightSelection());
  }
  row.appendChild(cancel);
}

// ── Отмена выбора ────────────────────────────────────────────
function cancelNightSelection() {
  if (nightState.selectedSeat === null) return;

  const step = NIGHT_STEPS[nightState.stepIdx];
  cancelNightStepAction(step.key, nightState.selectedSeat);

  nightState.selectedSeat = null;
  nightState.stepDone     = false;
  document.getElementById('btnNightNext').disabled = true;

  renderNightList();
  renderNightNumRow();
}

function cancelNightStepAction(stepKey, seat) {
  switch (stepKey) {
    case 'mafia': {
      nightState.killedBySeat      = null;
      nightState.nightKilled[seat] = false;
      delete nightState.bgMap[seat];
      break;
    }
    case 'don': {
      nightState.donChecked = null;
      delete nightState.bgMap[seat];
      break;
    }
    case 'sheriff': {
      nightState.sheriffChecked = null;
      delete nightState.bgMap[seat];
      break;
    }
    case 'maniac': {
      nightState.killedByManiac    = null;
      nightState.nightKilled[seat] = false;
      delete nightState.bgMap[seat];
      break;
    }
    case 'doctor': {
      const wasKilledByMafia  = nightState.killedBySeat   === seat;
      const wasKilledByManiac = nightState.killedByManiac === seat;
      nightState.healedByDoc  = null;
      if (wasKilledByMafia || wasKilledByManiac) {
        nightState.nightKilled[seat] = true;
        nightState.bgMap[seat]       = 'night-killed';
      }
      break;
    }
    case 'beauty': {
      const beautyPlayer    = dayState.players.find(p => p.role === 'КРА');
      const beautyWasKilled = beautyPlayer
        ? !!nightState.nightKilled[beautyPlayer.seat] : false;

      if (!beautyWasKilled) {
        const wasKilled = nightState.killedBySeat   === seat ||
                          nightState.killedByManiac === seat;
        if (wasKilled) {
          nightState.nightKilled[seat] = true;
          nightState.bgMap[seat]       = 'night-killed';
        } else {
          delete nightState.bgMap[seat];
        }
      } else {
        nightState.nightKilled[seat] = false;
        delete nightState.bgMap[seat];
      }
      nightState.beautyTarget = null;
      break;
    }
  }
}

// ── Нажатие на номер ─────────────────────────────────────────
function handleNightNumClick(seat) {
  const step = NIGHT_STEPS[nightState.stepIdx];

  if (nightState.selectedSeat === seat) {
    cancelNightSelection();
    return;
  }

  if (nightState.selectedSeat !== null) {
    cancelNightStepAction(step.key, nightState.selectedSeat);
  }

  nightState.selectedSeat = seat;

  const target = dayState.players.find(p => p.seat === seat);
  if (!target) return;

  applyNightStepAction(step.key, seat, target);

  nightState.stepDone = true;
  document.getElementById('btnNightNext').disabled = false;

  renderNightList();
  renderNightNumRow();
}

function isCurrentStepPlayerAlive() {
  const step = NIGHT_STEPS[nightState.stepIdx];

  // Маппинг ключа шага → короткое название роли
  const stepRoleMap = {
    mafia:   ['МАФ', 'ДОН'],  // хотя бы один живой мафиози
    don:     ['ДОН'],
    sheriff: ['ШЕР'],
    maniac:  ['МАН'],
    doctor:  ['ДОК'],
    beauty:  ['КРА'],
  };

  const roles = stepRoleMap[step.key];
  if (!roles) return true;

  // Для мафии — достаточно одного живого
  return dayState.players.some(
    p => p.alive && roles.includes(p.role)
  );
}

function applyNightStepAction(stepKey, seat, target) {
  switch (stepKey) {
    case 'mafia': {
      nightState.killedBySeat      = seat;
      nightState.nightKilled[seat] = true;
      nightState.bgMap[seat]       = 'night-killed';
      nightState.flashMap[seat]    = 'flash-red';
      break;
    }
    case 'don': {
      nightState.donChecked     = seat;
      nightState.flashMap[seat] = target.role === 'ШЕР'
        ? 'flash-red' : 'flash-green';
      break;
    }
    case 'sheriff': {
      nightState.sheriffChecked = seat;
      const isBlack     = target.role === 'МАФ' || target.role === 'ДОН';
      const hasMafia    = dayState.players.some(
        p => p.alive && (p.role === 'МАФ' || p.role === 'ДОН')
      );
      const maniacIsBlack = target.role === 'МАН' && !hasMafia;
      nightState.flashMap[seat] = (isBlack || maniacIsBlack)
        ? 'flash-green' : 'flash-red';
      break;
    }
    case 'maniac': {
      nightState.killedByManiac    = seat;
      nightState.nightKilled[seat] = true;
      nightState.bgMap[seat]       = 'night-killed';
      nightState.flashMap[seat]    = 'flash-red';
      break;
    }
    case 'doctor': {
      nightState.healedByDoc = seat;
      if (nightState.nightKilled[seat]) {
        nightState.nightKilled[seat] = false;
        delete nightState.bgMap[seat];
      }
      nightState.flashMap[seat] = 'flash-green';
      break;
    }
    case 'beauty': {
      nightState.beautyTarget = seat;
      const beautyPlayer = dayState.players.find(p => p.role === 'КРА');
      const beautyKilled = beautyPlayer
        ? !!nightState.nightKilled[beautyPlayer.seat] : false;

      if (beautyKilled) {
        const docHealed = nightState.healedByDoc === seat;
        if (!docHealed) {
          nightState.nightKilled[seat] = true;
          nightState.bgMap[seat]       = 'night-killed';
          nightState.flashMap[seat]    = 'flash-red';
        } else {
          nightState.flashMap[seat] = 'flash-green';
        }
      } else {
        if (nightState.nightKilled[seat]) {
          nightState.nightKilled[seat] = false;
          delete nightState.bgMap[seat];
        }
        nightState.flashMap[seat] = 'flash-green';
      }
      break;
    }
  }
}

// ── Итоги ночи ────────────────────────────────────────────────
function startNightDebrief() {
  nightState.isDebrief = true;

  Object.entries(nightState.nightKilled).forEach(([seat, killed]) => {
    if (killed) {
      const p = dayState.players.find(p => p.seat === +seat);
      if (p) p.nightDead = true;
    }
  });

  Object.keys(nightState.bgMap).forEach(seat => {
    if (nightState.bgMap[seat] !== 'night-killed') {
      delete nightState.bgMap[seat];
    }
  });
  nightState.flashMap = {};

  document.getElementById('nightNumRow').style.display     = 'none';
  document.getElementById('btnNightNext').style.display    = 'none';
  document.getElementById('btnNightDebrief').style.display = 'block';
  document.getElementById('nightStepLabel').textContent    = 'Город просыпается';

  renderNightList();
}

// ── Таймер ночи ──────────────────────────────────────────────
function startNightTimer(seconds) {
  clearInterval(nightState.timerInterval);
  nightState.timerSec     = seconds;
  nightState.timerRunning = true;
  renderNightTimer();

  nightState.timerInterval = setInterval(() => {
    nightState.timerSec--;
    renderNightTimer();
    if (nightState.timerSec <= 0) {
      clearInterval(nightState.timerInterval);
      nightState.timerRunning = false;
      renderNightTimer();

      // ✅ Разблокируем в любом случае после таймера
      document.getElementById('btnNightNext').disabled = false;
    }
  }, 1000);
}

function renderNightTimer() {
  const el = document.getElementById('nightTimer');
  el.textContent = formatTime(nightState.timerSec);
  el.classList.toggle('timer-warn',
    nightState.timerSec <= WARN_SECONDS &&
    nightState.timerSec > 0 &&
    nightState.timerRunning);
  el.classList.toggle('timer-done', nightState.timerSec === 0);
}

function advanceNightStep() {
  clearInterval(nightState.timerInterval);
  nightState.timerRunning = false;

  if (nightState.stepIdx < NIGHT_STEPS.length - 1) {
    nightState.stepIdx++;
    renderNightStep();
  } else {
    startNightDebrief();
  }
}

// ── Последнее слово убитых ────────────────────────────────────
function startLastWords() {
  const deadThisNight = dayState.players
    .filter(p => p.nightDead)
    .sort((a, b) => a.seat - b.seat);

  if (deadThisNight.length === 0) {
    finishNightAndGoDay();
    return;
  }

  nightState.lastWordsQueue = [...deadThisNight];
  nightState.lastWordsIdx   = 0;
  document.getElementById('nightStepLabel').textContent = 'Последнее слово';

  renderLastWordSpeaker();
}

function renderLastWordSpeaker() {
  const queue = nightState.lastWordsQueue;
  const idx   = nightState.lastWordsIdx;

  if (idx >= queue.length) {
    finishNightAndGoDay();
    return;
  }

  const p = queue[idx];
  document.getElementById('nightStepLabel').textContent =
    `Последнее слово — #${p.seat} ${p.name}`;

  document.getElementById('btnNightDebrief').style.display = 'none';

  const btn = document.getElementById('btnLastWord');
  btn.style.display         = 'block';
  btn.style.backgroundColor = ''; // сброс
  btn.style.color           = ''; // сброс
  btn.textContent           = '▶ Речь';
  btn.className             = 'btn btn-success btn-large'; // зелёный
  btn.onclick = () => startLastWordTimer(p);
}

function startLastWordTimer(p) {
  const btn = document.getElementById('btnLastWord');
  btn.textContent           = '⏭ Далее';
  btn.className             = 'btn btn-large';
  btn.style.backgroundColor = '#f0c040'; // жёлтый
  btn.style.color           = '#000';    // чёрный текст
  btn.onclick = () => {
    clearInterval(nightState.timerInterval);
    nightState.lastWordsIdx++;
    renderLastWordSpeaker();
  };
  startNightTimer(SPEECH_SECONDS);
}

// ── Финал ночи: переход в день ────────────────────────────────
function finishNightAndGoDay() {
  dayState.players.forEach(p => {
    if (p.nightDead) {
      p.alive     = false;
      p.nightDead = false;
      p.eliminationReason = 'night';
      console.log('☀ finishNightAndGoDay, nightState.round =', nightState.round);
    }
  });

  const nextRound = nightState.round;

  document.getElementById('btnLastWord').style.display = 'none';
  document.getElementById('btnGoToDay').style.display  = 'block';
  document.getElementById('btnGoToDay').textContent    = `${nextRound} День ▶`;
  document.getElementById('btnGoToDay').onclick = () => {
    startDayFromNight(nextRound);
  };
}

function bindNightEvents() {
  document.getElementById('btnNightNext')
    .addEventListener('click', advanceNightStep);

  document.getElementById('btnNightDebrief')
    .addEventListener('click', startLastWords);
}

// ════════════════════════════════════════════════════════════
//  МОДАЛЬНЫЕ ОКНА
// ════════════════════════════════════════════════════════════

let confirmCallback = null;

function openConfirm(text, onYes) {
  document.getElementById('confirmText').textContent = text;
  confirmCallback = onYes;
  document.getElementById('confirmModal').classList.add('open');
}

document.getElementById('confirmYes').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  document.getElementById('confirmYes').textContent  = 'Да';
  document.getElementById('confirmNo').style.display = '';
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});

document.getElementById('confirmNo').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  document.getElementById('confirmYes').textContent  = 'Да';
  document.getElementById('confirmNo').style.display = '';
  confirmCallback = null;
});

function openKickModal() {
  document.getElementById('kickInput').value = '';
  document.getElementById('kickModal').classList.add('open');
}

document.getElementById('kickConfirmBtn').addEventListener('click', () => {
  const num    = parseInt(document.getElementById('kickInput').value);
  const player = dayState.players.find(p => p.seat === num);
  if (!player) { alert('Игрок не найден'); return; }
  document.getElementById('kickModal').classList.remove('open');
  openConfirm(`Удалить #${player.seat} ${player.name}?`, () => {
    eliminatePlayer(dayState.players.indexOf(player), 'manual');
  });
});

document.getElementById('kickCancelBtn').addEventListener('click', () => {
  document.getElementById('kickModal').classList.remove('open');
});

// ════════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ════════════════════════════════════════════════════════════

function switchPhase(newPhase) {
  document.querySelectorAll('.phase')
    .forEach(el => el.classList.remove('active'));
  const next = document.getElementById(`phase-${newPhase}`);
  if (next) {
    next.classList.add('active');
    GameState.phase = newPhase;
    updateGameMenu(newPhase);
  } else {
    showToast(`Фаза "${newPhase}" в разработке`, 'info');
  }
}

function saveGameState() {
  localStorage.setItem('gameState', JSON.stringify({
    currentGameNum: GameState.currentGameNum,
    currentSeating: GameState.currentSeating,
    roles:          GameState.roles,
    phase:          GameState.phase,
  }));
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className   = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function updateGameMenu(phase) {
  const component = document.getElementById('gameMenuComponent');
  component.style.display = MENU_PHASES.includes(phase) ? 'block' : 'none';
  document.getElementById('gameNumberDisplay').textContent =
    GameState.currentGameNum;
}

// ═══════════════════════════════════════════════════
//  СОСТОЯНИЕ ГОЛОСОВАНИЯ
// ═══════════════════════════════════════════════════

const voteState = {
  round:             1,      // 1 = основное, 2 = попил
  candidates:        [],     // { seat, name, votes, nomineeOrder }
  currentIdx:        0,
  totalVoters:       0,
  usedVotes:         0,
  runoffCandidates:  [],     // кандидаты попила
  runoffSpeechIdx:   0,
  timerInterval:     null,
  timerSeconds:      0,
  lastWordPlayers:   [],
  lastWordIdx:       0,
  lastWordStarted:   false,
  showRoles:         false,
};

// ═══════════════════════════════════════════════════
//  ВХОД В ФАЗУ ГОЛОСОВАНИЯ (основное)
// ═══════════════════════════════════════════════════

function enterVotePhase() {
  voteState.round            = 1;
  voteState.currentIdx       = 0;
  voteState.usedVotes        = 0;
  voteState.runoffCandidates = [];
  voteState.runoffSpeechIdx  = 0;
  voteState.showRoles        = false;

  // Собираем уникальных кандидатов — тех, на кого голосовали
  const nominatedSeats = [...new Set(
    dayState.players
      .filter(p => p.alive && p.nominee !== null)
      .map(p => p.nominee)
  )];

  voteState.candidates = nominatedSeats
    .map(seat => {
      const target = dayState.players.find(p => p.seat === seat);
      return target
        ? { seat: target.seat, name: target.name, votes: 0,
            nomineeOrder: target.nomineeOrder }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.nomineeOrder ?? 999) - (b.nomineeOrder ?? 999));

  voteState.totalVoters = dayState.players.filter(p => p.alive).length;

  if (voteState.candidates.length === 0) {
    openSleepModal();
    return;
  }

  switchPhase('vote');
  resetVoteUI();

  document.getElementById('votePhaseTitle').textContent =
    `${dayState.round} ГОЛОСОВАНИЕ`;
  document.getElementById('voteGameTitle').textContent =
    GameState.evening?.title || 'Мафия-клуб';
}

// ═══════════════════════════════════════════════════
//  СБРОС UI ФАЗЫ ГОЛОСОВАНИЯ
// ═══════════════════════════════════════════════════

function resetVoteUI() {
  // Показываем нужные элементы
  document.getElementById('voteNumRow').style.display       = '';
  document.getElementById('btnVoteCancel').style.display    = '';
  document.getElementById('btnVoteNext').style.display      = 'block';
  document.getElementById('btnRunoffSpeech').style.display  = 'none';
  document.getElementById('btnRunoffVote').style.display    = 'none';
  document.getElementById('btnVoteLastWord').style.display  = 'none';
  document.getElementById('btnVoteDone').style.display      = 'none';
  document.getElementById('voteTimerWrap').style.display    = 'none';

  const bigNum = document.getElementById('voteBigNum');
  if (bigNum) {
    bigNum.style.display  = '';
    bigNum.style.fontSize = '';
  }

  renderVoteList();
  renderVoteBigNum();
  renderVoteNumRow();
  updateVoteButtons();
}

// ═══════════════════════════════════════════════════
//  СПИСОК ИГРОКОВ
// ═══════════════════════════════════════════════════

function renderVoteList() {
  const ul = document.getElementById('voteList');
  if (!ul) return;
  ul.innerHTML = '';

  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const alive   = dayState.players.filter(p => p.alive);
  const dead    = dayState.players.filter(p => !p.alive);
  const ordered = [...alive, ...dead];

  ordered.forEach(p => {
    const idx       = dayState.players.indexOf(p);
    const candidate = candidates.find(c => c.seat === p.seat);
    const isCand    = !!candidate;

    const li = document.createElement('li');
    li.className = 'day-player-item';
    if (!p.alive) li.classList.add('eliminated');
    if (isCand)   li.classList.add('candidate-gold');

    const roleClass = roleTagClass(p.role);

    li.innerHTML = `
      <span class="day-seat-num">${p.seat}</span>
      <span class="day-seat-name">${p.name}</span>

      <div class="day-role-slot">
        ${voteState.showRoles && roleClass
          ? `<span class="role-tag ${roleClass} day-role-tag">${p.role}</span>`
          : ''}
      </div>

      <div class="foul-cell">
        <span class="foul-cell-label">ФОЛ</span>
        <div class="foul-cell-controls">
          <button class="foul-btn" data-idx="${idx}" data-action="foul-dec">−</button>
          <div class="foul-circle ${p.fouls >= 3 ? 'foul-warn' : ''}">${p.fouls}</div>
          <button class="foul-btn" data-idx="${idx}" data-action="foul-inc">+</button>
        </div>
      </div>

      <div class="extra-cell">
        <span class="extra-cell-label">ДОП</span>
        <div class="extra-cell-controls">
          <button class="extra-btn" data-idx="${idx}" data-action="extra-dec">−</button>
          <span class="extra-value">${p.extra}</span>
          <button class="extra-btn" data-idx="${idx}" data-action="extra-inc">+</button>
        </div>
      </div>

      <div class="nominated-cell ${isCand ? 'has-nominee candidate-votes' : ''}">
        ${isCand
          ? `<span id="voteCount-${p.seat}">${candidate.votes || ''}</span>`
          : ''}
      </div>
    `;

    ul.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════
//  КРУПНЫЙ НОМЕР КАНДИДАТА
// ═══════════════════════════════════════════════════

function renderVoteBigNum() {
  const bigNum  = document.getElementById('voteBigNum');
  const bigName = document.getElementById('voteBigName');
  if (!bigNum || !bigName) return;

  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const current = candidates[voteState.currentIdx];
  if (current) {
    bigNum.textContent  = `#${current.seat}`;
    bigName.textContent = current.name;
  } else {
    bigNum.textContent  = '—';
    bigName.textContent = '';
  }
}

// ═══════════════════════════════════════════════════
//  ЧИСЛОВОЙ РЯД
// ═══════════════════════════════════════════════════

function renderVoteNumRow() {
  const row = document.getElementById('voteNumRow');
  if (!row) return;

  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const usedVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const remaining = voteState.totalVoters - usedVotes;

  row.innerHTML = '';

  for (let i = 0; i <= remaining; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className   = 'vote-num-btn';
    btn.onclick     = () => onVoteNumClick(i);
    row.appendChild(btn);
  }
}

// ═══════════════════════════════════════════════════
//  КЛИК ПО ЧИСЛУ
// ═══════════════════════════════════════════════════

function onVoteNumClick(n) {
  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const c = candidates[voteState.currentIdx];
  if (!c) return;

  // Сколько голосов уже у других кандидатов
  const usedByOthers = candidates.reduce((sum, cand, idx) => {
    return idx !== voteState.currentIdx ? sum + (cand.votes || 0) : sum;
  }, 0);

  const maxForThis = voteState.totalVoters - usedByOthers;
  if (n > maxForThis) return;

  c.votes = n;

  const isLast = voteState.currentIdx >= candidates.length - 1;

  if (isLast) {
    // Последнему автоматически добавляем остаток
    const totalUsed = candidates.reduce((s, cand) => s + (cand.votes || 0), 0);
    const leftover  = voteState.totalVoters - totalUsed;
    if (leftover > 0) c.votes += leftover;
    voteState.currentIdx++;
  } else {
    voteState.currentIdx++;
  }

  renderVoteBigNum();
  renderVoteNumRow();
  renderVoteList();
  updateVoteButtons();
}

// ═══════════════════════════════════════════════════
//  ОТМЕНА ПОСЛЕДНЕГО ГОЛОСА
// ═══════════════════════════════════════════════════

function cancelLastVote() {
  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  if (voteState.currentIdx <= 0) return;

  voteState.currentIdx--;
  const c = candidates[voteState.currentIdx];
  if (c) c.votes = 0;

  renderVoteBigNum();
  renderVoteNumRow();
  renderVoteList();
  updateVoteButtons();
}

// ═══════════════════════════════════════════════════
//  КНОПКИ: текст и disabled
// ═══════════════════════════════════════════════════

function updateVoteButtons() {
  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const usedVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const allUsed   = usedVotes >= voteState.totalVoters;

  const btnNext   = document.getElementById('btnVoteNext');
  const btnCancel = document.getElementById('btnVoteCancel');

  if (btnNext) {
    // В попиле кнопка называется "Результат"
    btnNext.textContent = voteState.round === 2
      ? 'Результат'
      : 'Закончить голосование';
    btnNext.disabled    = !allUsed;
  }

  if (btnCancel) {
    btnCancel.disabled = usedVotes <= 0;
  }
}

// ═══════════════════════════════════════════════════
//  ЗАВЕРШЕНИЕ ГОЛОСОВАНИЯ
// ═══════════════════════════════════════════════════

function finishVoting() {
  const candidates = voteState.round === 1
    ? voteState.candidates
    : voteState.runoffCandidates;

  const maxVotes = Math.max(...candidates.map(c => c.votes || 0));
  const winners  = candidates.filter(c => c.votes === maxVotes);

  if (winners.length > 1) {
    if (voteState.round === 1) {
      // Ничья в основном — идём в попил
      startRunoffSpeeches(winners);
    } else {
      // Ничья в попиле — модалка
      showRunoffDrawModal(winners);
    }
  } else {
    // Один победитель
    startLastWord([winners[0]]);
  }
}

// ═══════════════════════════════════════════════════
//  ПОПИЛ: РЕЧИ
//  Игроки говорят по очереди, после последнего —
//  кнопка "Голосование"
// ═══════════════════════════════════════════════════

function startRunoffSpeeches(runoffPlayers) {
  voteState.runoffCandidates   = runoffPlayers.map(c => ({ ...c, votes: 0 }));
  voteState.runoffSpeechIdx    = 0;

  // Скрываем лишнее
  document.getElementById('voteNumRow').style.display       = 'none';
  document.getElementById('btnVoteCancel').style.display    = 'none';
  document.getElementById('btnVoteNext').style.display      = 'none';
  document.getElementById('btnRunoffVote').style.display    = 'none';
  document.getElementById('btnVoteLastWord').style.display  = 'none';
  document.getElementById('voteTimerWrap').style.display    = 'none';

  // Показываем кнопку речи попила
  const btn = document.getElementById('btnRunoffSpeech');
  btn.style.display = 'block';
  btn.textContent   = '▶ Речь';

  // Показываем первого кандидата
  showRunoffSpeechCandidate(0);
  setupRunoffSpeechBtn();
}

function showRunoffSpeechCandidate(idx) {
  const candidate = voteState.runoffCandidates[idx];
  if (!candidate) return;

  const bigNum  = document.getElementById('voteBigNum');
  const bigName = document.getElementById('voteBigName');

  if (bigNum) {
    bigNum.style.display  = '';
    bigNum.style.fontSize = '';
    bigNum.textContent    = `#${candidate.seat}`;
  }
  if (bigName) bigName.textContent = candidate.name;
}

function setupRunoffSpeechBtn() {
  const btn = document.getElementById('btnRunoffSpeech');
  if (!btn) return;

  // Состояния кнопки:
  // 'idle'    — показывает номер, ждём нажатия "▶ Речь"
  // 'running' — таймер идёт, кнопка "⏭ Далее" (или "Голосование")

  btn.onclick = () => {
    const idx = voteState.runoffSpeechIdx;
    const isLast = idx >= voteState.runoffCandidates.length - 1;

    if (btn.dataset.state !== 'running') {
      // Запускаем таймер речи
      btn.dataset.state = 'running';
      document.getElementById('voteTimerWrap').style.display = 'block';
      startVoteTimer(SPEECH_SECONDS, () => {
        // По окончании таймера меняем текст кнопки
        if (isLast) {
          btn.textContent = '🗳 Голосование';
        } else {
          btn.textContent = '⏭ Далее';
        }
      });

      // Сразу меняем текст
      if (isLast) {
        btn.textContent = '🗳 Голосование';
      } else {
        btn.textContent = '⏭ Далее';
      }

    } else {
      // Останавливаем таймер
      clearInterval(voteState.timerInterval);
      document.getElementById('voteTimerWrap').style.display = 'none';
      btn.dataset.state = 'idle';

      if (isLast) {
        // Последний говорящий закончил — начинаем голосование попила
        startRunoffVoting();
      } else {
        // Переходим к следующему
        voteState.runoffSpeechIdx++;
        const nextIsLast =
          voteState.runoffSpeechIdx >= voteState.runoffCandidates.length - 1;
        showRunoffSpeechCandidate(voteState.runoffSpeechIdx);
        btn.textContent = '▶ Речь';
      }
    }
  };

  btn.dataset.state = 'idle';
}

// ═══════════════════════════════════════════════════
//  ПОПИЛ: ГОЛОСОВАНИЕ
// ═══════════════════════════════════════════════════

function startRunoffVoting() {
  voteState.round      = 2;
  voteState.currentIdx = 0;

  // Сбрасываем голоса кандидатов попила
  voteState.runoffCandidates.forEach(c => { c.votes = 0; });

  voteState.totalVoters = dayState.players.filter(p => p.alive).length;

  // Показываем элементы голосования
  document.getElementById('btnRunoffSpeech').style.display  = 'none';
  document.getElementById('voteTimerWrap').style.display    = 'none';
  document.getElementById('voteNumRow').style.display       = '';
  document.getElementById('btnVoteCancel').style.display    = '';
  document.getElementById('btnVoteNext').style.display      = 'block';

  const bigNum = document.getElementById('voteBigNum');
  if (bigNum) {
    bigNum.style.display  = '';
    bigNum.style.fontSize = '';
  }

  renderVoteList();
  renderVoteBigNum();
  renderVoteNumRow();
  updateVoteButtons();

  document.getElementById('votePhaseTitle').textContent =
    `${dayState.round} ГОЛОСОВАНИЕ (ПОПИЛ)`;
}

// ═══════════════════════════════════════════════════
//  НИЧЬЯ В ПОПИЛЕ — МОДАЛКА
// ═══════════════════════════════════════════════════

function showRunoffDrawModal(players) {
  const modal = document.getElementById('runoffDrawModal');
  if (modal) modal.style.display = 'flex';

  document.getElementById('runoffDrawYes').onclick = () => {
    modal.style.display = 'none';
    // Даём всем прощальные речи, потом выбывают
    startLastWord(players);
  };

  document.getElementById('runoffDrawNo').onclick = () => {
    modal.style.display = 'none';
    // Все остаются — сразу к ночи
    showNightComingModal();
  };
}

// ═══════════════════════════════════════════════════
//  ПОСЛЕДНЕЕ СЛОВО
//  players = массив { seat, name, ... }
// ═══════════════════════════════════════════════════

function startLastWord(players) {
  voteState.lastWordPlayers = players;
  voteState.lastWordIdx     = 0;
  voteState.lastWordStarted = false;

  // Прячем лишнее
  document.getElementById('btnVoteNext').style.display      = 'none';
  document.getElementById('btnRunoffVote').style.display    = 'none';
  document.getElementById('btnRunoffSpeech').style.display  = 'none';
  document.getElementById('voteNumRow').style.display       = 'none';
  document.getElementById('btnVoteCancel').style.display    = 'none';
  document.getElementById('voteTimerWrap').style.display    = 'none';

  // Показываем первого игрока
  const p = players[0];
  const bigNum  = document.getElementById('voteBigNum');
  const bigName = document.getElementById('voteBigName');
  if (bigNum) {
    bigNum.style.display  = '';
    bigNum.style.fontSize = '';
    bigNum.textContent    = `#${p.seat}`;
  }
  if (bigName) bigName.textContent = p.name;

  const btnLW = document.getElementById('btnVoteLastWord');
  btnLW.style.display = 'block';
  btnLW.textContent   = '▶ Последнее слово';
  btnLW.className     = 'btn btn-primary btn-large';
}

function showNextLastWord() {
  const p = voteState.lastWordPlayers[voteState.lastWordIdx];

  if (!p) {
    // Все речи закончены
    clearInterval(voteState.timerInterval);
    document.getElementById('voteTimerWrap').style.display   = 'none';
    document.getElementById('btnVoteLastWord').style.display = 'none';

    // Выбываем
    eliminatePlayers(voteState.lastWordPlayers);
    renderVoteList();

    // Модалка "Город засыпает"
    showNightComingModal();
    return;
  }

  const bigNum  = document.getElementById('voteBigNum');
  const bigName = document.getElementById('voteBigName');
  if (bigNum) {
    bigNum.style.display = '';
    bigNum.textContent   = `#${p.seat}`;
  }
  if (bigName) bigName.textContent = p.name;

  // Запускаем таймер
  document.getElementById('voteTimerWrap').style.display = 'block';
  startVoteTimer(SPEECH_SECONDS, () => {});

  const btnLW  = document.getElementById('btnVoteLastWord');
  const isLast = voteState.lastWordIdx >= voteState.lastWordPlayers.length - 1;

  if (isLast) {
    btnLW.textContent = '🌙 Город засыпает';
    btnLW.className   = 'btn btn-success btn-large';
  } else {
    btnLW.textContent = '⏭ Далее';
    btnLW.className   = 'btn btn-primary btn-large';
  }
}

// ═══════════════════════════════════════════════════
//  ВЫБЫВАНИЕ ИГРОКОВ
// ═══════════════════════════════════════════════════

function eliminatePlayers(players) {
  players.forEach(p => {
    const target = dayState.players.find(pl => pl.seat === p.seat);
    if (target) {
      target.alive = false;
      target.eliminationReason = 'vote';
    }
  });
}

// ═══════════════════════════════════════════════════
//  ТАЙМЕР ГОЛОСОВАНИЯ
// ═══════════════════════════════════════════════════

function startVoteTimer(seconds, onEnd) {
  clearInterval(voteState.timerInterval);
  voteState.timerSeconds = seconds;

  const el = document.getElementById('voteTimer');

  const tick = () => {
    if (el) {
      const m = Math.floor(voteState.timerSeconds / 60);
      const s = voteState.timerSeconds % 60;
      el.textContent = `${m}:${s.toString().padStart(2, '0')}`;

      el.classList.toggle('timer-warn',
        voteState.timerSeconds <= WARN_SECONDS && voteState.timerSeconds > 0);
      el.classList.toggle('timer-done', voteState.timerSeconds <= 0);
    }

    if (voteState.timerSeconds <= 0) {
      clearInterval(voteState.timerInterval);
      if (onEnd) onEnd();
      return;
    }
    voteState.timerSeconds--;
  };

  tick();
  voteState.timerInterval = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════
//  МОДАЛКА — НАСТУПАЕТ НОЧЬ
// ═══════════════════════════════════════════════════

function showNightComingModal() {
  clearInterval(voteState.timerInterval);
  const modal = document.getElementById('nightComingModal');
  if (modal) modal.style.display = 'flex';
}

// ═══════════════════════════════════════════════════
//  НАВЕШИВАЕМ СОБЫТИЯ (один раз при загрузке)
// ═══════════════════════════════════════════════════

function initVotePhase() {

  // Клики по фолам/допам в списке голосования
  document.getElementById('voteList')
    ?.addEventListener('click', handleDayListClick);

  // Назад
  document.getElementById('btnVoteBack')?.addEventListener('click', () => {
    switchPhase('phase-day');
  });

  // Закончить голосование / Результат
  document.getElementById('btnVoteNext')?.addEventListener('click', () => {
    finishVoting();
  });

  // Отмена последнего голоса
  document.getElementById('btnVoteCancel')?.addEventListener('click', () => {
    cancelLastVote();
  });

  // Последнее слово
  document.getElementById('btnVoteLastWord')?.addEventListener('click', () => {
    clearInterval(voteState.timerInterval);

    if (!voteState.lastWordStarted) {
      voteState.lastWordStarted = true;
      showNextLastWord(); // idx = 0
    } else {
      voteState.lastWordIdx++;
      showNextLastWord();
    }
  });

  // Наступает ночь
  document.getElementById('btnNightComing')?.addEventListener('click', () => {
    document.getElementById('nightComingModal').style.display = 'none';
    stopDay();
    startNight(dayState.round + 1);
  });

  // Переключатель ролей
  document.getElementById('btnVoteToggleRoles')?.addEventListener('click', () => {
    voteState.showRoles = !voteState.showRoles;
    const label = document.querySelector('#phase-vote .eye-label');
    const icon  = document.querySelector('#phase-vote .eye-icon');
    if (voteState.showRoles) {
      if (label) label.textContent = 'Роли видны';
      if (icon)  icon.textContent  = '👁';
    } else {
      if (label) label.textContent = 'Роли скрыты';
      if (icon)  icon.textContent  = '🙈';
    }
    renderVoteList();
  });

} // ← конец initVotePhase