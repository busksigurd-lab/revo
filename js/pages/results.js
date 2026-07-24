// ════════════════════════════════════════════════════════════
//  results.js — Страница результатов вечера
// ════════════════════════════════════════════════════════════

'use strict';

const TG_BOT_TOKEN   = '8820048575:AAE3qfYwdREErcvVUmVjR1CcmByeHr2nw0w';
const TG_CHANNEL_ID  = '-1003786838980';
const TG_COMMENTS_ID = '-1003931359518';

function loadResults() {
  const raw = localStorage.getItem('eveningResults');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const ResultsState = {
  data:      null,
  activeTab: 'summary',
  gameNums:  [],
};

function initResults() {
  ResultsState.data = loadResults();

  if (!ResultsState.data) {
    document.getElementById('resultsEveningTitle').textContent = 'Нет данных о вечере';
    document.getElementById('resultsBody').innerHTML =
      '<div class="empty-state">Завершите хотя бы одну игру</div>';
    return;
  }

  const d = ResultsState.data;
  document.getElementById('resultsEveningTitle').textContent = d.title || 'Игровой вечер';
  document.getElementById('resultsEveningDate').textContent  = d.date  || '';

  ResultsState.gameNums = Object.keys(d.games).map(Number).sort((a, b) => a - b);

  buildTabsNav();
  renderActiveTab();
  bindResultsEvents();
}

function buildTabsNav() {
  const nav = document.getElementById('resultsTabsNav');
  nav.innerHTML = '';

  const tabs = [
    { key: 'summary', label: '📊 Сводная' },
    ...ResultsState.gameNums.map(n => ({ key: `game_${n}`, label: `Игра ${n}` })),
  ];

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className   = 'results-tab-btn' + (tab.key === ResultsState.activeTab ? ' active' : '');
    btn.textContent = tab.label;
    btn.dataset.tab = tab.key;
    btn.addEventListener('click', () => {
     ResultsState.activeTab = tab.key;
     buildTabsNav();
     renderActiveTab();
     renderActionBar(); // ← добавить эту строку
    });
    nav.appendChild(btn);
  });
}

function renderActiveTab() {
  const tab = ResultsState.activeTab;
  if (tab === 'summary') {
    renderSummary();
  } else {
    renderGameTab(parseInt(tab.replace('game_', ''), 10));
  }
}

// ════════════════════════════════════════════════════════════
//  СВОДНАЯ ТАБЛИЦА
// ════════════════════════════════════════════════════════════

