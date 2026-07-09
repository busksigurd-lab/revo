// ════════════════════════════════════════════════════════════
//  results.js — Страница результатов вечера
// ════════════════════════════════════════════════════════════

'use strict';

// ── Загрузка данных ──────────────────────────────────────────
function loadResults() {
  const raw = localStorage.getItem('eveningResults');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Состояние страницы ───────────────────────────────────────
const ResultsState = {
  data:        null,   // eveningResults
  activeTab:   'summary', // 'summary' | 'game_1' | 'game_2' ...
  gameNums:    [],     // [1, 2, 3 ...]
};

// ── Инициализация ────────────────────────────────────────────
function initResults() {
  ResultsState.data = loadResults();

  if (!ResultsState.data) {
    document.getElementById('resultsEveningTitle').textContent =
      'Нет данных о вечере';
    document.getElementById('resultsBody').innerHTML =
      '<div class="empty-state">Завершите хотя бы одну игру</div>';
    return;
  }

  const d = ResultsState.data;
  document.getElementById('resultsEveningTitle').textContent =
    d.title || 'Игровой вечер';
  document.getElementById('resultsEveningDate').textContent =
    d.date || '';

  ResultsState.gameNums = Object.keys(d.games)
    .map(Number)
    .sort((a, b) => a - b);

  buildTabsNav();
  renderActiveTab();
  bindResultsEvents();
}

// ── Таб-навигация ────────────────────────────────────────────
function buildTabsNav() {
  const nav = document.getElementById('resultsTabsNav');
  nav.innerHTML = '';

  const tabs = [
    { key: 'summary', label: '📊 Сводная' },
    ...ResultsState.gameNums.map(n => ({
      key:   `game_${n}`,
      label: `Игра ${n}`,
    })),
  ];

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className  = 'results-tab-btn' +
      (tab.key === ResultsState.activeTab ? ' active' : '');
    btn.textContent = tab.label;
    btn.dataset.tab = tab.key;
    btn.addEventListener('click', () => {
      ResultsState.activeTab = tab.key;
      buildTabsNav();
      renderActiveTab();
    });
    nav.appendChild(btn);
  });
}

// ── Роутер рендера ───────────────────────────────────────────
function renderActiveTab() {
  const tab = ResultsState.activeTab;
  if (tab === 'summary') {
    renderSummary();
  } else {
    const num = parseInt(tab.replace('game_', ''), 10);
    renderGameTab(num);
  }
}

