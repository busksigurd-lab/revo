// ════════════════════════════════════════════════════════════
//  stats.js — Статистика игроков и история вечеров
// ════════════════════════════════════════════════════════════

'use strict';

// ── Состояние ────────────────────────────────────────────────
const StatsState = {
  activeTab:  'players',   // 'players' | 'history'
  search:     '',
  allPlayers: [],          // агрегат по всем вечерам
  history:    [],          // массив eveningResults из mafiaHistory
};

// ════════════════════════════════════════════════════════════
//  ЗАГРУЗКА ДАННЫХ
// ════════════════════════════════════════════════════════════

function loadHistory() {
  const raw = localStorage.getItem('mafiaHistory');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// Агрегируем статистику по всем вечерам
function buildPlayersAggregate(history) {
  const map = {}; // name -> stats

  history.forEach(evening => {
    Object.values(evening.games || {}).forEach(game => {
      (game.players || []).forEach(p => {
        if (!map[p.name]) {
          map[p.name] = {
            name:       p.name,
            games:      0,
            wins:       0,
            totalPts:   0,
            roles:      {},   // { МАФ: 3, МИР: 5, ... }
            evenings:   0,
            winRate:    0,
          };
        }
        const s = map[p.name];
        s.games++;
        if (p.won) s.wins++;
        s.totalPts = Math.round((s.totalPts + p.total) * 1000) / 1000;
        s.roles[p.role] = (s.roles[p.role] || 0) + 1;
      });
    });
  });

  // Считаем evenings (уникальных вечеров для каждого игрока)
  history.forEach(evening => {
    const namesInEvening = new Set();
    Object.values(evening.games || {}).forEach(game => {
      (game.players || []).forEach(p => namesInEvening.add(p.name));
    });
    namesInEvening.forEach(name => {
      if (map[name]) map[name].evenings++;
    });
  });

  // winRate
  Object.values(map).forEach(s => {
    s.winRate = s.games > 0
      ? Math.round((s.wins / s.games) * 100)
      : 0;
  });

  return Object.values(map)
    .sort((a, b) => b.totalPts - a.totalPts || b.wins - a.wins);
}

// ════════════════════════════════════════════════════════════
//  РЕНДЕР — ВКЛАДКА "ИГРОКИ"
// ════════════════════════════════════════════════════════════

function renderPlayersTab() {
  const body   = document.getElementById('statsBody');
  const search = StatsState.search.toLowerCase().trim();

  document.getElementById('statsSearchCard').hidden = false;

  let players = StatsState.allPlayers;

  if (search) {
    players = players.filter(p =>
      p.name.toLowerCase().includes(search)
    );
  }

  if (!players.length) {
    body.innerHTML = `
      <div class="empty-state">
        ${StatsState.allPlayers.length
          ? 'Игрок не найден'
          : 'История пуста — сохраните хотя бы один вечер'}
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="card stats-table-card">
      <div class="card-title">👤 Все игроки</div>
      <div class="results-table-wrap">
        <table class="results-table stats-players-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-name" style="text-align:left">Игрок</th>
              <th>Вечеров</th>
              <th>Игр</th>
              <th>Побед</th>
              <th>Win%</th>
              <th>Очки</th>
            </tr>
          </thead>
          <tbody>
            ${players.map((p, i) => `
              <tr class="stats-player-row ${i < 3 ? 'row-top' : ''}"
                  data-name="${escHtml(p.name)}">
                <td class="col-rank">${rankBadge(i)}</td>
                <td class="col-name stats-player-name">${escHtml(p.name)}</td>
                <td>${p.evenings}</td>
                <td>${p.games}</td>
                <td>${p.wins}</td>
                <td>
                  <div class="winrate-wrap">
                    <div class="winrate-bar">
                      <div class="winrate-fill" style="width:${p.winRate}%"></div>
                    </div>
                    <span class="winrate-pct">${p.winRate}%</span>
                  </div>
                </td>
                <td><strong>${p.totalPts}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Клик по строке — открыть детальную стату
  body.querySelectorAll('.stats-player-row').forEach(row => {
    row.addEventListener('click', () => {
      openPlayerStats(row.dataset.name);
    });
  });
}

// ════════════════════════════════════════════════════════════
//  МОДАЛКА — ДЕТАЛЬНАЯ СТАТИСТИКА ИГРОКА
// ════════════════════════════════════════════════════════════

function openPlayerStats(name) {
  const player = StatsState.allPlayers.find(p => p.name === name);
  if (!player) return;

  document.getElementById('playerStatsName').textContent = name;

  // Собираем историю игр этого игрока
  const gameHistory = [];
  StatsState.history.forEach(evening => {
    Object.values(evening.games || {}).forEach(game => {
      const p = (game.players || []).find(pl => pl.name === name);
      if (!p) return;
      gameHistory.push({
        eveningTitle: evening.title || '',
        eveningDate:  evening.date  || '',
        gameNum:      game.gameNum,
        role:         p.role,
        won:          p.won,
        base:         p.base,
        extra:        p.extra,
        total:        p.total,
        winner:       game.winner,
      });
    });
  });

  // Роли — топ
  const rolesSorted = Object.entries(player.roles)
    .sort((a, b) => b[1] - a[1]);

  const rolesHtml = rolesSorted.map(([role, count]) => `
    <div class="role-stat-chip">
      <span class="role-tag ${roleTagClass(role)}">${role}</span>
      <span class="role-stat-count">${count}×</span>
    </div>
  `).join('');

  // История в таблице
  const historyHtml = gameHistory.length ? `
    <div class="player-stats-section-title">📋 История игр</div>
    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>Вечер</th>
            <th>Игра</th>
            <th>Роль</th>
            <th>Итог</th>
            <th>Очки</th>
          </tr>
        </thead>
        <tbody>
          ${gameHistory.map(g => `
            <tr class="${g.won ? 'row-winner' : 'row-loser'}">
              <td style="font-size:11px;white-space:nowrap">
                ${escHtml(g.eveningTitle || g.eveningDate)}
              </td>
              <td>№${g.gameNum}</td>
              <td>
                <span class="role-tag ${roleTagClass(g.role)}">${g.role||'?'}</span>
              </td>
              <td>${g.won ? '✅ Победа' : '❌ Пораж.'}</td>
              <td><strong>${g.total}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '<div class="empty-state" style="padding:16px">Нет игр</div>';

  document.getElementById('playerStatsBody').innerHTML = `
    <!-- Мини-дашборд -->
    <div class="player-stats-dash">
      <div class="player-stats-kpi">
        <div class="kpi-value">${player.games}</div>
        <div class="kpi-label">Игр</div>
      </div>
      <div class="player-stats-kpi">
        <div class="kpi-value">${player.wins}</div>
        <div class="kpi-label">Побед</div>
      </div>
      <div class="player-stats-kpi">
        <div class="kpi-value">${player.winRate}%</div>
        <div class="kpi-label">Win%</div>
      </div>
      <div class="player-stats-kpi">
        <div class="kpi-value">${player.totalPts}</div>
        <div class="kpi-label">Очков</div>
      </div>
    </div>

    <!-- Роли -->
    <div class="player-stats-section-title">🎭 Роли</div>
    <div class="roles-stat-row">${rolesHtml}</div>

    <!-- История -->
    ${historyHtml}
  `;

  document.getElementById('playerStatsModal').classList.add('open');
}

// ════════════════════════════════════════════════════════════
//  РЕНДЕР — ВКЛАДКА "ИСТОРИЯ ВЕЧЕРОВ"
// ════════════════════════════════════════════════════════════

function renderHistoryTab() {
  const body = document.getElementById('statsBody');
  document.getElementById('statsSearchCard').hidden = true;

  if (!StatsState.history.length) {
    body.innerHTML = `
      <div class="empty-state">
        История вечеров пуста.<br>
        Сохраните вечер через страницу Результатов.
      </div>`;
    return;
  }

  const items = [...StatsState.history]
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  body.innerHTML = items.map((ev, idx) => {
    const gamesCount  = Object.keys(ev.games || {}).length;
    const winners     = Object.values(ev.games || {})
      .map(g => winnerIcon(g.winner))
      .join(' ');
    const dateStr = ev.date
      ? ev.date
      : ev.savedAt
        ? new Date(ev.savedAt).toLocaleDateString('ru-RU')
        : '';

    return `
      <div class="card history-evening-card" data-idx="${idx}">
        <div class="history-card-top">
          <div class="history-card-title">${escHtml(ev.title || 'Вечер')}</div>
          <div class="history-card-date">${dateStr}</div>
        </div>
        <div class="history-card-meta">
          <span class="history-chip">🎮 ${gamesCount} игр</span>
          <span class="history-chip">${winners}</span>
        </div>
        <div class="history-card-actions">
          <button class="btn btn-secondary btn-sm btn-history-view"
                  data-idx="${idx}">👁 Подробнее</button>
          <button class="btn btn-danger btn-sm btn-history-delete"
                  data-idx="${idx}">🗑 Удалить</button>
        </div>
      </div>
    `;
  }).join('');

  // Подробнее → results.html с данными этого вечера
  body.querySelectorAll('.btn-history-view').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.idx, 10);
      const ev = items[i];
      // Временно кладём в eveningResults и открываем results.html
      localStorage.setItem('eveningResults', JSON.stringify(ev));
      window.location.href = 'results.html';
    });
  });

  // Удалить
  body.querySelectorAll('.btn-history-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.idx, 10);
      if (!confirm('Удалить этот вечер из истории?')) return;
      const sorted = [...StatsState.history]
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      const realIdx = StatsState.history.indexOf(sorted[i]);
      StatsState.history.splice(realIdx, 1);
      localStorage.setItem('mafiaHistory',
        JSON.stringify(StatsState.history));
      renderHistoryTab();
    });
  });
}

