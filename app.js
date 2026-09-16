// ============================================================
// AbsensiMap — app.js (Vercel Serverless Version)
// ============================================================

(async function () {
  'use strict';

  // ---- State ----
  let user = null;
  let items = [];
  let progress = {}; // { item_id: [1, 2, 3] }
  let currentFilter = 'all';
  let searchQuery = '';
  
  const activeTimers = {};

  // ---- DOM Elements ----
  const $appContainer = document.getElementById('app-container');
  const $globalLoader = document.getElementById('global-loader');
  const $userNameDisplay = document.getElementById('user-name-display');
  const $userAvatarInitial = document.getElementById('user-avatar-initial');
  const $btnAdminLink = document.getElementById('btn-admin-link');
  const $btnLogout = document.getElementById('btn-logout');
  const $greetingTitle = document.getElementById('greeting-title');
  const $toastContainer = document.getElementById('toast-container');
  
  const $cardsGrid = document.getElementById('cards-grid');
  const $emptyState = document.getElementById('empty-state');
  const $searchInput = document.getElementById('search-input');
  const $filterChips = document.getElementById('filter-chips');
  
  const $statTotal = document.getElementById('stat-total');
  const $statRunning = document.getElementById('stat-running');
  const $statDone = document.getElementById('stat-done');
  const $statToday = document.getElementById('stat-today');
  
  const $todayPendingList = document.getElementById('today-pending-list');
  const $todayCompletedList = document.getElementById('today-completed-list');

  // ---- Initialize ----
  async function init() {
    try {
      user = await Auth.requireAuth();
      if (!user) return;
      
      setupUI();
      await loadData();
      renderAll();
      
      $appContainer.style.display = '';
      $globalLoader.classList.add('hidden');
      document.body.classList.add('loaded'); // Fixed opacity issue
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('Terjadi kesalahan sistem.', 'error');
    }
  }

  function setupUI() {
    $userNameDisplay.textContent = user.username;
    $userAvatarInitial.textContent = user.username.charAt(0).toUpperCase();
    $greetingTitle.textContent = `Halo, ${user.username}!`;
    
    if (user.role === 'admin') {
      $btnAdminLink.style.display = 'inline-flex';
    }

    $btnLogout.addEventListener('click', () => Auth.logout());
    
    $searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderCards();
    });

    $filterChips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      currentFilter = chip.dataset.filter;
      $filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderCards();
    });

    $cardsGrid.addEventListener('click', handleCardClicks);
  }

  // ---- Data Fetching ----
  async function loadData() {
    // 1. Fetch Items
    const itemsRes = await fetch('/api/items');
    if (itemsRes.ok) {
      items = await itemsRes.json();
    } else {
      showToast('Gagal memuat daftar absensi', 'error');
      items = [];
    }

    // 2. Fetch Progress
    const progRes = await fetch('/api/progress');
    if (progRes.ok) {
      progress = await progRes.json();
    } else {
      showToast('Gagal memuat progress', 'error');
      progress = {};
    }
  }

  // ---- Helpers ----
  function getProgressForItem(itemId) {
    return progress[itemId] || [];
  }

  function getCompletedDaysCount(itemId) {
    return getProgressForItem(itemId).length;
  }

  function isDayCompleted(itemId, dayNumber) {
    return getProgressForItem(itemId).includes(dayNumber);
  }
  
  function getNextDay(item) {
    const checkedDays = getProgressForItem(item.id);
    for (let i = 1; i <= item.duration_days; i++) {
      if (!checkedDays.includes(i)) return i;
    }
    return null; // All done
  }

  function getStatus(item) {
    const checked = getCompletedDaysCount(item.id);
    if (checked === 0) return 'idle';
    if (checked >= item.duration_days) return 'done';
    return 'running';
  }

  function getStatusLabel(status) {
    if (status === 'idle') return 'Belum Mulai';
    if (status === 'running') return 'Berjalan';
    return 'Selesai';
  }

  function calculatePct(item) {
    return Math.round((getCompletedDaysCount(item.id) / item.duration_days) * 100);
  }
  
  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      ${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}
      <span>${message}</span>
    `;
    $toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.4s var(--ease) forwards';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ---- Actions ----
  async function toggleDayCompletion(itemId, dayNumber, isCurrentlyCompleted) {
    const cell = document.querySelector(`.day-cell[data-item-id="${itemId}"][data-day="${dayNumber}"]`);
    const wasCompleted = isCurrentlyCompleted;
    
    if (cell) cell.classList.toggle('checked');
    
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, dayNumber, completed: !wasCompleted })
      });
      
      if (!res.ok) throw new Error('Failed');
      
      const data = await res.json();
      progress[itemId] = data.progress; // server returns updated array
      
      renderCards(); 
      renderStats();
      renderToday();
    } catch (err) {
      if (cell) cell.classList.toggle('checked');
      showToast('Gagal menyimpan progress.', 'error');
    }
  }

  // ---- Timer Logic ----
  function handleCardClicks(e) {
    const dayCell = e.target.closest('.day-cell');
    if (dayCell) {
      const itemId = dayCell.dataset.itemId;
      const dayNum = parseInt(dayCell.dataset.day);
      const isCompleted = dayCell.classList.contains('checked');
      toggleDayCompletion(itemId, dayNum, isCompleted);
      return;
    }

    const timerBtn = e.target.closest('.timer-btn');
    if (timerBtn) {
      const itemId = timerBtn.dataset.itemId;
      const action = timerBtn.dataset.action;
      const item = items.find(i => i.id === itemId);
      
      if (!item) return;

      if (action === 'start') startTimer(item);
      else if (action === 'pause') pauseTimer(item);
      else if (action === 'done') markTimerDone(item);
    }
  }
  
  function updateTimerUI(item) {
    const timerState = activeTimers[item.id];
    const timeDisplay = document.getElementById(`timer-time-${item.id}`);
    const btnStart = document.getElementById(`timer-btn-start-${item.id}`);
    const btnPause = document.getElementById(`timer-btn-pause-${item.id}`);
    const btnDone = document.getElementById(`timer-btn-done-${item.id}`);
    const reachedMsg = document.getElementById(`timer-reached-${item.id}`);
    
    if (!timeDisplay) return;

    const targetSeconds = item.required_minutes * 60;
    const currentSeconds = timerState ? timerState.secondsPassed : 0;
    const isRunning = timerState && timerState.state === 'running';
    const hasReachedTarget = currentSeconds >= targetSeconds;

    timeDisplay.textContent = formatTime(currentSeconds);

    if (isRunning) {
      btnStart.style.display = 'none';
      btnPause.style.display = 'flex';
      btnDone.style.display = 'none';
    } else {
      btnStart.style.display = 'flex';
      btnPause.style.display = 'none';
      btnDone.style.display = currentSeconds > 0 ? 'flex' : 'none'; 
    }

    if (hasReachedTarget) {
      btnStart.disabled = true;
      reachedMsg.classList.remove('hidden');
    } else {
      btnStart.disabled = false;
      reachedMsg.classList.add('hidden');
    }
  }

  function startTimer(item) {
    if (!activeTimers[item.id]) {
      activeTimers[item.id] = { secondsPassed: 0, state: 'running' };
    }
    
    const state = activeTimers[item.id];
    if (state.state === 'running' && state.intervalId) return;
    
    state.state = 'running';
    state.intervalId = setInterval(() => {
      state.secondsPassed++;
      updateTimerUI(item);
    }, 1000);
    
    updateTimerUI(item);
  }

  function pauseTimer(item) {
    const state = activeTimers[item.id];
    if (!state) return;
    
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.state = 'paused';
    
    updateTimerUI(item);
  }
  
  function markTimerDone(item) {
    pauseTimer(item);
    const nextDay = getNextDay(item);
    
    if (nextDay !== null) {
      toggleDayCompletion(item.id, nextDay, false);
      showToast(`Absensi Day ${nextDay} untuk ${item.name} berhasil diselesaikan.`, 'success');
    } else {
      showToast(`${item.name} sudah selesai semua hari!`, 'success');
    }
    
    delete activeTimers[item.id];
    updateTimerUI(item);
  }

  // ---- Filtering ----
  function filteredData() {
    let result = items;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.map_name.toLowerCase().includes(q)
      );
    }

    if (currentFilter === '7') result = result.filter(d => d.duration_days === 7);
    else if (currentFilter === '14') result = result.filter(d => d.duration_days === 14);
    else if (currentFilter === '30') result = result.filter(d => d.duration_days === 30);
    else if (currentFilter === 'running') result = result.filter(d => getStatus(d) === 'running');
    else if (currentFilter === 'done') result = result.filter(d => getStatus(d) === 'done');

    return result;
  }

  // ---- Renderers ----
  function renderStats() {
    const total = items.length;
    let running = 0, done = 0;
    
    items.forEach(item => {
      const s = getStatus(item);
      if (s === 'running') running++;
      if (s === 'done') done++;
    });
    
    $statTotal.textContent = total;
    $statRunning.textContent = running;
    $statDone.textContent = done;
  }

  function renderToday() {
    let pendingHTML = '';
    let completedHTML = '';
    let pendingCount = 0;
    let completedCount = 0;
    
    // In this Vercel KV version, we simply consider "today" as items that still have a next day available.
    // If we wanted exact daily tracking we'd need to store timestamps in progress arrays.

    items.forEach(item => {
      const nextDay = getNextDay(item);

      if (nextDay !== null) {
        pendingCount++;
        pendingHTML += `
          <div class="today-item">
            <div class="today-item-name">
              <div class="dot red"></div>
              ${escHtml(item.name)}
            </div>
            <div class="today-item-info">
              <span>📍 ${escHtml(item.map_name)}</span>
              <span>⏱️ Stay: ${item.required_minutes} mnt</span>
              <span>📅 Target: Day ${nextDay}</span>
            </div>
          </div>
        `;
      } else {
        completedCount++;
        completedHTML += `
          <div class="today-item">
            <div class="today-item-name">
              <div class="dot green"></div>
              ${escHtml(item.name)}
            </div>
            <div class="today-item-info">
              <span>Semua hari sudah selesai!</span>
            </div>
          </div>
        `;
      }
    });

    if (pendingCount === 0) pendingHTML = `<div class="today-empty">Hebat! Semua absensi hari ini sudah selesai.</div>`;
    if (completedCount === 0) completedHTML = `<div class="today-empty">Belum ada absensi yang diselesaikan hari ini.</div>`;

    $todayPendingList.innerHTML = pendingHTML;
    $todayCompletedList.innerHTML = completedHTML;
    
    $statToday.textContent = `${completedCount}/${completedCount + pendingCount}`;
  }

  function renderCards() {
    const list = filteredData();

    if (!list.length) {
      $cardsGrid.style.display = 'none';
      $emptyState.style.display = '';
      return;
    }
    
    $cardsGrid.style.display = '';
    $emptyState.style.display = 'none';

    $cardsGrid.innerHTML = list.map((item, idx) => {
      const status = getStatus(item);
      const statusLabel = getStatusLabel(status);
      const percent = calculatePct(item);
      const checkedCount = getCompletedDaysCount(item.id);
      const nextDay = getNextDay(item);
      
      let daysCells = '';
      for (let i = 1; i <= item.duration_days; i++) {
        const isChecked = isDayCompleted(item.id, i);
        const cls = isChecked ? 'day-cell checked' : 'day-cell';
        daysCells += `<div class="${cls}" data-item-id="${item.id}" data-day="${i}" title="Day ${i}">${i}</div>`;
      }
      
      const tState = activeTimers[item.id] || { secondsPassed: 0, state: 'paused' };
      const displayTime = formatTime(tState.secondsPassed);
      const isRunning = tState.state === 'running';
      const hasReached = tState.secondsPassed >= (item.required_minutes * 60);

      return `
        <div class="card" style="animation-delay:${idx * 0.05}s" data-card-id="${item.id}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-name">${escHtml(item.name)}</span>
              <span class="card-duration-badge">${item.duration_days} Hari</span>
              <div class="card-meta">
                <span class="card-status status-${status}">
                  <span class="status-dot"></span>
                  ${statusLabel}
                </span>
              </div>
            </div>
          </div>
          
          <div class="card-map-info">
            <div class="card-map-info-row">
              <span class="info-icon">📍</span>
              <span class="info-label">Map:</span>
              <span class="info-value">${escHtml(item.map_name) || '-'}</span>
            </div>
            <div class="card-map-info-row">
              <span class="info-icon">⏱️</span>
              <span class="info-label">Wajib Stay:</span>
              <span class="info-value">${item.required_minutes} Menit</span>
            </div>
          </div>
          
          <div class="card-next-day">
            ${nextDay ? 
              `<div class="next-day-badge">Absensi berikutnya: Day ${nextDay}</div>` : 
              `<div class="next-day-badge complete">Semua Hari Selesai ✓</div>`
            }
          </div>

          <div class="card-progress">
            <div class="progress-info">
              <span class="progress-text">Progress: ${checkedCount}/${item.duration_days}</span>
              <span class="progress-pct">${percent}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${status === 'done' ? 'complete' : ''}" style="width:${percent}%"></div>
            </div>
          </div>
          
          <div class="card-days">
            <div class="card-days-grid">
              ${daysCells}
            </div>
          </div>
          
          <div class="card-timer">
            <div class="timer-header">Stay Timer</div>
            <div class="timer-display">
              <div class="timer-time">
                <span id="timer-time-${item.id}">${displayTime}</span>
                <span class="timer-separator">/</span>
                <span class="timer-target">${formatTime(item.required_minutes * 60)}</span>
              </div>
              <div class="timer-controls">
                <button class="timer-btn timer-btn-start" id="timer-btn-start-${item.id}" data-item-id="${item.id}" data-action="start" style="display: ${isRunning ? 'none' : 'flex'}" title="Mulai Stay">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <button class="timer-btn" id="timer-btn-pause-${item.id}" data-item-id="${item.id}" data-action="pause" style="display: ${isRunning ? 'flex' : 'none'}" title="Pause">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </button>
                <button class="timer-btn timer-btn-done" id="timer-btn-done-${item.id}" data-item-id="${item.id}" data-action="done" style="display: ${tState.secondsPassed > 0 && !isRunning ? 'flex' : 'none'}" title="Selesai & Centang Day">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>
            <div class="timer-reached ${hasReached ? '' : 'hidden'}" id="timer-reached-${item.id}">
              ✓ Durasi minimum tercapai
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:8px;">Timer hanya merupakan alat bantu hitung.</div>
          </div>
        </div>`;
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderToday();
    renderCards();
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Bootstrap ----
  document.addEventListener('DOMContentLoaded', init);

})();
