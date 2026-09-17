// ============================================================
// AbsensiMap — script.js
// Attendance tracker with Firebase Realtime Database sync
// (fallback ke localStorage kalau Firebase belum dikonfigurasi)
// ============================================================

(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'absensimap_data';

  const DEFAULT_DATA = [
    { name: '404', duration: 30 },
    { name: '90s blok', duration: 30 },
    { name: 'flux', duration: 30 },
    { name: 'lawson', duration: 30 },
    { name: 'la miami', duration: 30 },
    { name: 'noir pulse', duration: 30 },
  ];

  // ---- State ----
  let data = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let editingId = null; // null = add mode, id = edit mode
  let selectedDuration = 30;
  let selectedResetMode = 'fixed'; // 'fixed' | 'rolling'
  let selectedResetHour = 0; // dipakai kalau resetMode === 'fixed'
  let dayModalItemId = null;

  // ---- Sync state ----
  let useFirebase = false;
  let db = null;
  let auth = null;
  let itemsRef = null;
  let firstSyncDone = false;
  let currentUser = null;
  let authMode = 'login'; // 'login' | 'register'

  // ---- DOM refs ----
  const $cardsGrid = document.getElementById('cards-grid');
  const $emptyState = document.getElementById('empty-state');
  const $searchInput = document.getElementById('search-input');
  const $filterChips = document.getElementById('filter-chips');
  const $statTotal = document.getElementById('stat-total');
  const $statRunning = document.getElementById('stat-running');
  const $statDone = document.getElementById('stat-done');
  const $statAttendance = document.getElementById('stat-attendance');
  const $syncBadge = document.getElementById('sync-badge');
  const $appRoot = document.getElementById('app-root');
  const $userEmail = document.getElementById('user-email');
  const $btnLogout = document.getElementById('btn-logout');

  // Auth screen
  const $authScreen = document.getElementById('auth-screen');
  const $authEmail = document.getElementById('auth-email');
  const $authPassword = document.getElementById('auth-password');
  const $authError = document.getElementById('auth-error');
  const $authInfo = document.getElementById('auth-info');
  const $authSubmit = document.getElementById('auth-submit');
  const $authForgot = document.getElementById('auth-forgot');
  const $authSwitchText = document.getElementById('auth-switch-text');
  const $authSwitchBtn = document.getElementById('auth-switch-btn');
  const $authOfflineNote = document.getElementById('auth-offline-note');

  // Modal: Form
  const $modalForm = document.getElementById('modal-form');
  const $modalFormTitle = document.getElementById('modal-form-title');
  const $inputName = document.getElementById('input-name');
  const $inputNote = document.getElementById('input-note');
  const $durationOptions = document.getElementById('duration-options');
  const $resetModeOptions = document.getElementById('reset-mode-options');
  const $resetHourRow = document.getElementById('reset-hour-row');
  const $inputResetHour = document.getElementById('input-reset-hour');
  const $modalFormSave = document.getElementById('modal-form-save');

  // Modal: Confirm
  const $modalConfirm = document.getElementById('modal-confirm');
  const $modalConfirmTitle = document.getElementById('modal-confirm-title');
  const $modalConfirmMsg = document.getElementById('modal-confirm-msg');
  const $modalConfirmOk = document.getElementById('modal-confirm-ok');

  // Modal: Days
  const $modalDays = document.getElementById('modal-days');
  const $modalDaysTitle = document.getElementById('modal-days-title');
  const $modalDaysNote = document.getElementById('modal-days-note');
  const $modalDaysResetMode = document.getElementById('modal-days-reset-mode');
  const $modalDaysTodayBadge = document.getElementById('modal-days-today-badge');
  const $modalDaysClaimDetail = document.getElementById('modal-days-claim-detail');
  const $modalDaysClaimBtn = document.getElementById('modal-days-claim-btn');
  const $daysGrid = document.getElementById('days-grid');
  const $daysProgressText = document.getElementById('modal-days-progress-text');
  const $daysProgressPct = document.getElementById('modal-days-progress-pct');
  const $daysProgressFill = document.getElementById('modal-days-progress-fill');

  // ---- Date & reset-mode helpers ----
  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateStrFromDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // "Tanggal logis" hari ini, digeser sesuai jam reset (mis. resetHour=20 -> hari
  // baru dianggap mulai jam 20:00, bukan jam 00:00). Catatan: pakai jam lokal
  // device, jadi asumsinya device kamu sudah di zona WIB.
  function logicalDateStr(resetHour) {
    const d = new Date(Date.now() - (resetHour || 0) * 3600000);
    return dateStrFromDate(d);
  }

  function todayStr() {
    return logicalDateStr(0);
  }

  function daysBetween(startStr, endStr) {
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    return Math.round((end - start) / 86400000);
  }

  function formatDuration(ms) {
    const totalMin = Math.max(0, Math.ceil(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  }

  // Status absen hari ini, tergantung resetMode item:
  // - 'fixed'   -> reset di jam tertentu (resetHour), sama buat semua device
  // - 'rolling' -> reset 24 jam persis sejak klik "Absen Sekarang" terakhir
  function getClaimStatus(item) {
    const resetHour = item.resetHour || 0;

    if (item.resetMode === 'rolling') {
      if (getChecked(item) >= item.duration) {
        return { eligible: false, state: 'finished', label: 'Periode Selesai', detail: '', idx: -1 };
      }
      if (!item.lastClaimAt) {
        return { eligible: true, state: 'absent', label: '✕ Belum Absen', detail: 'Klik "Absen Sekarang" untuk mulai', idx: -1 };
      }
      const nextAt = item.lastClaimAt + 24 * 3600 * 1000;
      const now = Date.now();
      if (now >= nextAt) {
        return { eligible: true, state: 'absent', label: '✕ Belum Absen', detail: 'Sudah bisa absen lagi', idx: -1 };
      }
      return { eligible: false, state: 'present', label: '✓ Sudah Absen', detail: `Reset dalam ${formatDuration(nextAt - now)}`, idx: -1 };
    }

    // fixed mode (termasuk default jam 00:00)
    if (!item.startDate) return { eligible: false, state: 'not-started', label: 'Belum Dimulai', detail: '', idx: -1 };
    const idx = daysBetween(item.startDate, logicalDateStr(resetHour));
    const resetLabel = resetHour === 0 ? 'jam 00:00' : `jam ${pad2(resetHour)}:00`;
    if (idx < 0) return { eligible: false, state: 'not-started', label: 'Belum Dimulai', detail: '', idx };
    if (idx >= item.duration) return { eligible: false, state: 'finished', label: 'Periode Selesai', detail: '', idx };
    if (item.attendance[idx]) {
      return { eligible: false, state: 'present', label: '✓ Sudah Absen Hari Ini', detail: `Reset ${resetLabel}`, idx };
    }
    return { eligible: true, state: 'absent', label: '✕ Belum Absen Hari Ini', detail: `Reset ${resetLabel}`, idx };
  }

  function resetModeLabel(item) {
    if (item.resetMode === 'rolling') return '24 jam dari klik terakhir';
    const h = item.resetHour || 0;
    return h === 0 ? 'Jam 00:00 (ganti tanggal)' : `Jam ${pad2(h)}:00`;
  }

  // Klik tombol "Absen Sekarang"
  function claimAttendance(itemId) {
    const item = data.find(d => d.id === itemId);
    if (!item) return;
    const status = getClaimStatus(item);
    if (!status.eligible) return;

    if (item.resetMode === 'rolling') {
      const idx = item.attendance.findIndex(v => !v);
      if (idx === -1) return;
      item.attendance[idx] = true;
    } else {
      if (status.idx < 0 || status.idx >= item.duration) return;
      item.attendance[status.idx] = true;
    }
    item.lastClaimAt = Date.now();
    saveData();
    render();
  }

  // ---- Unique id (aman dipakai multi-device tanpa tabrakan) ----
  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---- Normalisasi data (jaga-jaga data lama/format beda) ----
  function normalizeData() {
    data.forEach(item => {
      if (!Array.isArray(item.attendance)) item.attendance = [];
      while (item.attendance.length < item.duration) item.attendance.push(false);
      if (item.attendance.length > item.duration) item.attendance = item.attendance.slice(0, item.duration);
      if (typeof item.note !== 'string') item.note = '';
      if (!item.startDate) item.startDate = todayStr();
      if (item.resetMode !== 'fixed' && item.resetMode !== 'rolling') item.resetMode = 'fixed';
      if (typeof item.resetHour !== 'number' || item.resetHour < 0 || item.resetHour > 23) item.resetHour = 0;
      if (typeof item.lastClaimAt !== 'number') item.lastClaimAt = null;
      if (item.id === undefined || item.id === null) item.id = makeId();
      item.id = String(item.id);
    });
  }

  // ---- Firebase init ----
  function initFirebase() {
    try {
      const cfg = window.firebaseConfig;
      const looksConfigured = cfg && cfg.apiKey && !String(cfg.apiKey).includes('GANTI') && cfg.databaseURL;
      if (looksConfigured && window.firebase) {
        firebase.initializeApp(cfg);
        db = firebase.database();
        auth = firebase.auth();
        useFirebase = true;
      } else {
        useFirebase = false;
      }
    } catch (e) {
      console.warn('Firebase init gagal, fallback ke localStorage:', e);
      useFirebase = false;
    }
  }

  // ---- Auth screen show/hide ----
  function showAuthScreen() {
    $authScreen.style.display = 'flex';
    $appRoot.style.display = 'none';
  }

  function showApp() {
    $authScreen.style.display = 'none';
    $appRoot.style.display = '';
  }

  function setAuthError(msg) {
    $authInfo.style.display = 'none';
    if (!msg) { $authError.style.display = 'none'; return; }
    $authError.textContent = msg;
    $authError.style.display = '';
  }

  function setAuthInfo(msg) {
    $authError.style.display = 'none';
    if (!msg) { $authInfo.style.display = 'none'; return; }
    $authInfo.textContent = msg;
    $authInfo.style.display = '';
  }

  function translateAuthError(err) {
    const map = {
      'auth/invalid-email': 'Format email tidak valid.',
      'auth/user-not-found': 'Akun dengan email ini tidak ditemukan.',
      'auth/wrong-password': 'Password salah.',
      'auth/invalid-credential': 'Email atau password salah.',
      'auth/email-already-in-use': 'Email ini sudah terdaftar. Coba masuk saja.',
      'auth/weak-password': 'Password terlalu lemah, minimal 6 karakter.',
      'auth/too-many-requests': 'Terlalu banyak percobaan gagal. Coba lagi nanti.',
      'auth/network-request-failed': 'Gagal konek ke server, cek koneksi internet.',
      'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method → aktifkan Email/Password).',
      'auth/configuration-not-found': 'Firebase Authentication belum di-setup untuk project ini (buka Authentication → Get started di Firebase Console).',
      'auth/unauthorized-domain': 'Domain/alamat website ini belum diizinkan di Firebase (Authentication → Settings → Authorized domains → tambahkan domainnya).',
    };
    return map[err.code] || `Terjadi kesalahan: ${err.message}`;
  }

  function updateAuthModeUI() {
    if (authMode === 'login') {
      $authSubmit.textContent = 'Masuk';
      $authSwitchText.textContent = 'Belum punya akun?';
      $authSwitchBtn.textContent = 'Daftar di sini';
      $authForgot.style.display = '';
    } else {
      $authSubmit.textContent = 'Daftar';
      $authSwitchText.textContent = 'Sudah punya akun?';
      $authSwitchBtn.textContent = 'Masuk di sini';
      $authForgot.style.display = 'none';
    }
    setAuthError(null);
  }

  $authSwitchBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthModeUI();
  });

  $authForgot.addEventListener('click', () => {
    const email = $authEmail.value.trim();
    if (!email) {
      setAuthError('Isi email dulu, nanti link reset password dikirim ke situ.');
      return;
    }
    auth.sendPasswordResetEmail(email)
      .then(() => setAuthInfo('Link reset password sudah dikirim ke email kamu.'))
      .catch(err => setAuthError(translateAuthError(err)));
  });

  $authSubmit.addEventListener('click', () => {
    const email = $authEmail.value.trim();
    const password = $authPassword.value;
    if (!email || !password) {
      setAuthError('Isi email dan password dulu.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password minimal 6 karakter.');
      return;
    }
    setAuthError(null);
    $authSubmit.disabled = true;
    $authSubmit.textContent = 'Memproses...';

    const action = authMode === 'login'
      ? auth.signInWithEmailAndPassword(email, password)
      : auth.createUserWithEmailAndPassword(email, password);

    action
      .catch(err => setAuthError(translateAuthError(err)))
      .finally(() => {
        $authSubmit.disabled = false;
        updateAuthModeUI();
      });
  });

  [$authEmail, $authPassword].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') $authSubmit.click();
    });
  });

  $btnLogout.addEventListener('click', () => {
    showConfirm('Keluar', 'Yakin ingin keluar dari akun ini?', () => {
      if (itemsRef) itemsRef.off();
      auth.signOut();
    });
  });

  function initAuthListener() {
    if (!useFirebase || !auth) {
      // Firebase belum dikonfigurasi -> jalan mode lokal tanpa login
      $authOfflineNote.style.display = '';
      showApp();
      setSyncBadge('local');
      loadLocalData();
      render();
      return;
    }

    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        $userEmail.textContent = user.email || '';
        showApp();
        startDataSync();
      } else {
        currentUser = null;
        if (itemsRef) { itemsRef.off(); itemsRef = null; }
        $authEmail.value = '';
        $authPassword.value = '';
        setAuthError(null);
        showAuthScreen();
      }
    });
  }

  function setSyncBadge(state) {
    if (!$syncBadge) return;
    $syncBadge.classList.remove('sync-online', 'sync-local', 'sync-error');
    if (state === 'online') {
      $syncBadge.textContent = '☁️ Tersambung';
      $syncBadge.classList.add('sync-online');
      $syncBadge.title = 'Data tersinkron real-time, bisa diakses dari device manapun.';
    } else if (state === 'error') {
      $syncBadge.textContent = '⚠️ Gagal Sync';
      $syncBadge.classList.add('sync-error');
      $syncBadge.title = 'Gagal konek ke Firebase. Cek firebase-config.js dan koneksi internet.';
    } else {
      $syncBadge.textContent = '💾 Mode Lokal';
      $syncBadge.classList.add('sync-local');
      $syncBadge.title = 'Firebase belum dikonfigurasi. Data hanya tersimpan di browser ini (tidak sync antar device). Lihat firebase-config.js.';
    }
  }

  // ---- Data load/save ----
  function loadLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = JSON.parse(raw);
      } else {
        data = DEFAULT_DATA.map(d => ({
          id: makeId(),
          name: d.name,
          duration: d.duration,
          attendance: Array(d.duration).fill(false),
          note: '',
          startDate: todayStr(),
        }));
      }
      normalizeData();
    } catch {
      data = [];
    }
  }

  function saveData() {
    normalizeData();
    if (useFirebase && itemsRef) {
      const obj = {};
      data.forEach(item => { obj[item.id] = item; });
      itemsRef.set(obj).catch(err => {
        console.error('Gagal simpan ke Firebase:', err);
        setSyncBadge('error');
      });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  function startDataSync() {
    if (useFirebase && currentUser) {
      itemsRef = db.ref('absensimap_items/' + currentUser.uid);
      setSyncBadge('online');
      itemsRef.on('value', snapshot => {
        const val = snapshot.val();
        data = val ? Object.values(val) : [];
        normalizeData();
        // Kalau database masih kosong (project Firebase baru), isi dengan default sekali saja
        if (!val && !firstSyncDone) {
          data = DEFAULT_DATA.map(d => ({
            id: makeId(),
            name: d.name,
            duration: d.duration,
            attendance: Array(d.duration).fill(false),
            note: '',
            startDate: todayStr(),
          }));
          saveData();
        }
        firstSyncDone = true;
        render();
      }, err => {
        console.error('Firebase sync error:', err);
        setSyncBadge('error');
        // fallback supaya app tetap kepake
        useFirebase = false;
        loadLocalData();
        render();
      });
    } else {
      setSyncBadge('local');
      loadLocalData();
      render();
    }
  }

  // ---- Helpers ----
  function getChecked(item) {
    return item.attendance.filter(Boolean).length;
  }

  function getStatus(item) {
    const checked = getChecked(item);
    if (checked === 0) return 'idle';
    if (checked >= item.duration) return 'done';
    return 'running';
  }

  function getStatusLabel(status) {
    if (status === 'idle') return 'Belum Mulai';
    if (status === 'running') return 'Berjalan';
    return 'Selesai';
  }

  function pct(item) {
    return Math.round((getChecked(item) / item.duration) * 100);
  }

  // Index hari terakhir yang sudah dicentang (bukan berdasar tanggal kalender)
  function getLastCheckedIndex(item) {
    for (let i = item.attendance.length - 1; i >= 0; i--) {
      if (item.attendance[i]) return i;
    }
    return -1;
  }

  // ---- Filtering ----
  function filteredData() {
    let result = data;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q));
    }

    if (currentFilter === '7') result = result.filter(d => d.duration === 7);
    else if (currentFilter === '14') result = result.filter(d => d.duration === 14);
    else if (currentFilter === '30') result = result.filter(d => d.duration === 30);
    else if (currentFilter === 'running') result = result.filter(d => getStatus(d) === 'running');
    else if (currentFilter === 'done') result = result.filter(d => getStatus(d) === 'done');

    return result;
  }

  // ---- Render ----
  function renderStats() {
    const total = data.length;
    let running = 0, done = 0, totalAtt = 0;
    data.forEach(item => {
      const s = getStatus(item);
      if (s === 'running') running++;
      if (s === 'done') done++;
      totalAtt += getChecked(item);
    });
    $statTotal.textContent = total;
    $statRunning.textContent = running;
    $statDone.textContent = done;
    $statAttendance.textContent = totalAtt;
  }

  function renderCards() {
    const items = filteredData();

    if (!items.length) {
      $cardsGrid.style.display = 'none';
      $emptyState.style.display = '';
      return;
    }
    $cardsGrid.style.display = '';
    $emptyState.style.display = 'none';

    $cardsGrid.innerHTML = items.map((item, idx) => {
      const checked = getChecked(item);
      const status = getStatus(item);
      const statusLabel = getStatusLabel(status);
      const percent = pct(item);
      const claim = getClaimStatus(item);
      const lastIdx = getLastCheckedIndex(item);

      // Build mini day grid
      let daysCells = '';
      for (let i = 0; i < item.duration; i++) {
        const classes = ['day-cell'];
        if (item.attendance[i]) classes.push('checked');
        if (i === lastIdx) classes.push('last-checked');
        daysCells += `<div class="${classes.join(' ')}" data-item-id="${item.id}" data-day="${i}" title="Hari ${i + 1}">${i + 1}</div>`;
      }

      const noteHtml = item.note
        ? `<div class="card-note">📝 ${escHtml(item.note)}</div>`
        : '';

      return `
        <div class="card" style="animation-delay:${idx * 0.05}s" data-card-id="${item.id}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-name">${escHtml(item.name)}</span>
              <div class="card-meta">
                <span class="card-duration">${item.duration} Hari</span>
                <span class="card-status status-${status}">
                  <span class="status-dot"></span>
                  ${statusLabel}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <button class="btn-icon" onclick="AbsensiMap.editItem('${item.id}')" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon btn-icon-danger" onclick="AbsensiMap.deleteItem('${item.id}')" title="Hapus">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
          ${noteHtml}
          <div class="card-today-row">
            <span class="today-badge ${claim.state}">${claim.label}</span>
            ${claim.detail ? `<span class="claim-detail">${escHtml(claim.detail)}</span>` : ''}
          </div>
          ${claim.state === 'absent' || claim.state === 'present' ? `
          <div class="card-claim-row">
            <button class="btn-claim" data-item-id="${item.id}" ${claim.eligible ? '' : 'disabled'}>
              ${claim.eligible ? '✓ Absen Sekarang' : '🔒 Sudah Diklaim'}
            </button>
          </div>` : ''}
          <div class="card-progress">
            <div class="progress-info">
              <span class="progress-text">${checked} / ${item.duration} hari</span>
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
        </div>`;
    }).join('');
  }

  function render() {
    renderStats();
    renderCards();
    // Kalau modal detail lagi kebuka, refresh juga (buat nangkep pergantian tanggal)
    if (dayModalItemId !== null && $modalDays.classList.contains('active')) {
      const item = data.find(d => d.id === dayModalItemId);
      if (item) renderDaysModal(item);
    }
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Modal helpers ----
  function openModal(el) {
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeModal(el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  }

  function closeAllModals() {
    closeModal($modalForm);
    closeModal($modalConfirm);
    closeModal($modalDays);
  }

  // ---- Form modal ----
  function openFormModal(mode, item) {
    editingId = mode === 'edit' ? item.id : null;
    $modalFormTitle.textContent = mode === 'edit' ? 'Edit Item' : 'Tambah Item';
    $inputName.value = mode === 'edit' ? item.name : '';
    $inputNote.value = mode === 'edit' ? (item.note || '') : '';
    selectedDuration = mode === 'edit' ? item.duration : 30;
    selectedResetMode = mode === 'edit' ? (item.resetMode || 'fixed') : 'fixed';
    selectedResetHour = mode === 'edit' ? (item.resetHour || 0) : 0;
    updateDurationBtns();
    updateResetModeBtns();
    openModal($modalForm);
    setTimeout(() => $inputName.focus(), 100);
  }

  function updateResetModeBtns() {
    const uiKey = selectedResetMode === 'rolling' ? 'rolling' : (selectedResetHour === 0 ? 'fixed0' : 'fixedcustom');
    $resetModeOptions.querySelectorAll('.reset-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === uiKey);
    });
    $resetHourRow.style.display = uiKey === 'fixedcustom' ? '' : 'none';
    if (uiKey === 'fixedcustom') $inputResetHour.value = selectedResetHour;
  }

  $resetModeOptions.addEventListener('click', e => {
    const btn = e.target.closest('.reset-mode-btn');
    if (!btn) return;
    const key = btn.dataset.mode;
    if (key === 'fixed0') { selectedResetMode = 'fixed'; selectedResetHour = 0; }
    else if (key === 'fixedcustom') { selectedResetMode = 'fixed'; selectedResetHour = parseInt($inputResetHour.value) || 20; }
    else if (key === 'rolling') { selectedResetMode = 'rolling'; }
    updateResetModeBtns();
  });

  $inputResetHour.addEventListener('input', () => {
    let h = parseInt($inputResetHour.value);
    if (isNaN(h)) h = 0;
    h = Math.max(0, Math.min(23, h));
    selectedResetHour = h;
    selectedResetMode = 'fixed';
  });

  function updateDurationBtns() {
    $durationOptions.querySelectorAll('.duration-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.duration) === selectedDuration);
    });
  }

  // Duration buttons
  $durationOptions.addEventListener('click', e => {
    const btn = e.target.closest('.duration-btn');
    if (!btn) return;
    selectedDuration = parseInt(btn.dataset.duration);
    updateDurationBtns();
  });

  // Save form
  $modalFormSave.addEventListener('click', () => {
    const name = $inputName.value.trim();
    const note = $inputNote.value.trim();
    if (!name) {
      $inputName.focus();
      $inputName.style.borderColor = 'var(--danger)';
      setTimeout(() => { $inputName.style.borderColor = ''; }, 1500);
      return;
    }

    if (editingId !== null) {
      // Edit
      const item = data.find(d => d.id === editingId);
      if (item) {
        const oldDuration = item.duration;
        item.name = name;
        item.note = note;
        item.duration = selectedDuration;
        item.resetMode = selectedResetMode;
        item.resetHour = selectedResetHour;

        // Adjust attendance array
        if (selectedDuration > oldDuration) {
          while (item.attendance.length < selectedDuration) item.attendance.push(false);
        } else if (selectedDuration < oldDuration) {
          const lostChecks = item.attendance.slice(selectedDuration).filter(Boolean).length;
          if (lostChecks > 0) {
            closeModal($modalForm);
            showConfirm(
              'Konfirmasi Perubahan',
              `Durasi dikurangi dari ${oldDuration} ke ${selectedDuration} hari. ${lostChecks} data absensi di luar batas akan terhapus. Lanjutkan?`,
              () => {
                item.attendance = item.attendance.slice(0, selectedDuration);
                saveData();
                render();
              },
              () => {
                item.duration = oldDuration;
                item.name = name;
                item.note = note;
                saveData();
                render();
              }
            );
            return;
          }
          item.attendance = item.attendance.slice(0, selectedDuration);
        }
      }
    } else {
      // Add
      const att = Array(selectedDuration).fill(false);
      data.push({
        id: makeId(),
        name,
        note,
        duration: selectedDuration,
        attendance: att,
        resetMode: selectedResetMode,
        resetHour: selectedResetHour,
        lastClaimAt: null,
        startDate: logicalDateStr(selectedResetHour),
      });
    }

    saveData();
    closeModal($modalForm);
    render();
  });

  // Close form modal
  document.getElementById('modal-form-close').addEventListener('click', () => closeModal($modalForm));
  document.getElementById('modal-form-cancel').addEventListener('click', () => closeModal($modalForm));

  // ---- Confirm modal ----
  let confirmYesCb = null;
  let confirmNoCb = null;

  function showConfirm(title, msg, onYes, onNo) {
    $modalConfirmTitle.textContent = title;
    $modalConfirmMsg.textContent = msg;
    confirmYesCb = onYes || null;
    confirmNoCb = onNo || null;
    openModal($modalConfirm);
  }

  $modalConfirmOk.addEventListener('click', () => {
    closeModal($modalConfirm);
    if (confirmYesCb) confirmYesCb();
    confirmYesCb = null;
    confirmNoCb = null;
  });

  document.getElementById('modal-confirm-close').addEventListener('click', () => {
    closeModal($modalConfirm);
    if (confirmNoCb) confirmNoCb();
    confirmYesCb = null;
    confirmNoCb = null;
  });

  document.getElementById('modal-confirm-cancel').addEventListener('click', () => {
    closeModal($modalConfirm);
    if (confirmNoCb) confirmNoCb();
    confirmYesCb = null;
    confirmNoCb = null;
  });

  // ---- Days modal ----
  function openDaysModal(itemId) {
    dayModalItemId = itemId;
    const item = data.find(d => d.id === itemId);
    if (!item) return;

    $modalDaysTitle.textContent = `Absensi — ${item.name}`;
    if (item.note) {
      $modalDaysNote.textContent = `📝 ${item.note}`;
      $modalDaysNote.style.display = '';
    } else {
      $modalDaysNote.style.display = 'none';
    }
    $modalDaysResetMode.textContent = `⏱️ Reset: ${resetModeLabel(item)}`;
    renderDaysModal(item);
    openModal($modalDays);
  }

  function renderDaysModal(item) {
    const checked = getChecked(item);
    const percent = pct(item);
    const claim = getClaimStatus(item);

    $daysProgressText.textContent = `${checked} / ${item.duration} hari`;
    $daysProgressPct.textContent = `${percent}%`;
    $daysProgressFill.style.width = `${percent}%`;

    $modalDaysTodayBadge.textContent = claim.label;
    $modalDaysTodayBadge.className = `today-badge ${claim.state}`;
    $modalDaysClaimDetail.textContent = claim.detail || '';
    $modalDaysClaimDetail.style.display = claim.detail ? '' : 'none';

    if (claim.state === 'absent' || claim.state === 'present') {
      $modalDaysClaimBtn.style.display = '';
      $modalDaysClaimBtn.disabled = !claim.eligible;
      $modalDaysClaimBtn.textContent = claim.eligible ? '✓ Absen Sekarang' : '🔒 Sudah Diklaim';
    } else {
      $modalDaysClaimBtn.style.display = 'none';
    }

    const lastIdx = getLastCheckedIndex(item);
    let cells = '';
    for (let i = 0; i < item.duration; i++) {
      const classes = ['day-cell'];
      if (item.attendance[i]) classes.push('checked');
      if (i === lastIdx) classes.push('last-checked');
      cells += `<div class="${classes.join(' ')}" data-day="${i}">${i + 1}</div>`;
    }
    $daysGrid.innerHTML = cells;
  }

  $modalDaysClaimBtn.addEventListener('click', () => {
    if (dayModalItemId !== null) claimAttendance(dayModalItemId);
  });

  // Toggle day in modal
  $daysGrid.addEventListener('click', e => {
    const cell = e.target.closest('.day-cell');
    if (!cell || dayModalItemId === null) return;
    const item = data.find(d => d.id === dayModalItemId);
    if (!item) return;
    const dayIdx = parseInt(cell.dataset.day);
    item.attendance[dayIdx] = !item.attendance[dayIdx];
    saveData();
    renderDaysModal(item);
    renderStats();
    renderCards();
  });

  // Reset in days modal
  document.getElementById('modal-days-reset').addEventListener('click', () => {
    if (dayModalItemId === null) return;
    const item = data.find(d => d.id === dayModalItemId);
    if (!item) return;
    showConfirm(
      'Reset Absensi',
      `Reset semua absensi untuk "${item.name}"? Centang hari akan dihapus dan hitungan mulai dari hari ini lagi.`,
      () => {
        item.attendance = item.attendance.map(() => false);
        item.startDate = logicalDateStr(item.resetHour || 0);
        item.lastClaimAt = null;
        saveData();
        renderDaysModal(item);
        render();
      }
    );
  });

  // Close days modal
  document.getElementById('modal-days-close').addEventListener('click', () => closeModal($modalDays));
  document.getElementById('modal-days-done').addEventListener('click', () => closeModal($modalDays));

  // ---- Klik tombol "Absen Sekarang" atau kotak hari di kartu ----
  $cardsGrid.addEventListener('click', e => {
    const claimBtn = e.target.closest('.btn-claim');
    if (claimBtn) {
      claimAttendance(claimBtn.dataset.itemId);
      return;
    }
    const cell = e.target.closest('.day-cell');
    if (!cell) return;
    const itemId = cell.dataset.itemId;
    const dayIdx = parseInt(cell.dataset.day);
    const item = data.find(d => d.id === itemId);
    if (!item) return;
    item.attendance[dayIdx] = !item.attendance[dayIdx];
    saveData();
    render();
  });

  // ---- Public API for inline handlers ----
  window.AbsensiMap = {
    editItem(id) {
      const item = data.find(d => d.id === id);
      if (item) openFormModal('edit', item);
    },
    deleteItem(id) {
      const item = data.find(d => d.id === id);
      if (!item) return;
      showConfirm(
        'Hapus Item',
        `Yakin ingin menghapus "${item.name}"? Semua data absensinya akan ikut dihapus.`,
        () => {
          data = data.filter(d => d.id !== id);
          saveData();
          render();
        }
      );
    },
    openDays(id) {
      openDaysModal(id);
    }
  };

  // ---- Add button ----
  document.getElementById('btn-add').addEventListener('click', () => {
    openFormModal('add');
  });

  // ---- Reset all ----
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (!data.length) return;
    showConfirm(
      'Reset Semua Absensi',
      'Yakin ingin mereset semua absensi? Semua centang hari akan dihapus dan hitungan mulai dari hari ini lagi, tetapi item tetap ada.',
      () => {
        data.forEach(item => {
          item.attendance = item.attendance.map(() => false);
          item.startDate = logicalDateStr(item.resetHour || 0);
          item.lastClaimAt = null;
        });
        saveData();
        render();
      }
    );
  });

  // ---- Search ----
  $searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCards();
  });

  // ---- Filters ----
  $filterChips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    $filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderCards();
  });

  // ---- Close modals on overlay click ----
  [$modalForm, $modalConfirm, $modalDays].forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // ---- Close modals on Escape ----
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  // ---- Auto-refresh badge/countdown (jam custom, rolling 24 jam, ganti tanggal) ----
  setInterval(() => render(), 30 * 1000); // cek tiap 30 detik, ringan dan cukup responsif

  // Refresh juga saat tab kembali aktif (misal HP dikunci lalu dibuka lagi)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  // ---- Init ----
  initFirebase();
  initAuthListener();
})();