// ════════════════════════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ
// ════════════════════════════════════════════════════════════

function rankBadge(i) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return i + 1;
}

function winnerIcon(team) {
  return { civil: '🕊', mafia: '🔫', maniac: '🔪' }[team] || '❓';
}

function roleTagClass(role) {
  return {
    'МАФ': 'role-mafia',
    'ДОН': 'role-don',
    'ШЕР': 'role-sheriff',
    'МИР': 'role-civil',
    'МАН': 'role-maniac',
    'ДОК': 'role-doc',
    'ЛЮБ': 'role-lover',
  }[role] || 'role-civil';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════
//  СОБЫТИЯ
// ════════════════════════════════════════════════════════════

function bindStatsEvents() {

  // Табы
  document.querySelectorAll('#statsTabsNav .results-tab-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        StatsState.activeTab = btn.dataset.tab;
        document.querySelectorAll('#statsTabsNav .results-tab-btn')
          .forEach(b => b.classList.toggle('active', b === btn));
        renderActiveStatsTab();
      });
    });

  // Поиск
  document.getElementById('statsSearch')
    ?.addEventListener('input', e => {
      StatsState.search = e.target.value;
      renderPlayersTab();
    });

  // Закрыть модалку игрока
  document.getElementById('playerStatsClose')
    ?.addEventListener('click', () => {
      document.getElementById('playerStatsModal')
        .classList.remove('open');
    });

  document.getElementById('playerStatsModal')
    ?.addEventListener('click', e => {
      if (e.target === e.currentTarget)
        e.currentTarget.classList.remove('open');
    });
}

function renderActiveStatsTab() {
  if (StatsState.activeTab === 'players') renderPlayersTab();
  else renderHistoryTab();
}

// ════════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  StatsState.history    = loadHistory();
  StatsState.allPlayers = buildPlayersAggregate(StatsState.history);
  bindStatsEvents();
  renderActiveStatsTab();
});