// ════════════════════════════════════════════════════════════
//  СВОДНАЯ ТАБЛИЦА
// ════════════════════════════════════════════════════════════
function renderSummary() {
  const body = document.getElementById('resultsBody');
  const data = ResultsState.data;

  // Собираем агрегат по игрокам
  // { name -> { games, wins, totalPoints, roles: {МАФ:n,...} } }
  const agg = {};

  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    if (!game) return;

    game.players.forEach(p => {
      if (!agg[p.name]) {
        agg[p.name] = {
          name:   p.name,
          games:  0,
          wins:   0,
          total:  0,
          roles:  {},
        };
      }
      const a = agg[p.name];
      a.games++;
      if (p.won) a.wins++;
      a.total = Math.round((a.total + p.total) * 1000) / 1000;
      a.roles[p.role] = (a.roles[p.role] || 0) + 1;
    });
  });

  // Сортируем по очкам
  const rows = Object.values(agg)
    .sort((a, b) => b.total - a.total || b.wins - a.wins);

  // Рендер победителей каждой игры
  const winnersHtml = ResultsState.gameNums.map(num => {
  const game = data.games[num];
  // ✅ Если не завершена — показываем статус
  if (!game.finished) {
    return `<div class="results-winner-chip">Игра ${num}: ⏳ не сыграна</div>`;
  }
  const icon = winnerIcon(game.winner);
  return `<div class="results-winner-chip">
    Игра ${num}: ${icon} ${winnerLabel(game.winner)}
  </div>`;
}).join('');

  body.innerHTML = `
    <!-- Победители игр -->
    <div class="card">
      <div class="card-title">🏆 Победители игр</div>
      <div class="results-winners-row">${winnersHtml}</div>
    </div>

    <!-- Сводная таблица -->
    <div class="card results-table-card">
      <div class="card-title">📊 Итоговая таблица</div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-name">Игрок</th>
              <th class="col-games">И</th>
              <th class="col-wins">В</th>
              <th class="col-pts">Очки</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr class="${i === 0 ? 'row-first' : i === 1 ? 'row-second' : i === 2 ? 'row-third' : ''}">
                <td class="col-rank">${rankBadge(i)}</td>
                <td class="col-name">${r.name}</td>
                <td class="col-games">${r.games}</td>
                <td class="col-wins">${r.wins}</td>
                <td class="col-pts"><strong>${r.total}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  ТАБЛИЦА ОДНОЙ ИГРЫ
// ════════════════════════════════════════════════════════════
function renderGameTab(num) {
  const body = document.getElementById('resultsBody');
  const game = ResultsState.data?.games[num];

  if (!game) {
    body.innerHTML = '<div class="empty-state">Нет данных об этой игре</div>';
    return;
  }

  // ✅ Если игра не завершена — показываем пустую таблицу
  if (!game.finished) {
    const rows = game.players.map(p => `
      <tr>
        <td class="col-seat">${p.seat}</td>
        <td class="col-name">${p.name}</td>
        <td class="col-role"><span class="role-tag">—</span></td>
        <td class="col-base">—</td>
        <td class="col-extra">—</td>
        <td class="col-pts">—</td>
      </tr>
    `).join('');

    body.innerHTML = `
      <div class="card game-result-card">
        <div class="game-result-winner">⏳ Игра ещё не сыграна</div>
      </div>

      <div class="card results-table-card">
        <div class="card-title">🎮 Игра №${num} — рассадка</div>
        <div class="results-table-wrap">
          <table class="results-table">
            <thead>
              <tr>
                <th class="col-seat">№</th>
                <th class="col-name">Игрок</th>
                <th class="col-role">Роль</th>
                <th class="col-base">База</th>
                <th class="col-extra">Доп</th>
                <th class="col-pts">Итог</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    return;
  }

  // Остальной код для завершённой игры остаётся как был...
  const icon  = winnerIcon(game.winner);
  const label = winnerLabel(game.winner);

  const sorted = [...game.players]
    .sort((a, b) => {
      if (a.won !== b.won) return b.won ? 1 : -1;
      return b.total - a.total;
    });

  const bySeат = [...game.players].sort((a, b) => a.seat - b.seat);

  body.innerHTML = `
    <div class="card game-result-card">
      <div class="game-result-winner">
        ${icon} Победа: <strong>${label}</strong>
      </div>
    </div>

    <div class="card results-table-card">
      <div class="card-title">🎮 Игра №${num}</div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-seat">№</th>
              <th class="col-name">Игрок</th>
              <th class="col-role">Роль</th>
              <th class="col-base">База</th>
              <th class="col-extra">Доп</th>
              <th class="col-pts">Итог</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => `
              <tr class="${p.won ? 'row-winner' : 'row-loser'}">
                <td class="col-seat">${p.seat}</td>
                <td class="col-name">${p.name}</td>
                <td class="col-role">
                  <span class="role-tag ${roleTagClass(p.role)}">${p.role || '—'}</span>
                </td>
                <td class="col-base">${p.base}</td>
                <td class="col-extra">${p.extra > 0 ? '+' + p.extra : p.extra < 0 ? p.extra : '—'}</td>
                <td class="col-pts"><strong>${p.total}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${renderProtocolTable(game, bySeат)}
  `;
}

// ════════════════════════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ════════════════════════════════════════════════════════════

function winnerIcon(team) {
  return { civil: '🕊', mafia: '🔫', maniac: '🔪' }[team] || '❓';
}

function winnerLabel(team) {
  return { civil: 'Мирные', mafia: 'Мафия', maniac: 'Маньяк' }[team] || '?';
}

function rankBadge(i) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return i + 1;
}

function roleTagClass(role) {
  const map = {
    'МАФ': 'role-mafia',
    'ДОН': 'role-don',
    'ШЕР': 'role-sheriff',
    'МИР': 'role-civil',
    'МАН': 'role-maniac',
    'ДОК': 'role-doc',
    'ЛЮБ': 'role-lover',
  };
  return map[role] || 'role-civil';
}

// ════════════════════════════════════════════════════════════
//  ЭКСПОРТ
// ════════════════════════════════════════════════════════════

function exportResults() {
  const data = ResultsState.data;
  if (!data) return;

  let text = `${data.title || 'Вечер'} — ${data.date || ''}\n`;
  text += '═'.repeat(40) + '\n\n';

  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    text += `ИГРА №${num} — победа: ${winnerLabel(game.winner)}\n`;
    text += '─'.repeat(30) + '\n';
    game.players.forEach(p => {
      text += `  [${p.seat}] ${p.name.padEnd(16)} ${p.role.padEnd(4)} ` +
              `${p.won ? 'ПОБЕДА' : 'поражение'} ` +
              `база:${p.base} доп:${p.extra} итог:${p.total}\n`;
    });
    text += '\n';
  });

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mafia-results-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  СОХРАНЕНИЕ В ИСТОРИЮ
// ════════════════════════════════════════════════════════════

function saveToHistory() {
  const data = ResultsState.data;
  if (!data) return;

  const history = JSON.parse(
    localStorage.getItem('mafiaHistory') || '[]'
  );
  history.push({ ...data, savedAt: Date.now() });
  localStorage.setItem('mafiaHistory', JSON.stringify(history));

  showToast('Сохранено в историю ✅');
}

// ── Простой тост ─────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('resultsToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'resultsToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Привязка событий ─────────────────────────────────────────
function bindResultsEvents() {
  document.getElementById('btnExportResults')
    ?.addEventListener('click', exportResults);

  document.getElementById('btnSaveToHistory')
    ?.addEventListener('click', saveToHistory);
}


// ════════════════════════════════════════════════════════════
//  ПРОТОКОЛ ДЕЙСТВИЙ
// ════════════════════════════════════════════════════════════

const PROTO_MAX_DAYS   = 10;
const PROTO_MAX_NIGHTS = 10;

function renderProtocolTable(game, players) {
  const proto = game.protocol;
  if (!proto) return '';

  const nights     = proto.nights     || {};
  const dayActions = proto.dayActions || {};

  // ── Определяем реальное кол-во ночей и дней ──────────────
  let maxNight = 0;
  Object.keys(nights).forEach(k => {
    const n = parseInt(k);
    if (!isNaN(n) && n > maxNight) maxNight = n;
  });
  let maxDay = 0;
  players.forEach(p => {
    Object.keys(dayActions[p.seat] || {}).forEach(k => {
      const d = parseInt(k.replace('d',''));
      if (!isNaN(d) && d > maxDay) maxDay = d;
    });
  });

  // Минимум 7, максимум 10
  const numNights = Math.min(Math.max(maxNight, 7), PROTO_MAX_NIGHTS);
  const numDays   = Math.min(Math.max(maxDay + 1, 7), PROTO_MAX_DAYS);

  // ── Предвычисляем деathInfo ───────────────────────────────
  // deathInfo[seat] = { round, via: 'night'|'vote'|'manual' }
  const deathInfo = {};

  // Сначала собираем удалённых и выголосованных из dayActions
  players.forEach(p => {
    const actions = dayActions[p.seat] || {};
    for (const [key, val] of Object.entries(actions)) {
      const d = parseInt(key.replace('d',''));
      if (val === 'x') {
        deathInfo[p.seat] = { round: d, via: 'vote' };
        break;
      }
      if (val === 'у' || val === 'u') {
        deathInfo[p.seat] = { round: d, via: 'manual' };
        break;
      }
    }
  });

  // Потом ночные смерти (убиты, не спасены)
  players.forEach(p => {
    if (deathInfo[p.seat]) return; // уже знаем
    if (!p.eliminationReason || p.eliminationReason !== 'night') return;

    for (let n = 1; n <= numNights; n++) {
      const night = nights[n] || {};
      const mafiaShot  = night.mafia;
      const maniacShot = night.maniac;
      const doctorSaved = night.doctor;
      const beautyTarget = night.beauty;

      const beautyPlayer = players.find(pl => pl.role === 'КРА');
      const beautyAlive  = beautyPlayer
        ? !isDeadBeforeNight(beautyPlayer.seat, n) : false;

      const shotAny = mafiaShot === p.seat || maniacShot === p.seat;
      const savedByDoc    = doctorSaved === p.seat;
      const savedByBeauty = beautyAlive && beautyTarget === p.seat && shotAny;

      if (shotAny && !savedByDoc && !savedByBeauty) {
        deathInfo[p.seat] = { round: n, via: 'night' };
        break;
      }
    }
  });

  // ── Хелперы живости ──────────────────────────────────────
  function isDeadBeforeNight(seat, nightRound) {
    const d = deathInfo[seat];
    if (!d) return false;
    if (d.via === 'night' && d.round < nightRound) return true;
    if ((d.via === 'vote' || d.via === 'manual') && d.round < nightRound) return true;
    return false;
  }

  function isDeadBeforeDay(seat, dayRound) {
    const d = deathInfo[seat];
    if (!d) return false;
    if (d.via === 'night' && d.round <= dayRound) return true;
    if ((d.via === 'vote' || d.via === 'manual') && d.round < dayRound) return true;
    return false;
  }

  function isDeadOnNight(seat, nightRound) {
    const d = deathInfo[seat];
    return d && d.via === 'night' && d.round === nightRound;
  }

  function isDeadOnDay(seat, dayRound) {
    const d = deathInfo[seat];
    return d && (d.via === 'vote' || d.via === 'manual') && d.round === dayRound;
  }

  // ── Предвычисляем золотые подсветки ──────────────────────
  // donGold[n]    = true если дон проверил шерифа в ночь n
  // sheriffGold[n] = true если шериф сделал чёрную проверку в ночь n
  const donGold     = {};
  const sheriffGold = {};

  for (let n = 1; n <= numNights; n++) {
    const night = nights[n] || {};

    // Дон → шериф?
    if (night.don != null && night.don !== '-') {
      const target = players.find(p => p.seat === night.don);
      if (target && target.role === 'ШЕР') donGold[n] = true;
    }

    // Шериф → чёрный?
    if (night.sheriff != null && night.sheriff !== '-') {
      const target = players.find(p => p.seat === night.sheriff);
      if (target) {
        const isMafOrDon = target.role === 'МАФ' || target.role === 'ДОН';
        const mafAlive   = players.some(p =>
          (p.role === 'МАФ' || p.role === 'ДОН') &&
          !isDeadBeforeNight(p.seat, n)
        );
        const isManiacBlack = target.role === 'МАН' && !mafAlive;
        if (isMafOrDon || isManiacBlack) sheriffGold[n] = true;
      }
    }
  }

  // ── Функция цвета ночной клетки игрока ───────────────────
  function nightCellClass(p, n) {
    const night = nights[n] || {};
    const aliveThisNight = !isDeadBeforeNight(p.seat, n);

    if (!aliveThisNight) return 'pcc-dead';

    const mafiaShot   = night.mafia;
    const maniacShot  = night.maniac;
    const doctorSaved = night.doctor;
    const beautyTarget = night.beauty;

    const beautyPlayer = players.find(pl => pl.role === 'КРА');
    const beautyAliveN = beautyPlayer
      ? !isDeadBeforeNight(beautyPlayer.seat, n) : false;

    const shotAny = mafiaShot === p.seat || maniacShot === p.seat;
    const savedByDoc    = doctorSaved === p.seat;
    const savedByBeauty = beautyAliveN && beautyTarget === p.seat && shotAny;
    const saved = savedByDoc || savedByBeauty;

    if (shotAny && saved)  return 'pcc-saved';
    if (shotAny && !saved) return 'pcc-dead';

    // Золото для дона и шерифа
    if (p.role === 'ДОН' && donGold[n])     return 'pcc-gold';
    if (p.role === 'ШЕР' && sheriffGold[n]) return 'pcc-gold';

    return 'pcc-alive';
  }

  // ── Функция цвета дневной клетки игрока ──────────────────
  function dayCellClass(p, d) {
    if (isDeadBeforeDay(p.seat, d)) return 'pcc-dead';
    const val = (dayActions[p.seat] || {})[`d${d}`];
    if (val === 'x' || val === 'у' || val === 'u') return 'pcc-dead';
    return 'pcc-alive';
  }

  // ── Текст ночной ячейки игрока ────────────────────────────
  function nightCellText(p, n) {
    if (isDeadBeforeNight(p.seat, n)) return '';

    const night = nights[n] || {};
    const roleActMap = {
      'ДОН': night.don,
      'ШЕР': night.sheriff,
      'МАН': night.maniac,
      'ДОК': night.doctor,
      'КРА': night.beauty,
    };

    if (!(p.role in roleActMap)) return ''; // МАФ и МИР — пусто

    const val = roleActMap[p.role];
    if (val === null || val === undefined) return '';
    if (val === '-') return '−';
    return String(val);
  }

  // ── Текст дневной ячейки ──────────────────────────────────
  function dayCellText(p, d) {
    if (isDeadBeforeDay(p.seat, d)) return '';
    const val = (dayActions[p.seat] || {})[`d${d}`];
    if (!val) return '';
    if (val === 'x') return '✕';
    if (val === 'у' || val === 'u') return 'У';
    return String(val);
  }

  // ── Строим колонки: Д0 Н1 Д1 Н2 Д2 ... ──────────────────
  // Чередуем день/ночь начиная с Д0
  const cols = [];
  const total = Math.max(numDays, numNights);
  for (let i = 0; i < total; i++) {
    if (i < numDays)   cols.push({ type: 'day',   idx: i });
    if (i < numNights) cols.push({ type: 'night', idx: i + 1 });
  }

  // ── Заголовок ─────────────────────────────────────────────
  let headHtml = `
    <thead>
      <tr class="proto-header-row">
        <th class="pth pth-num">#</th>
        <th class="pth pth-name">Ник</th>
        <th class="pth pth-role">Роль</th>
  `;
  cols.forEach(c => {
    const label = c.type === 'day' ? `Д${c.idx}` : `Н${c.idx}`;
    const cls   = c.type === 'day' ? 'pth-day' : 'pth-night';
    headHtml += `<th class="pth ${cls}">${label}</th>`;
  });
  headHtml += `</tr></thead>`;

  // ── Строка МАФИЯ ──────────────────────────────────────────
  let mafiaRowHtml = `
    <tr class="proto-row-mafia">
      <td class="ptd ptd-mafia" colspan="3">МАФИЯ</td>
  `;
  cols.forEach(c => {
    if (c.type === 'day') {
      mafiaRowHtml += `<td class="ptd ptd-day pcc-mafia"></td>`;
    } else {
      const shot = nights[c.idx]?.mafia;
      const text = (shot != null && shot !== '-') ? shot : '';
      mafiaRowHtml += `<td class="ptd ptd-night pcc-mafia">${text}</td>`;
    }
  });
  mafiaRowHtml += `</tr>`;

  // ── Строки игроков ────────────────────────────────────────
  let rowsHtml = '';
  players.forEach(p => {
    const isDead = !!deathInfo[p.seat];
    rowsHtml += `
      <tr class="proto-player-row ${isDead ? 'prow-dead' : 'prow-alive'}">
        <td class="ptd ptd-num">${p.seat}</td>
        <td class="ptd ptd-name">${escProto(p.name)}</td>
        <td class="ptd ptd-role">
          <span class="role-tag ${roleTagClass(p.role)} ptag">${p.role || '—'}</span>
        </td>
    `;

    cols.forEach(c => {
      if (c.type === 'day') {
        const cls  = dayCellClass(p, c.idx);
        const text = dayCellText(p, c.idx);
        rowsHtml += `<td class="ptd ptd-day ${cls}">${text}</td>`;
      } else {
        const cls  = nightCellClass(p, c.idx);
        const text = nightCellText(p, c.idx);
        rowsHtml += `<td class="ptd ptd-night ${cls}">${text}</td>`;
      }
    });

    rowsHtml += `</tr>`;
  });

  // ── Сборка ────────────────────────────────────────────────
  return `
    <div class="card results-table-card">
      <div class="card-title">📋 Протокол действий</div>
      <div class="proto-scroll-wrap">
        <table class="proto-tbl">
          ${headHtml}
          <tbody>
            ${mafiaRowHtml}
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Escape для протокола ─────────────────────────────────────
function escProto(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Старт ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initResults);