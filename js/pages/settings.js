// ============================================================
//  SETTINGS.JS
// ============================================================

// ── Дефолтный пресет ────────────────────────────────────────
const DEFAULT_PRESET = {
  speechSeconds: 45,
  zeroVote:      false,
  winPoints: {
    civil:   4,
    mafia:   5,
    maniac:  6,
  },
  extraStep: 1,
};

const STARTER_PRESETS = {
  funky: {
    name:          'Фанки',
    speechSeconds: 45,
    zeroVote:      false,
    winPoints:     { civil: 4, mafia: 5, maniac: 6 },
    extraStep:     1,
  },
  tournament12: {
    name:          'Турнир на 12',
    speechSeconds: 60,
    zeroVote:      true,
    winPoints:     { civil: 4, mafia: 5, maniac: 6 },
    extraStep:     0.25,
  },
  royal: {
    name:          'Царский',
    speechSeconds: 45,
    zeroVote:      false,
    winPoints:     { civil: 4, mafia: 5, maniac: 6 },
    extraStep:     1,
  },
};

// ── Состояние ────────────────────────────────────────────────
let settingsData   = null;
let currentPreset  = null;
let selectedSpeech = 45;

// ════════════════════════════════════════════════════════════
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ════════════════════════════════════════════════════════════

function loadSettings() {
  const raw = localStorage.getItem('appSettings');
  if (raw) {
    settingsData = JSON.parse(raw);
  } else {
    settingsData = {
      activePreset: 'funky',
      presets:      { ...STARTER_PRESETS },
    };
    saveSettingsToStorage();
  }
  currentPreset = settingsData.activePreset;
}

function saveSettingsToStorage() {
  localStorage.setItem('appSettings', JSON.stringify(settingsData));
}

function getActivePreset() {
  const raw = localStorage.getItem('appSettings');
  if (!raw) return { ...DEFAULT_PRESET };
  const data = JSON.parse(raw);
  return data.presets?.[data.activePreset] || { ...DEFAULT_PRESET };
}

// ════════════════════════════════════════════════════════════
//  РЕНДЕР ПРЕСЕТОВ
// ════════════════════════════════════════════════════════════

function renderPresetList() {
  const container = document.getElementById('presetList');
  container.innerHTML = '';

  Object.entries(settingsData.presets).forEach(([id, preset]) => {
    const isActive = id === currentPreset;

    const item = document.createElement('div');
    item.className = 'preset-item' + (isActive ? ' active' : '');
    item.dataset.id = id;

    item.innerHTML = `
      <span class="preset-item__name">${escapeHtml(preset.name)}</span>
      <span class="preset-item__check">${isActive ? '✓' : ''}</span>
      <button class="preset-item__delete" data-id="${id}" title="Удалить">✕</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-item__delete')) return;
      selectPreset(id);
    });

    item.querySelector('.preset-item__delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deletePreset(id);
    });

    container.appendChild(item);
  });
}

// ════════════════════════════════════════════════════════════
//  ВЫБОР ПРЕСЕТА
// ════════════════════════════════════════════════════════════

function selectPreset(id) {
  currentPreset = id;
  settingsData.activePreset = id;
  loadPresetToUI(settingsData.presets[id]);
  renderPresetList();
}

function loadPresetToUI(preset) {
  selectedSpeech = preset.speechSeconds ?? 45;
  updateSpeechUI();

  document.getElementById('zeroVoteToggle').checked = !!preset.zeroVote;
  document.getElementById('pointsCivil').value       = preset.winPoints?.civil  ?? 4;
  document.getElementById('pointsMafia').value       = preset.winPoints?.mafia  ?? 5;
  document.getElementById('pointsManiac').value      = preset.winPoints?.maniac ?? 6;
  document.getElementById('extraStep').value         = preset.extraStep ?? 1;
}

// ════════════════════════════════════════════════════════════
//  UI РЕЧИ
// ════════════════════════════════════════════════════════════

function updateSpeechUI() {
  document.querySelectorAll('.speech-preset-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.sec === selectedSpeech);
  });
  document.getElementById('speechCurrentVal').textContent = selectedSpeech;
}

// ════════════════════════════════════════════════════════════
//  СОХРАНИТЬ
// ════════════════════════════════════════════════════════════

function saveCurrentPreset() {
  const preset = settingsData.presets[currentPreset];
  if (!preset) return;

  preset.speechSeconds = selectedSpeech;
  preset.zeroVote      = document.getElementById('zeroVoteToggle').checked;
  preset.winPoints = {
    civil:  parseFloat(document.getElementById('pointsCivil').value)  || 4,
    mafia:  parseFloat(document.getElementById('pointsMafia').value)  || 5,
    maniac: parseFloat(document.getElementById('pointsManiac').value) || 6,
  };
  preset.extraStep = parseFloat(document.getElementById('extraStep').value) || 1;

  settingsData.activePreset = currentPreset;
  saveSettingsToStorage();
  renderPresetList();
  showToast('Настройки сохранены ✅');
}

// ════════════════════════════════════════════════════════════
//  ДОБАВИТЬ ПРЕСЕТ
// ════════════════════════════════════════════════════════════

function addPreset() {
  const nameInput = document.getElementById('newPresetName');
  const name      = nameInput.value.trim();
  if (!name) { showToast('Введите название пресета', 'error'); return; }

  const id = 'preset_' + Date.now();
  settingsData.presets[id] = { name, ...DEFAULT_PRESET };
  nameInput.value = '';
  selectPreset(id);
  showToast(`Пресет "${name}" создан`);
}

// ════════════════════════════════════════════════════════════
//  УДАЛИТЬ ПРЕСЕТ
// ════════════════════════════════════════════════════════════

function deletePreset(id) {
  const presets = settingsData.presets;
  if (Object.keys(presets).length <= 1) {
    showToast('Нельзя удалить последний пресет', 'error');
    return;
  }
  const name = presets[id]?.name || id;
  if (!confirm(`Удалить пресет "${name}"?`)) return;

  delete presets[id];

  if (currentPreset === id) {
    selectPreset(Object.keys(presets)[0]);
  } else {
    renderPresetList();
  }

  saveSettingsToStorage();
  showToast('Пресет удалён');
}

// ════════════════════════════════════════════════════════════
//  СОБЫТИЯ
// ════════════════════════════════════════════════════════════

function bindEvents() {
  // Бургер
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('visible');
  });

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  }
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Речь
  document.getElementById('speechBtns').addEventListener('click', (e) => {
    const btn = e.target.closest('.speech-preset-btn');
    if (!btn) return;
    selectedSpeech = +btn.dataset.sec;
    updateSpeechUI();
  });

  // Пресеты
  document.getElementById('btnAddPreset').addEventListener('click', addPreset);
  document.getElementById('newPresetName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPreset();
  });

  // Сохранить
  document.getElementById('btnSaveSettings').addEventListener('click', saveCurrentPreset);
}

// ════════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  renderPresetList();
  loadPresetToUI(settingsData.presets[currentPreset]);
  bindEvents();
});