function renderSummary() {
  const body = document.getElementById('resultsBody');
  const data = ResultsState.data;
  const agg  = {};

  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    if (!game || !game.finished) return;
    game.players.forEach(p => {
      if (!agg[p.name]) agg[p.name] = { name: p.name, games: 0, wins: 0, extra: 0, total: 0 };
      const a = agg[p.name];
      a.games++;
      if (p.won) a.wins++;
      a.extra = Math.round((a.extra + (p.extra || 0)) * 1000) / 1000;
      a.total = Math.round((a.total + (p.total || 0)) * 1000) / 1000;
    });
  });

  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    if (!game || game.finished) return;
    game.players.forEach(p => {
      if (!agg[p.name]) agg[p.name] = { name: p.name, games: 0, wins: 0, extra: 0, total: 0 };
      agg[p.name].games++;
    });
  });

  const rows = Object.values(agg).sort((a, b) => b.total - a.total || b.wins - a.wins);

  function fmtExtra(val) {
    if (val > 0) return `+${val}`;
    if (val < 0) return `${val}`;
    return '—';
  }

  body.innerHTML = `
    <div class="card results-table-card">
      <div class="card-title">📊 Итоговая таблица</div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-name">Игрок</th>
              <th class="col-wins">В</th>
              <th class="col-extra">Доп</th>
              <th class="col-pts">Очки</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr class="${i===0?'row-first':i===1?'row-second':i===2?'row-third':''}">
                <td class="col-rank">${rankBadge(i)}</td>
                <td class="col-name">${r.name}</td>
                <td class="col-wins">${r.wins}</td>
                <td class="col-extra">${fmtExtra(r.extra)}</td>
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

  if (!game.finished) {
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
                <th class="col-seat">№</th><th class="col-name">Игрок</th>
                <th class="col-role">Роль</th><th class="col-base">База</th>
                <th class="col-extra">Доп</th><th class="col-pts">Итог</th>
              </tr>
            </thead>
            <tbody>
              ${game.players.map(p => `
                <tr>
                  <td class="col-seat">${p.seat}</td>
                  <td class="col-name">${p.name}</td>
                  <td class="col-role"><span class="role-tag">—</span></td>
                  <td class="col-base">—</td>
                  <td class="col-extra">—</td>
                  <td class="col-pts">—</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return;
  }

  const icon   = winnerIcon(game.winner);
  const label  = winnerLabel(game.winner);
  const sorted = [...game.players].sort((a, b) => {
    if (a.won !== b.won) return b.won ? 1 : -1;
    return b.total - a.total;
  });
  const bySeat = [...game.players].sort((a, b) => a.seat - b.seat);

  body.innerHTML = `
    <div class="card game-result-card">
      <div class="game-result-winner">${icon} Победа: <strong>${label}</strong></div>
    </div>
    <div class="card results-table-card">
      <div class="card-title">🎮 Игра №${num}</div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-seat">№</th><th class="col-name">Игрок</th>
              <th class="col-role">Роль</th><th class="col-base">База</th>
              <th class="col-extra">Доп</th><th class="col-pts">Итог</th>
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
                <td class="col-extra">${
                  p.extra > 0 ? '+'+p.extra : p.extra < 0 ? p.extra : '—'
                }</td>
                <td class="col-pts"><strong>${p.total}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${renderProtocolTable(game, bySeat)}
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
    'МАФ': 'role-tag--mafia',
    'ДОН': 'role-tag--don',
    'ШЕР': 'role-tag--sheriff',
    'МИР': 'role-tag--peaceful',
    'МАН': 'role-tag--maniac',
    'ДОК': 'role-tag--doctor',
    'ЛЮБ': 'role-tag--peaceful',
    'КРА': 'role-tag--beauty',
  };
  return map[role] || 'role-tag--peaceful';
}

function escProto(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════
//  ЭКСПОРТ ТЕКСТОМ
// ════════════════════════════════════════════════════════════

function exportResults() {
  const data = ResultsState.data;
  if (!data) return;

  let text = `${data.title || 'Вечер'} — ${data.date || ''}\n${'═'.repeat(40)}\n\n`;
  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    text += `ИГРА №${num} — победа: ${winnerLabel(game.winner)}\n${'─'.repeat(30)}\n`;
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
  a.href = url;
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
  const history = JSON.parse(localStorage.getItem('mafiaHistory') || '[]');
  history.push({ ...data, savedAt: Date.now() });
  localStorage.setItem('mafiaHistory', JSON.stringify(history));
  showToast('Сохранено в историю ✅');
}

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

// ════════════════════════════════════════════════════════════
//  ПАНЕЛЬ КНОПОК — меняется при смене вкладки
// ════════════════════════════════════════════════════════════

function renderActionBar() {
  const bar = document.getElementById('resultsActionBar');
  if (!bar) return;

  const tab = ResultsState.activeTab;

  if (tab === 'summary') {
    bar.innerHTML = `
      <button class="btn btn-secondary" id="barBtnImage">
        🖼 Скачать картинку итогов
      </button>
      <button class="btn btn-telegram" id="barBtnTelegram">
        ✈️ Опубликовать итоги
      </button>
      <button class="btn btn-primary" id="barBtnHistory">
        💾 Сохранить в историю
      </button>
    `;
    document.getElementById('barBtnImage')
      ?.addEventListener('click', () => exportResultsAsImage(false));
    document.getElementById('barBtnTelegram')
      ?.addEventListener('click', publishResultsToTelegram);
    document.getElementById('barBtnHistory')
      ?.addEventListener('click', saveToHistory);

  } else {
    const num = parseInt(tab.replace('game_', ''), 10);
    const game = ResultsState.data?.games[num];
    const finished = game?.finished;

    bar.innerHTML = `
      <button class="btn btn-secondary" id="barBtnGameImage" ${!finished ? 'disabled' : ''}>
        🖼 Скачать картинку игры ${num}
      </button>
    `;

    if (finished) {
      document.getElementById('barBtnGameImage')
        ?.addEventListener('click', () => exportGameAsImage(num, false));
    }
  }
}

function bindResultsEvents() {
  // Старые статичные кнопки больше не нужны
  // Всё через renderActionBar()
  renderActionBar();
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

  let maxNight = 0;
  Object.keys(nights).forEach(k => {
    const n = parseInt(k);
    if (!isNaN(n) && n > maxNight) maxNight = n;
  });

  let maxDay = 0;
  players.forEach(p => {
    Object.keys(dayActions[p.seat] || {}).forEach(k => {
      const d = parseInt(k.replace('d', ''));
      if (!isNaN(d) && d > maxDay) maxDay = d;
    });
  });

  const numNights = Math.min(Math.max(maxNight, 7), PROTO_MAX_NIGHTS);
  const numDays   = Math.min(Math.max(maxDay + 1, 7), PROTO_MAX_DAYS);

  // ── Конец игры ────────────────────────────────────────────
  let gameEndRound = null;

  if (game.endRound) {
    gameEndRound = game.endRound;
  } else {
    let lastDay = 0, lastNight = 0;
    players.forEach(p => {
      Object.keys(dayActions[p.seat] || {}).forEach(k => {
        const d = parseInt(k.replace('d', ''));
        if (!isNaN(d) && d > lastDay) lastDay = d;
      });
    });
    Object.keys(nights).forEach(k => {
      const n = parseInt(k);
      if (!isNaN(n) && n > lastNight) lastNight = n;
    });
    if (lastDay > 0 || lastNight > 0) {
      gameEndRound = lastDay >= lastNight
        ? { type: 'day',   idx: lastDay   }
        : { type: 'night', idx: lastNight };
    }
  }

  function isAfterGameEnd(type, idx) {
    if (!gameEndRound) return false;
    return idx > gameEndRound.idx;
  }

  // ── deathInfo ─────────────────────────────────────────────
const deathInfo = {};

players.forEach(p => {
  const actions = dayActions[p.seat] || {};
  
  // Сортируем ключи по номеру дня: d0, d1, d2...
  const sortedKeys = Object.keys(actions)
    .filter(k => /^d\d+$/.test(k))
    .sort((a, b) => {
      return parseInt(a.replace('d', '')) - parseInt(b.replace('d', ''));
    });

  for (const key of sortedKeys) {
    const val = actions[key];
    const d   = parseInt(key.replace('d', ''));

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
    if (d.via === 'night'  && d.round <= dayRound) return true;
    if ((d.via === 'vote' || d.via === 'manual') && d.round < dayRound) return true;
    return false;
  }

  // Ночные смерти
  players.forEach(p => {
    if (deathInfo[p.seat]) return;
    if (p.eliminationReason !== 'night') return;

    for (let n = 1; n <= numNights; n++) {
      const night        = nights[n] || {};
      const beautyPlayer = players.find(pl => pl.role === 'КРА');
      const beautyAlive  = beautyPlayer ? !isDeadBeforeNight(beautyPlayer.seat, n) : false;
      const shotAny      = night.mafia === p.seat || night.maniac === p.seat;
      const savedByDoc   = night.doctor === p.seat;
      const savedByBeauty = beautyAlive && night.beauty === p.seat && shotAny;

      if (shotAny && !savedByDoc && !savedByBeauty) {
        deathInfo[p.seat] = { round: n, via: 'night' };
        break;
      }
    }
  });

  // ── Золотые подсветки ─────────────────────────────────────────
const donGold = {}, sheriffGold = {};

// Номер цели для жёлтой цифры (уже есть в donGold/sheriffGold выше)
// Добавляем: КАКОЕ ЧИСЛО показывать жёлтым
const donGoldNum    = {};  // n → seat цели (шериф)
const sheriffGoldNum = {}; // n → seat цели (чёрный)

for (let n = 1; n <= numNights; n++) {
  const night = nights[n] || {};

  // ── Дон проверяет шерифа ──
  if (night.don != null && night.don !== '-') {
    const t = players.find(p => p.seat === night.don);
    if (t && t.role === 'ШЕР') {
      donGold[n]    = true;
      donGoldNum[n] = night.don;
    }
  }

  // ── Шериф проверяет чёрного ──
  if (night.sheriff != null && night.sheriff !== '-') {
    const t = players.find(p => p.seat === night.sheriff);
    if (t) {
      const isMafOrDon = t.role === 'МАФ' || t.role === 'ДОН';
      const mafAlive   = players.some(p =>
        (p.role === 'МАФ' || p.role === 'ДОН') && !isDeadBeforeNight(p.seat, n)
      );
      const isManiacBlack = t.role === 'МАН' && !mafAlive;
      if (isMafOrDon || isManiacBlack) {
        sheriffGold[n]    = true;
        sheriffGoldNum[n] = night.sheriff;
      }
    }
  }
}

// ── Зелёные подсветки (состоявшиеся лечения) ─────────────────
const docGreenNum    = {}; // n → true, если доктор реально спас
const beautyGreenNum = {}; // n → true, если красотка реально спасла

for (let n = 1; n <= numNights; n++) {
  const night = nights[n] || {};

  const beautyPlayer = players.find(pl => pl.role === 'КРА');
  const beautyAlive  = beautyPlayer ? !isDeadBeforeNight(beautyPlayer.seat, n) : false;

  const mafiaShot  = night.mafia;
  const maniacShot = night.maniac;
  const docTarget  = night.doctor;
  const beautyTgt  = night.beauty;

  // ── Доктор ──
  // Лечение состоялось если:
  // - доктор лечит того, в кого стреляли (мафия или маньяк)
  if (docTarget != null && docTarget !== '-') {
    const shotAtDoc = mafiaShot === docTarget || maniacShot === docTarget;
    if (shotAtDoc) {
      docGreenNum[n] = true;
    }
  }

  // ── Красотка ──
  // Случай 1: Красотка жива, стреляли в её цель (но не в неё)
  if (beautyAlive && beautyTgt != null && beautyTgt !== '-') {
    const shotAtBeautyTarget = mafiaShot === beautyTgt || maniacShot === beautyTgt;
    const shotAtBeauty       = beautyPlayer &&
      (mafiaShot === beautyPlayer.seat || maniacShot === beautyPlayer.seat);

    if (shotAtBeautyTarget && !shotAtBeauty) {
      beautyGreenNum[n] = true;
    }

    // Случай 2: Стреляли в красотку, но доктор лечит красотку
    // → красотка и цель живы → красотка ходила эффективно
    if (shotAtBeauty && beautyPlayer && docTarget === beautyPlayer.seat) {
      beautyGreenNum[n] = true;
    }
  }
}

  // ── Ячейки ────────────────────────────────────────────────

  function nightCellClass(p, n) {
    if (isAfterGameEnd('night', n))   return 'pcc-gone';
    if (isDeadBeforeNight(p.seat, n)) return 'pcc-gone';

    const night        = nights[n] || {};
    const beautyPlayer = players.find(pl => pl.role === 'КРА');
    const beautyAliveN = beautyPlayer ? !isDeadBeforeNight(beautyPlayer.seat, n) : false;
    const shotAny      = night.mafia === p.seat || night.maniac === p.seat;
    const savedByDoc   = night.doctor === p.seat;
    const savedByBeauty = beautyAliveN && night.beauty === p.seat && shotAny;
    const saved        = savedByDoc || savedByBeauty;

    if (shotAny && !saved) return 'pcc-killed';
    if (shotAny &&  saved) return 'pcc-saved';
    if (p.role === 'ДОН' && donGold[n])     return 'pcc-gold';
    if (p.role === 'ШЕР' && sheriffGold[n]) return 'pcc-gold';
    return 'pcc-alive';
  }

  function nightCellText(p, n) {
  if (isDeadBeforeNight(p.seat, n)) return '';
  const night      = nights[n] || {};
  const roleActMap = {
    'ДОН': night.don,     'ШЕР': night.sheriff,
    'МАН': night.maniac,  'ДОК': night.doctor,
    'КРА': night.beauty,
  };
  if (!(p.role in roleActMap)) return '';
  const val = roleActMap[p.role];
  if (val == null) return '';
  if (val === '-') return '−';

  const num = String(val);

  // 🟡 Жёлтая цифра — эффективная проверка
  if (p.role === 'ДОН' && donGoldNum[n]) {
    return `<span style="color:#ffe033;font-weight:900">${num}</span>`;
  }
  if (p.role === 'ШЕР' && sheriffGoldNum[n]) {
    return `<span style="color:#ffe033;font-weight:900">${num}</span>`;
  }

  // 🟢 Зелёная цифра — состоявшееся лечение
  if (p.role === 'ДОК' && docGreenNum[n]) {
    return `<span style="color:#00ff50;font-weight:900">${num}</span>`;
  }
  if (p.role === 'КРА' && beautyGreenNum[n]) {
    return `<span style="color:#00ff50;font-weight:900">${num}</span>`;
  }

  return num;
}

    function dayCellClass(p, d) {
    if (isAfterGameEnd('day', d))   return 'pcc-gone';
    if (isDeadBeforeDay(p.seat, d)) return 'pcc-gone';

    const actions = dayActions[p.seat] || {};
    const val     = actions[`d${d}`];
    const nomVal  = actions[`d${d}_nom`];

    if (val === 'у' || val === 'u') return 'pcc-killed';
    if (val === 'x')                return 'pcc-killed';

    const nomSeat = nomVal
      ? Number(nomVal)
      : (val && /^\d+$/.test(String(val)) ? Number(val) : null);

    if (nomSeat !== null) {
      const nominated = players.find(pl => pl.seat === nomSeat);
      const votedOut  = nominated
        ? (dayActions[nominated.seat] || {})[`d${d}`] === 'x'
        : false;

      if (votedOut) {
        const blackRoles = ['МАФ', 'ДОН', 'МАН'];
        const tgtIsBlack = blackRoles.includes(nominated?.role || '');
        return tgtIsBlack ? 'pcc-nom-hit-black' : 'pcc-nom-hit-civil';
      }

      return 'pcc-alive';
    }

    return 'pcc-alive'; // ← эта строка была потеряна, и функция не закрывалась
  }                     // ← эта закрывающая скобка отсутствовала

  function dayCellText(p, d) {
    if (isDeadBeforeDay(p.seat, d)) return '';

    const actions = dayActions[p.seat] || {};
    const val     = actions[`d${d}`];
    const nomVal  = actions[`d${d}_nom`];

    if (!val && !nomVal) return '';
    if (val === 'у' || val === 'u') return 'У';

    if (val === 'x') {
      if (nomVal) return buildNomSpan(p, Number(nomVal), d);
      return '';
    }

    if (/^\d+$/.test(String(val))) {
      return buildNomSpan(p, Number(val), d);
    }

    if (nomVal) return buildNomSpan(p, Number(nomVal), d);

    return '';
  }

// ── Вспомогательная: строит цветной span с номером ──
function buildNomSpan(nominator, nominatedSeat, d) {
  const nominated = players.find(pl => pl.seat === nominatedSeat);
  if (!nominated) return `<span style="font-size:0.65em">${nominatedSeat}</span>`;

  const civilRoles = ['МИР', 'ДОК', 'КРА', 'ШЕР'];
  const blackRoles = ['МАФ', 'ДОН', 'МАН'];

  const nomIsCivil = civilRoles.includes(nominator.role);
  const nomIsBlack = blackRoles.includes(nominator.role);
  const tgtIsBlack = blackRoles.includes(nominated.role);
  const tgtIsCivil = civilRoles.includes(nominated.role);

  const votedOut = (dayActions[nominated.seat] || {})[`d${d}`] === 'x';
  const votedCls = votedOut ? ' proto-nom-voted' : '';

  let colorClass = '';
  if      (nomIsCivil && tgtIsBlack) colorClass = 'proto-nom-civil-vs-black';
  else if (nomIsCivil && tgtIsCivil) colorClass = 'proto-nom-civil-vs-civil';
  else if (nomIsBlack && tgtIsCivil) colorClass = 'proto-nom-black-vs-civil';

  if (colorClass) {
    return `<span class="${colorClass}${votedCls}" style="font-size:0.65em">${nominatedSeat}</span>`;
  }
  return `<span style="font-size:0.65em">${nominatedSeat}</span>`;
}

  // ── Колонки Д0 Н1 Д1 Н2 ... ─────────────────────────────
  const cols  = [];
  const total = Math.max(numDays, numNights);
  for (let i = 0; i < total; i++) {
    if (i < numDays)   cols.push({ type: 'day',   idx: i });
    if (i < numNights) cols.push({ type: 'night', idx: i + 1 });
  }

  // ── Заголовок ─────────────────────────────────────────────
  let headHtml = `
    <thead><tr class="proto-header-row">
      <th class="pth pth-num">#</th>
      <th class="pth pth-name">Ник</th>
      <th class="pth pth-role">Роль</th>
  `;
  cols.forEach(c => {
    const label = c.type === 'day' ? `Д${c.idx}` : `Н${c.idx}`;
    const cls   = c.type === 'day' ? 'pth-day'   : 'pth-night';
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
      const cls = isAfterGameEnd('day', c.idx) ? 'pcc-gone' : 'pcc-mafia';
      mafiaRowHtml += `<td class="ptd ptd-day ${cls}"></td>`;
    } else {
      const cls  = isAfterGameEnd('night', c.idx) ? 'pcc-gone' : 'pcc-mafia';
      const shot = nights[c.idx]?.mafia;
      const text = (!isAfterGameEnd('night', c.idx) && shot != null && shot !== '-')
        ? shot : '';
      mafiaRowHtml += `<td class="ptd ptd-night ${cls}">${text}</td>`;
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
        rowsHtml += `<td class="ptd ptd-day ${dayCellClass(p,c.idx)}">${dayCellText(p,c.idx)}</td>`;
      } else {
        rowsHtml += `<td class="ptd ptd-night ${nightCellClass(p,c.idx)}">${nightCellText(p,c.idx)}</td>`;
      }
    });
    rowsHtml += `</tr>`;
  });

  return `
    <div class="card results-table-card">
      <div class="card-title">📋 Протокол действий</div>
      <div class="proto-scroll-wrap">
        <table class="proto-tbl">
          ${headHtml}
          <tbody>${mafiaRowHtml}${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  ЭКСПОРТ КАК КАРТИНКА
// ════════════════════════════════════════════════════════════

async function exportResultsAsImage(returnCanvas = false) {
  const data = ResultsState.data;
  if (!data) { showToast('Нет данных для экспорта'); return; }

  showToast('Генерирую картинку...');

    const agg = {};
  ResultsState.gameNums.forEach(num => {
    const game = data.games[num];
    if (!game || !game.finished) return;
    game.players.forEach(p => {
      if (!agg[p.name]) agg[p.name] = { name: p.name, wins: 0, extra: 0, total: 0 };
      const a = agg[p.name];
      if (p.won) a.wins++;
      a.extra = Math.round((a.extra + (p.extra || 0)) * 1000) / 1000;
      a.total = Math.round((a.total + (p.total || 0)) * 1000) / 1000;
    });
  });

  // ⬇️ ВОТ ЭТА СТРОКА ПОТЕРЯЛАСЬ — ВЕРНИ ЕЁ
  const rows = Object.values(agg).sort((a, b) => b.total - a.total || b.wins - a.wins);

  if (!rows.length) {
    showToast('Нет завершённых игр');
    return returnCanvas ? null : undefined;
  }

  function rankIcon(i) {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `<span class="rank-num">${i+1}</span>`;
  }

  const rowsHtml = rows.map((r, i) => {
    const rankClass  = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'';
    const extraSign  = r.extra > 0 ? '+' : '';
    const extraClass = r.extra > 0 ? 'extra-pos' : r.extra < 0 ? 'extra-neg' : '';
    const extraText  = r.extra !== 0 ? `${extraSign}${r.extra}` : '—';
    return `
      <div class="result-row ${rankClass}">
        <div class="col-rank">${rankIcon(i)}</div>
        <div class="col-name">${escProto(r.name)}</div>
        <div class="col-wins">${r.wins}</div>
        <div class="col-extra ${extraClass}">${extraText}</div>
        <div class="col-pts">${r.total}</div>
      </div>
    `;
  }).join('');

  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1080px;height:1920px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    

        const finishedGames = ResultsState.gameNums.filter(n => data.games[n]?.finished);
    const gameResultsHtml = finishedGames.map(num => {
      const game  = data.games[num];
      const icon  = winnerIcon(game.winner);
      const label = winnerLabel(game.winner);
      return `
        <div class="tpl-game-badge">
          <span class="tpl-game-num">Игра ${num}</span>
          <span class="tpl-game-winner">${icon} ${label}</span>
        </div>
      `;
    }).join('');

        iframe.srcdoc = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px;
    font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
    overflow: hidden; background: #0d0d0d;
  }
  #tplRoot {
    position: relative; width: 1080px; height: 1920px;
    overflow: hidden; display: flex; flex-direction: column;
  }
  #tplBg {
    position: absolute; inset: 0; width: 1080px; height: 1920px;
    object-fit: cover; object-position: center; z-index: 0;
  }
  #tplOverlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.62); z-index: 1;
  }
  #tplContent {
    position: absolute; inset: 0; z-index: 2;
    display: flex; flex-direction: column;
    padding: 70px 80px 60px;
  }
  .tpl-date {
    font-size: 28px; font-weight: 400;
    color: rgba(255,255,255,0.5); letter-spacing: 0.05em; margin-bottom: 8px;
  }
  .tpl-title {
    font-size: 110px; font-weight: 900; color: #fff;
    text-transform: uppercase; letter-spacing: 0.02em; line-height: 1;
    text-shadow: 0 2px 30px rgba(0,0,0,0.8);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tpl-subtitle {
    font-size: 28px; font-weight: 400;
    color: rgba(255,255,255,0.45); letter-spacing: 0.35em;
    text-transform: uppercase; margin-top: 6px;
  }
  .tpl-divider {
    width: 100%; height: 2px;
    background: linear-gradient(90deg, #e8b84b 0%, rgba(232,184,75,0.1) 100%);
    margin: 24px 0 36px; flex-shrink: 0;
  }
  .tpl-col-header {
    display: flex; align-items: center;
    padding: 0 20px 16px 90px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 8px; flex-shrink: 0;
  }
  .tpl-col-header .ch-name { flex: 1; }
  .tpl-col-header .ch-wins { width: 120px; text-align: center; }
  .tpl-col-header .ch-extra { width: 120px; text-align: center; }
  .tpl-col-header .ch-pts  { width: 140px; text-align: right; }
  .tpl-col-header div {
    font-size: 18px; font-weight: 700;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .tpl-col-header .ch-pts { color: #e8b84b; }
  #tplRows {
    flex: 1; display: flex; flex-direction: column;
    gap: 6px; overflow: hidden;
  }
  .result-row {
    display: flex; align-items: center;
    padding: 18px 20px 18px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .result-row.rank-1 { border-bottom-color: rgba(232,184,75,0.2); }
  .result-row.rank-2 { border-bottom-color: rgba(192,192,192,0.15); }
  .result-row.rank-3 { border-bottom-color: rgba(205,127,50,0.15); }
  .col-rank { width: 70px; font-size: 38px; text-align: center; flex-shrink: 0; }
  .col-name {
    flex: 1; font-size: 36px; font-weight: 700; color: #fff;
    text-transform: uppercase; letter-spacing: 0.04em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .result-row.rank-1 .col-name { color: #FFD700; }
  .result-row.rank-2 .col-name { color: #FFE566; }
  .result-row.rank-3 .col-name { color: #FFF0A0; }
  .col-wins {
    width: 120px; font-size: 30px; font-weight: 700;
    text-align: center; color: rgba(255,255,255,0.5); flex-shrink: 0;
  }
  .col-extra {
    width: 120px; font-size: 28px; font-weight: 700;
    text-align: center; color: rgba(255,255,255,0.4); flex-shrink: 0;
  }
  .col-extra.extra-pos { color: #4cdd8a; }
  .col-extra.extra-neg { color: #ff6b6b; }
  .col-pts {
    width: 140px; font-size: 36px; font-weight: 900;
    text-align: right; color: #e8b84b; flex-shrink: 0;
  }
  .result-row.rank-1 .col-pts { color: #e8b84b; font-size: 42px; }
  .rank-num { font-size: 28px; color: rgba(255,255,255,0.3); font-weight: 700; }
  .tpl-footer {
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: flex-end; padding-top: 24px;
  }
</style>
</head>
<body>
<div id="tplRoot">
  <img id="tplBg" src="images/seating-bg.jpg" alt="" />
  <div id="tplOverlay"></div>
  <div id="tplContent">
    <div class="tpl-date" id="tplEveningDate"></div>
    <div class="tpl-title" id="tplEveningTitle">ИГРОВОЙ ВЕЧЕР</div>
    <div class="tpl-subtitle">ИТОГИ ВЕЧЕРА</div>
    <div class="tpl-divider"></div>
    <div class="tpl-col-header">
      <div class="ch-name"></div>
      <div class="ch-wins">Победы</div>
      <div class="ch-extra">Доп</div>
      <div class="ch-pts">Очки</div>
    </div>
    <div id="tplRows"></div>
    <div class="tpl-footer">РЕВОЛЮЦИЯ • КЛУБ</div>
  </div>
</div>
</body>
</html>`;

    iframe.onload = async () => {
      const doc = iframe.contentDocument;

      doc.getElementById('tplEveningTitle').textContent =
        (data.title || 'Игровой вечер').toUpperCase();
      doc.getElementById('tplEveningDate').textContent =
        data.date || '';
      doc.getElementById('tplRows').innerHTML = rowsHtml;

      const gamesPlayed = ResultsState.gameNums.filter(n => data.games[n]?.finished).length;
      
      await new Promise(r => setTimeout(r, 300));

      try {
  const canvas = await html2canvas(doc.getElementById('tplRoot'), {
    width:  1080,
    height: 1920,
    scale:  1,
    useCORS: true,
    backgroundColor: null,
  });

  if (returnCanvas) {
    document.body.removeChild(iframe);
    resolve(canvas);
    return;
  }

  const link = document.createElement('a');
  link.download = `mafia-results-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Картинка сохранена ✅');
} catch (err) {
  console.error(err);
  showToast('Ошибка экспорта 😢');
  if (returnCanvas) { resolve(null); return; }
}

      document.body.removeChild(iframe);
      resolve();
    };

       

  });
}

// ── Старт ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initResults);

// ════════════════════════════════════════════════════════════
//  ЭКСПОРТ ОДНОЙ ИГРЫ КАК КАРТИНКА 16:9
// ════════════════════════════════════════════════════════════

async function exportGameAsImage(gameNum, returnCanvas = false) {
  const data = ResultsState.data;
  if (!data) { showToast('Нет данных'); return; }

  const game = data.games[gameNum];
  if (!game || !game.finished) { showToast('Игра не завершена'); return; }

  showToast('Генерирую картинку...');

  // ── Подготовка данных ────────────────────────────────────
  const sorted = [...game.players].sort((a, b) => {
    if (a.won !== b.won) return b.won ? 1 : -1;
    return b.total - a.total;
  });
  const bySeat = [...game.players].sort((a, b) => a.seat - b.seat);

  const proto      = game.protocol || {};
  const nights     = proto.nights     || {};
  const dayActions = proto.dayActions || {};

  // ── Определяем диапазон колонок ─────────────────────────
  let maxNight = 0, maxDay = 0;
  Object.keys(nights).forEach(k => {
    const n = parseInt(k); if (!isNaN(n) && n > maxNight) maxNight = n;
  });
  bySeat.forEach(p => {
    Object.keys(dayActions[p.seat] || {}).forEach(k => {
      const d = parseInt(k.replace('d', ''));
      if (!isNaN(d) && d > maxDay) maxDay = d;
    });
  });
  const numNights = Math.min(Math.max(maxNight, 5), 10);
  const numDays   = Math.min(Math.max(maxDay + 1, 5), 10);

  // ── Конец игры ───────────────────────────────────────────
  let gameEndRound = game.endRound || null;
  if (!gameEndRound) {
    let ld = 0, ln = 0;
    bySeat.forEach(p => {
      Object.keys(dayActions[p.seat] || {}).forEach(k => {
        const d = parseInt(k.replace('d', ''));
        if (!isNaN(d) && d > ld) ld = d;
      });
    });
    Object.keys(nights).forEach(k => {
      const n = parseInt(k); if (!isNaN(n) && n > ln) ln = n;
    });
    if (ld > 0 || ln > 0)
      gameEndRound = ld >= ln ? { type:'day', idx:ld } : { type:'night', idx:ln };
  }
  function isAfterEnd(type, idx) {
    if (!gameEndRound) return false;
    return idx > gameEndRound.idx;
  }

  // ── deathInfo ────────────────────────────────────────────
  const deathInfo = {};
  bySeat.forEach(p => {
    const actions = dayActions[p.seat] || {};
    const keys = Object.keys(actions)
      .filter(k => /^d\d+$/.test(k))
      .sort((a,b) => parseInt(a.replace('d','')) - parseInt(b.replace('d','')));
    for (const key of keys) {
      const val = actions[key], d = parseInt(key.replace('d',''));
      if (val === 'x')             { deathInfo[p.seat] = {round:d, via:'vote'};   break; }
      if (val === 'у' || val==='u'){ deathInfo[p.seat] = {round:d, via:'manual'}; break; }
    }
  });
  bySeat.forEach(p => {
    if (deathInfo[p.seat] || p.eliminationReason !== 'night') return;
    for (let n = 1; n <= numNights; n++) {
      const night = nights[n] || {};
      const bp    = bySeat.find(pl => pl.role === 'КРА');
      const ba    = bp ? !isDeadBeforeNight(bp.seat, n) : false;
      const shot  = night.mafia === p.seat || night.maniac === p.seat;
      const saved = night.doctor === p.seat || (ba && night.beauty === p.seat && shot);
      if (shot && !saved) { deathInfo[p.seat] = {round:n, via:'night'}; break; }
    }
  });
  function isDeadBeforeNight(seat, n) {
    const d = deathInfo[seat]; if (!d) return false;
    return d.round < n;
  }
  function isDeadBeforeDay(seat, d) {
    const di = deathInfo[seat]; if (!di) return false;
    if (di.via === 'night')  return di.round <= d;
    return di.round < d;
  }

  // ── Золотые / зелёные проверки ───────────────────────────
  const donGoldNum={}, sheriffGoldNum={}, docGreenNum={}, beautyGreenNum={};
  for (let n = 1; n <= numNights; n++) {
    const night = nights[n] || {};
    if (night.don != null && night.don !== '-') {
      const t = bySeat.find(p => p.seat === night.don);
      if (t?.role === 'ШЕР') donGoldNum[n] = true;
    }
    if (night.sheriff != null && night.sheriff !== '-') {
      const t = bySeat.find(p => p.seat === night.sheriff);
      if (t) {
        const isMaf = t.role==='МАФ'||t.role==='ДОН';
        const mafAlive = bySeat.some(p => (p.role==='МАФ'||p.role==='ДОН') && !isDeadBeforeNight(p.seat,n));
        if (isMaf || (t.role==='МАН' && !mafAlive)) sheriffGoldNum[n] = true;
      }
    }
    const bp = bySeat.find(pl => pl.role==='КРА');
    const ba = bp ? !isDeadBeforeNight(bp.seat,n) : false;
    if (night.doctor != null && night.doctor !== '-') {
      if (night.mafia===night.doctor || night.maniac===night.doctor) docGreenNum[n]=true;
    }
    if (ba && night.beauty != null && night.beauty !== '-') {
      const stb = night.mafia===night.beauty || night.maniac===night.beauty;
      const stB = bp && (night.mafia===bp.seat || night.maniac===bp.seat);
      if (stb && !stB) beautyGreenNum[n]=true;
      if (stB && night.doctor===bp.seat) beautyGreenNum[n]=true;
    }
  }

  // ── Цвета ячеек ──────────────────────────────────────────
  function nightBg(p, n) {
    if (isAfterEnd('night',n) || isDeadBeforeNight(p.seat,n)) return '#0a0a0c';
    const night = nights[n]||{};
    const bp=bySeat.find(pl=>pl.role==='КРА'), ba=bp?!isDeadBeforeNight(bp.seat,n):false;
    const shot=night.mafia===p.seat||night.maniac===p.seat;
    const saved=night.doctor===p.seat||(ba&&night.beauty===p.seat&&shot);
    if (shot&&!saved) return '#5c0a0a';
    if (shot&&saved)  return '#0a3d1a';
    if ((p.role==='ДОН'&&donGoldNum[n])||(p.role==='ШЕР'&&sheriffGoldNum[n])) return '#2a2200';
    return '#16161e';
  }
  function dayBg(p, d) {
    if (isAfterEnd('day',d) || isDeadBeforeDay(p.seat,d)) return '#0a0a0c';
    const actions=dayActions[p.seat]||{};
    const val=actions[`d${d}`], nomVal=actions[`d${d}_nom`];
    if (val==='x'||val==='у'||val==='u') return '#5c0a0a';
    const nomSeat=nomVal?Number(nomVal):(val&&/^\d+$/.test(String(val))?Number(val):null);
    if (nomSeat!==null) {
      const nom=bySeat.find(pl=>pl.seat===nomSeat);
      const votedOut=nom?(dayActions[nom.seat]||{})[`d${d}`]==='x':false;
      if (votedOut) {
        return (['МАФ','ДОН','МАН'].includes(nom?.role||'')) ? '#0a1e3d' : '#3d0a1e';
      }
    }
    return '#12181a';
  }
  function nightText(p, n) {
    if (isDeadBeforeNight(p.seat,n)) return '';
    const night=nights[n]||{};
    const map={'ДОН':night.don,'ШЕР':night.sheriff,'МАН':night.maniac,'ДОК':night.doctor,'КРА':night.beauty};
    if (!(p.role in map)) return '';
    const val=map[p.role]; if (val==null) return ''; if (val==='-') return '−';
    const num=String(val);
    if (p.role==='ДОН'&&donGoldNum[n])    return `<span style="color:#ffe033;font-weight:900">${num}</span>`;
    if (p.role==='ШЕР'&&sheriffGoldNum[n])return `<span style="color:#ffe033;font-weight:900">${num}</span>`;
    if (p.role==='ДОК'&&docGreenNum[n])   return `<span style="color:#00ff50;font-weight:900">${num}</span>`;
    if (p.role==='КРА'&&beautyGreenNum[n])return `<span style="color:#00ff50;font-weight:900">${num}</span>`;
    return num;
  }
  function dayText(p, d) {
    if (isDeadBeforeDay(p.seat,d)) return '';
    const actions=dayActions[p.seat]||{};
    const val=actions[`d${d}`], nomVal=actions[`d${d}_nom`];
    if (!val&&!nomVal) return '';
    if (val==='у'||val==='u') return 'У';
    if (val==='x') return nomVal?buildImgNomSpan(p,Number(nomVal),d):'';
    if (/^\d+$/.test(String(val))) return buildImgNomSpan(p,Number(val),d);
    if (nomVal) return buildImgNomSpan(p,Number(nomVal),d);
    return '';
  }
  function buildImgNomSpan(nominator, nominatedSeat, d) {
    const nom=bySeat.find(pl=>pl.seat===nominatedSeat);
    if (!nom) return String(nominatedSeat);
    const civil=['МИР','ДОК','КРА','ШЕР'], black=['МАФ','ДОН','МАН'];
    const nc=civil.includes(nominator.role), nb=black.includes(nominator.role);
    const tb=black.includes(nom.role), tc=civil.includes(nom.role);
    const out=(dayActions[nom.seat]||{})[`d${d}`]==='x';
    let color='#aaa';
    if (nc&&tb) color=out?'#5bc8ff':'#3a8fbf';
    else if (nc&&tc) color=out?'#ff7fc0':'#bf5f90';
    else if (nb&&tc) color=out?'#b57fff':'#805fbf';
    const u=out?'text-decoration:underline;':'';
    return `<span style="color:${color};font-weight:900;${u}">${nominatedSeat}</span>`;
  }

  // ── Роли: цвета плашек ───────────────────────────────────
  const roleColors = {
    'МАФ': {bg:'#3a3a3a', color:'#fff'},
    'ДОН': {bg:'#2a2a2a', color:'#fff'},
    'ШЕР': {bg:'#15803d', color:'#fff'},
    'МИР': {bg:'#b91c1c', color:'#fff'},
    'МАН': {bg:'#7e22ce', color:'#f3e8ff'},
    'ДОК': {bg:'#166534', color:'#bbf7d0'},
    'КРА': {bg:'#166534', color:'#bbf7d0'},
    'ЛЮБ': {bg:'#b91c1c', color:'#fff'},
  };
  function roleStyle(role) {
    const c = roleColors[role] || {bg:'#444', color:'#fff'};
    return `background:${c.bg};color:${c.color};`;
  }

  // ── Колонки протокола ─────────────────────────────────────
  const cols = [];
  const total = Math.max(numDays, numNights);
  for (let i = 0; i < total; i++) {
    if (i < numDays)   cols.push({type:'day',   idx:i});
    if (i < numNights) cols.push({type:'night', idx:i+1});
  }

  // ── HTML строк игроков ────────────────────────────────────
  const winnerColor = { civil:'#4cdd8a', mafia:'#ff6b6b', maniac:'#c084fc' };
  const wColor = winnerColor[game.winner] || '#fff';

  const playerRowsHtml = sorted.map(p => {
    const isDead = !!deathInfo[p.seat];
    const isWon  = p.won;
    const rowBg  = isWon
      ? 'background:rgba(76,221,138,0.06);border-left:3px solid rgba(76,221,138,0.4);'
      : 'background:rgba(255,255,255,0.02);opacity:0.75;';
    const extraFmt = p.extra>0?`+${p.extra}`:p.extra<0?`${p.extra}`:'—';
    const extraColor = p.extra>0?'#4cdd8a':p.extra<0?'#ff6b6b':'#666';

    let protoCells = '';
    cols.forEach(c => {
      if (c.type==='day') {
        const bg   = dayBg(p, c.idx);
        const txt  = dayText(p, c.idx);
        protoCells += `<td style="background:${bg};text-align:center;color:#ccc;font-size:23px;padding:0 2px;">${txt}</td>`;
      } else {
        const bg  = nightBg(p, c.idx);
        const txt = nightText(p, c.idx);
        protoCells += `<td style="background:${bg};text-align:center;color:#ccc;font-size:23px;padding:0 2px;">${txt}</td>`;
      }
    });

    return `
      <tr style="${rowBg}${isDead?'text-decoration:line-through;':''}">
        <td style="text-align:center;color:#666;font-size:15px;padding:6px 8px;">${p.seat}</td>
        <td style="color:#fff;font-size:24px;font-weight:600;padding:6px 12px;white-space:nowrap;">${escProto(p.name)}</td>
        <td style="padding:4px 8px;">
          <span style="display:inline-block;padding:3px 8px;border-radius:8px;font-size:12px;font-weight:800;letter-spacing:0.05em;${roleStyle(p.role)}">${p.role||'—'}</span>
        </td>
        <td style="text-align:center;color:#ccc;font-size:24px;font-weight:600;padding:6px 10px;">${p.base}</td>
        <td style="text-align:center;color:${extraColor};font-size:22px;font-weight:700;padding:6px 10px;">${extraFmt}</td>
        <td style="text-align:center;color:${isWon?wColor:'#888'};font-size: 27px;font-weight:800;padding:6px 12px;">${p.total}</td>
        ${protoCells}
      </tr>
    `;
  }).join('');

  // ── Строка мафии (выстрелы) ───────────────────────────────
  let mafiaRowHtml = `<tr style="background:#1a0808;">
    <td colspan="6" style="text-align:center;color:#ff6b6b;font-size:13px;font-weight:800;letter-spacing:2px;padding:5px 8px;">МАФИЯ</td>`;
  cols.forEach(c => {
    if (c.type==='day') {
      const bg = isAfterEnd('day',c.idx) ? '#0a0a0c' : '#1a0808';
      mafiaRowHtml += `<td style="background:${bg};"></td>`;
    } else {
      const bg   = isAfterEnd('night',c.idx) ? '#0a0a0c' : '#1a0808';
      const shot = nights[c.idx]?.mafia;
      const txt  = (!isAfterEnd('night',c.idx) && shot!=null && shot!=='-') ? shot : '';
      mafiaRowHtml += `<td style="background:${bg};text-align:center;color:#ff9999;font-size:13px;font-weight:700;">${txt}</td>`;
    }
  });
  mafiaRowHtml += `</tr>`;

  // ── Заголовки протокола ───────────────────────────────────
  let protoHeadCols = '';
  cols.forEach(c => {
    const label = c.type==='day' ? `Д${c.idx}` : `Н${c.idx}`;
    const color = c.type==='day' ? '#7ab' : '#99a';
    protoHeadCols += `<th style="color:${color};font-size:12px;text-align:center;padding:5px 3px;min-width:24px;">${label}</th>`;
  });

  const winIcon  = winnerIcon(game.winner);
  const winLabel = winnerLabel(game.winner);
  const teamColor= winnerColor[game.winner] || '#fff';

  // ── iframe → html2canvas ──────────────────────────────────
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1920px;height:1080px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      const doc = iframe.contentDocument;
      await new Promise(r => setTimeout(r, 300));
      try {
  const canvas = await html2canvas(doc.getElementById('tplRoot'), {
  width: 1920, height: 1080, scale: 1,
  useCORS: true, backgroundColor: '#0a1020',
  });

  if (returnCanvas) {
    document.body.removeChild(iframe);
    resolve(canvas);
    return;
  }

  const link = document.createElement('a');
  link.download = `mafia-game${gameNum}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Картинка игры сохранена ✅');
} catch(err) {
  console.error(err);
  showToast('Ошибка экспорта 😢');
  if (returnCanvas) { resolve(null); return; }
}
      document.body.removeChild(iframe);
      resolve();
    };

    iframe.srcdoc = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1920px; height:1080px;
  background: linear-gradient(160deg, #0a1020 0%, #131a2e 50%, #0a1020 100%);
  font-family:'Segoe UI',Arial,sans-serif;
  color:#fff; overflow:hidden;
}
#tplRoot {
  width:1920px; height:1080px;
  padding:40px 56px;
  display:flex; flex-direction:column; position:relative;
}
/* Декоративный фон */
#tplRoot::before {
  content:''; position:absolute;
  width:700px; height:700px; border-radius:50%;
  background:radial-gradient(circle,rgba(255,180,0,0.06) 0%,transparent 70%);
  top:-200px; right:-100px; pointer-events:none;
}
/* Шапка */
.tpl-head {
  display:flex; align-items:flex-start;
  justify-content:space-between;
  margin-bottom:28px; flex-shrink:0;
}
.tpl-evening {
  font-size:48px; font-weight:900; letter-spacing:3px;
  color:rgba(255,255,255,0.55); text-transform:uppercase;
}

.tpl-evening-date {
  font-size:18px; color:rgba(255,255,255,0.3);
  letter-spacing:2px; margin-top:4px;
}
.tpl-game-info { text-align:right; }
.tpl-game-num {
  font-size:22px; font-weight:700;
  color:rgba(255,255,255,0.4); letter-spacing:2px;
  margin-bottom:6px;
}
.tpl-winner {
  font-size:18px; font-weight:900;
  color:${teamColor};
  text-shadow:0 0 30px ${teamColor}66;
}
/* Разделитель */
.tpl-divider {
  width:100%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
  margin-bottom:20px; flex-shrink:0;
}
/* Таблица */
table {
  width:100%; border-collapse:collapse;
  flex:1;
}
thead th {
  padding:8px 10px;
  color:rgba(255,255,255,0.35);
  font-size:13px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.08em;
  border-bottom:1px solid rgba(255,255,255,0.08);
  text-align:center;
}
thead th.th-name { text-align:left; }
tbody tr { border-bottom:1px solid rgba(255,255,255,0.04); }
tbody tr:hover { background:rgba(255,255,255,0.02); }
/* Футер */
.tpl-footer {
  flex-shrink: 0;
  text-align: right;
  padding-top: 24px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.2);
}
</style>
</head>
<body>
<div id="tplRoot">
  <div class="tpl-head">
    <div>
      <div class="tpl-evening">${escProto((data.title||'Игровой вечер').toUpperCase())}</div>
      <div class="tpl-evening-date">${escProto(data.date||'')}</div>
    </div>
    <div class="tpl-game-info">
      <div class="tpl-game-num">ИГРА №${gameNum}</div>
      <div class="tpl-winner">${winIcon} Победа: ${winLabel}</div>
    </div>
  </div>
  <div class="tpl-divider"></div>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th class="th-name" style="min-width:140px;text-align:left;">Игрок</th>
        <th style="width:60px;">Роль</th>
        <th style="width:60px;">База</th>
        <th style="width:60px;">Доп</th>
        <th style="width:70px;">Итог</th>
        ${protoHeadCols}
      </tr>
    </thead>
    <tbody>
      ${mafiaRowHtml}
      ${playerRowsHtml}
    </tbody>
  </table>
  <div class="tpl-footer">МАФИЯ • КЛУБ</div>
</div>
</body></html>`;
  });
}

// ════════════════════════════════════════════════════════════
//  ПУБЛИКАЦИЯ В TELEGRAM
// ════════════════════════════════════════════════════════════

function getTgPostKey() {
  const data = ResultsState.data;
  return `tg_post_${data?.title || 'default'}_${data?.date || ''}`;
}

function loadTgState() {
  try {
    return JSON.parse(localStorage.getItem(getTgPostKey()) || 'null');
  } catch { return null; }
}

function saveTgState(state) {
  localStorage.setItem(getTgPostKey(), JSON.stringify(state));
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function tgSendPhoto(chatId, blob, caption, replyToMessageId) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'mafia.png');
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');
  if (replyToMessageId) {
    formData.append('reply_to_message_id', replyToMessageId);
  }

  console.log(`[TG] sendPhoto → chatId=${chatId}, replyTo=${replyToMessageId ?? 'null'}`);

  const res  = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  console.log(`[TG] ответ:`, JSON.stringify(json));

  if (!json.ok) throw new Error(`TG sendPhoto: ${json.description}`);
  return json.result;
}

async function tgSendPhotoToThread(chatId, blob, caption, threadId) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'mafia.png');
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');
  if (threadId) {
    formData.append('message_thread_id', String(threadId)); // ← String()!
  }

  console.log(`[TG] sendPhotoToThread → chatId=${chatId}, threadId=${threadId ?? 'null'}`);

  const res  = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  console.log('[TG] ответ:', JSON.stringify(json));

  if (!json.ok) throw new Error(`TG sendPhoto: ${json.description}`);
  return json.result;
}




async function tgDeleteMessage(chatId, messageId) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('message_id', messageId);

  const res  = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/deleteMessage`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  if (!json.ok) console.warn('tgDeleteMessage:', json.description);
}

async function publishResultsToTelegram() {
  const data = ResultsState.data;
  if (!data) { showToast('Нет данных'); return; }

  const finishedGames = ResultsState.gameNums.filter(n => data.games[n]?.finished);
  if (!finishedGames.length) { showToast('Нет завершённых игр'); return; }

  const btn = document.getElementById('barBtnTelegram');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Публикую...'; }

  try {
    showToast('Генерирую картинки...');

    const mediaItems = [];

    // 1. Картинка ИТОГОВ — первой, с подписью
    const summaryCanvas = await exportResultsAsImage(true);   // ← ПРАВИЛЬНОЕ ИМЯ
    if (summaryCanvas) {
      const summaryBlob = await canvasToBlob(summaryCanvas);
      mediaItems.push({
        blob: summaryBlob,
        caption: `🏆 *${data.title || 'Итоги вечера'}*\n${data.date || ''}`,
      });
    }

    // 2. Все завершённые игры
    for (const gameNum of finishedGames) {
      const gameCanvas = await exportGameAsImage(gameNum, true);
      if (!gameCanvas) continue;

      const gameBlob = await canvasToBlob(gameCanvas);
      const game     = data.games[gameNum];
      const winIcon  = winnerIcon(game.winner);
      const winLbl   = winnerLabel(game.winner);

      mediaItems.push({
        blob: gameBlob,
        caption: `🎮 Игра №${gameNum} — ${winIcon} ${winLbl}`,
      });
    }

    if (mediaItems.length === 0) {
      showToast('❌ Нет данных для публикации');
      return;
    }

    // 3. Отправляем пакетами по 10 (лимит Telegram)
    showToast(`Публикую ${mediaItems.length} картинок...`);

    for (let i = 0; i < mediaItems.length; i += 10) {
      const chunk = mediaItems.slice(i, i + 10);
      await tgSendMediaGroup(TG_CHANNEL_ID, chunk);
    }

    showToast('✅ Опубликовано в Telegram!');
  } catch (err) {
    console.error(err);
    showToast(`❌ Ошибка: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✈️ Опубликовать итоги'; }
  }
}   // ← ЭТА СКОБКА ЗАКРЫВАЕТ ФУНКЦИЮ (её не было!)

// ── Отправка альбома (media group) ────────────────────────
async function tgSendMediaGroup(chatId, items) {
  const fd = new FormData();
  fd.append('chat_id', chatId);

  const media = items.map((item, i) => {
    const key = `photo${i}`;
    fd.append(key, item.blob, `${key}.png`);
    const m = { type: 'photo', media: `attach://${key}` };
    if (item.caption) {
      m.caption = item.caption;
      m.parse_mode = 'Markdown';
    }
    return m;
  });

  fd.append('media', JSON.stringify(media));

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMediaGroup`;
  const res = await fetch(url, { method: 'POST', body: fd });
  const json = await res.json();
  console.log('[TG] sendMediaGroup ответ:', JSON.stringify(json).slice(0, 300));

  if (!json.ok) {
    console.error('[TG] Ошибка sendMediaGroup:', json.description);
    throw new Error(json.description);
  }
  return json.result;
}
