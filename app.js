// ============================================================
// AbsensiMap — app.js
// Versi Manual — TANPA TIMER
// ============================================================

(async function () {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================

  let user = null;
  let items = [];
  let progress = {};
  let progressDates = {};

  let currentFilter = 'all';
  let searchQuery = '';

  // Mencegah klik berkali-kali saat proses penyimpanan
  const savingProgress = new Set();

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    try {
      // auth.js menggunakan getUser(), BUKAN getCurrentUser()
      user = await Auth.getUser();

      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      setupUserInfo();
      setupEventListeners();

      await loadData();

      renderAll();

      showApp(true);

    } catch (error) {
      console.error('Init error:', error);

      showApp(true);

      showToast(
        error.message || 'Gagal memuat aplikasi.',
        'error'
      );
    }
  }

  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadData() {
    try {
      // --------------------------------------------------------
      // Ambil daftar item
      // --------------------------------------------------------

      const itemResult = await Auth.apiFetch('getItems');

      if (itemResult && itemResult.success) {
        items = Array.isArray(itemResult.items)
          ? itemResult.items
          : [];
      } else {
        items = [];
      }

      // --------------------------------------------------------
      // Ambil progress user
      // --------------------------------------------------------

      const progressResult = await Auth.apiFetch('getProgress');

      if (progressResult && progressResult.success) {

        progress = progressResult.progress || {};

        progressDates =
          progressResult.progressDates || {};

      } else {
        progress = {};
        progressDates = {};
      }

      console.log('Items:', items);
      console.log('Progress:', progress);
      console.log('Progress Dates:', progressDates);

    } catch (error) {
      console.error('Load data error:', error);

      throw new Error(
        error.message || 'Gagal mengambil data dari server.'
      );
    }
  }

  // ============================================================
  // NORMALIZE
  // ============================================================

  function normalizeItem(item) {
    if (!item) return null;

    const normalized = { ...item };

    normalized.id = String(
      item.id ??
      item.item_id ??
      item.itemId ??
      ''
    ).trim();

    normalized.name = String(
      item.name ??
      item.nama ??
      item.title ??
      item.item_name ??
      'Tanpa Nama'
    ).trim();

    normalized.description = String(
      item.description ??
      item.deskripsi ??
      ''
    ).trim();

    normalized.duration =
      Number(
        item.duration_days ??
        item.duration ??
        item.days ??
        14
      ) || 14;

    return normalized;
  }

  function normalizeItems() {
    items = items
      .map(normalizeItem)
      .filter(item => item && item.id);
  }

  // ============================================================
  // USER INFO
  // ============================================================

  function setupUserInfo() {

    const name =
      user?.username ||
      user?.name ||
      user?.nama ||
      'User';

    const role =
      user?.role ||
      'user';

    // Nama
    const nameDisplay =
      document.getElementById('user-name-display');

    if (nameDisplay) {
      nameDisplay.textContent = name;
    }

    // Greeting
    const greeting =
      document.getElementById('greeting-title');

    if (greeting) {
      greeting.textContent =
        `Halo, ${name}!`;
    }

    // Avatar
    const avatar =
      document.getElementById('user-avatar-initial');

    if (avatar) {
      avatar.textContent =
        name.charAt(0).toUpperCase();
    }

    // ----------------------------------------------------------
    // Admin link
    // ----------------------------------------------------------

    const adminLinks =
      document.querySelectorAll(
        '[data-admin-only], .admin-only, #admin-link'
      );

    adminLinks.forEach(el => {
      if (role === 'admin') {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function setupEventListeners() {

    // ----------------------------------------------------------
    // LOGOUT
    // ----------------------------------------------------------

    const logoutButtons =
      document.querySelectorAll(
        '#logout-btn, [data-action="logout"], .logout-btn'
      );

    logoutButtons.forEach(button => {

      button.addEventListener('click', async function (event) {

        event.preventDefault();

        if (button.dataset.loading === 'true') {
          return;
        }

        button.dataset.loading = 'true';

        try {
          await Auth.logout();
        } catch (error) {
          console.error('Logout error:', error);

          localStorage.removeItem('absensi_token');

          window.location.href = 'login.html';
        }
      });

    });

    // ----------------------------------------------------------
    // SEARCH
    // ----------------------------------------------------------

    const searchInput =
      document.getElementById('search-input');

    if (searchInput) {

      searchInput.addEventListener(
        'input',
        function () {

          searchQuery =
            searchInput.value
              .trim()
              .toLowerCase();

          renderCards();
        }
      );
    }

    // ----------------------------------------------------------
    // FILTER
    // ----------------------------------------------------------

    const filterChips =
      document.getElementById('filter-chips');

    if (filterChips) {

      filterChips.addEventListener(
        'click',
        function (event) {

          const chip =
            event.target.closest('.chip');

          if (!chip) return;

          currentFilter =
            chip.dataset.filter || 'all';

          filterChips
            .querySelectorAll('.chip')
            .forEach(item => {
              item.classList.remove('active');
            });

          chip.classList.add('active');

          renderCards();
        }
      );
    }

    // ----------------------------------------------------------
    // CARD / DAY CLICK
    // ----------------------------------------------------------

    const cardsGrid =
      document.getElementById('cards-grid');

    if (cardsGrid) {

      cardsGrid.addEventListener(
        'click',
        function (event) {

          // Tombol buka detail/card
          const card =
            event.target.closest('[data-item-id]');

          if (!card) return;

          const itemId =
            card.dataset.itemId;

          // Jika yang diklik adalah tombol Day
          const dayButton =
            event.target.closest('[data-day]');

          if (dayButton) {

            event.preventDefault();
            event.stopPropagation();

            const dayNumber =
              Number(dayButton.dataset.day);

            if (!dayNumber) return;

            toggleDayCompletion(
              itemId,
              dayNumber,
              dayButton
            );

            return;
          }

          // Tombol detail
          const detailButton =
            event.target.closest(
              '[data-action="open-detail"]'
            );

          if (detailButton) {

            event.preventDefault();

            openDayModal(itemId);

            return;
          }

          // Jika klik bagian card lain,
          // buka modal detail
          openDayModal(itemId);
        }
      );
    }

    // ----------------------------------------------------------
    // MODAL CLOSE
    // ----------------------------------------------------------

    document.addEventListener(
      'click',
      function (event) {

        const close =
          event.target.closest(
            '[data-action="close-modal"]'
          );

        if (close) {
          closeDayModal();
        }

        // klik background modal
        if (
          event.target.classList.contains(
            'modal-overlay'
          )
        ) {
          closeDayModal();
        }
      }
    );

    document.addEventListener(
      'keydown',
      function (event) {

        if (event.key === 'Escape') {
          closeDayModal();
        }

      }
    );
  }

  // ============================================================
  // RENDER ALL
  // ============================================================

  function renderAll() {

    normalizeItems();

    renderStats();
    renderToday();
    renderCards();
  }

  // ============================================================
  // GET PROGRESS ITEM
  // ============================================================

  function getProgressForItem(itemId) {

    const key = String(itemId).trim();

    let result =
      progress[key];

    // ----------------------------------------------------------
    // Coba cari jika ID berbeda tipe
    // ----------------------------------------------------------

    if (!result) {

      const foundKey =
        Object.keys(progress).find(
          keyItem =>
            String(keyItem).trim() === key
        );

      if (foundKey) {
        result = progress[foundKey];
      }
    }

    if (!Array.isArray(result)) {
      return [];
    }

    return result
      .map(Number)
      .filter(
        number =>
          Number.isFinite(number) &&
          number > 0
      )
      .sort((a, b) => a - b);
  }

  // ============================================================
  // TOTAL DAY YANG SUDAH SELESAI
  // ============================================================

  function getCompletedCount(itemId) {

    return getProgressForItem(itemId).length;
  }

  // ============================================================
  // DAY TERAKHIR
  // ============================================================

  function getLastDay(itemId) {

    const itemProgress =
      getProgressForItem(itemId);

    if (!itemProgress.length) {
      return 0;
    }

    return Math.max.apply(
      null,
      itemProgress
    );
  }

  // ============================================================
  // GET DURATION
  // ============================================================

  function getDuration(item) {

    const duration =
      Number(
        item.duration_days ??
        item.duration ??
        item.days
      );

    return (
      Number.isFinite(duration) &&
      duration > 0
    )
      ? duration
      : 14;
  }

  // ============================================================
  // IS ITEM DONE
  // ============================================================

  function isItemDone(item) {

    const duration =
      getDuration(item);

    const completedCount =
      getCompletedCount(item.id);

    return completedCount >= duration;
  }

  // ============================================================
  // RENDER STATS
  // ============================================================

  function renderStats() {

    const total =
      items.length;

    const done =
      items.filter(isItemDone).length;

    const running =
      items.filter(item =>
        !isItemDone(item) &&
        getCompletedCount(item.id) > 0
      ).length;

    // Hari ini
    const todayCount =
      getTodayCompletedCount();

    // ----------------------------------------------------------
    // Total
    // ----------------------------------------------------------

    setText(
      'stat-total',
      total
    );

    // ----------------------------------------------------------
    // Running
    // ----------------------------------------------------------

    setText(
      'stat-running',
      running
    );

    // ----------------------------------------------------------
    // Done
    // ----------------------------------------------------------

    setText(
      'stat-done',
      done
    );

    // ----------------------------------------------------------
    // Today
    // ----------------------------------------------------------

    setText(
      'stat-today',
      `${todayCount}/${total}`
    );
  }

  // ============================================================
  // GET TODAY COMPLETED COUNT
  // ============================================================

  function getTodayCompletedCount() {

    let count = 0;

    items.forEach(item => {

      const dates =
        progressDates[item.id];

      if (!dates) return;

      const progressItem =
        getProgressForItem(item.id);

      progressItem.forEach(day => {

        const date =
          dates[day];

        if (isToday(date)) {
          count++;
        }

      });

    });

    return count;
  }

  // ============================================================
  // TODAY CHECK
  // ============================================================

  function isToday(value) {

    if (!value) return false;

    const date =
      new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const now =
      new Date();

    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate()
    );
  }

  // ============================================================
  // RENDER TODAY
  // ============================================================

  function renderToday() {

    const pendingList =
      document.getElementById(
        'today-pending-list'
      );

    const completedList =
      document.getElementById(
        'today-completed-list'
      );

    if (!pendingList && !completedList) {
      return;
    }

    const pending = [];
    const completed = [];

    items.forEach(item => {

      const days =
        getProgressForItem(item.id);

      const duration =
        getDuration(item);

      let completedToday = false;

      days.forEach(day => {

        const date =
          getProgressDate(
            item.id,
            day
          );

        if (isToday(date)) {
          completedToday = true;
        }
      });

      if (completedToday) {
        completed.push(item);
      } else if (
        days.length < duration
      ) {
        pending.push(item);
      }

    });

    if (pendingList) {

      if (!pending.length) {

        pendingList.innerHTML =
          `<div class="today-empty">
             Semua aktivitas hari ini sudah selesai.
           </div>`;

      } else {

        pendingList.innerHTML =
          pending
            .map(renderTodayItem)
            .join('');
      }
    }

    if (completedList) {

      if (!completed.length) {

        completedList.innerHTML =
          `<div class="today-empty">
             Belum ada aktivitas yang diselesaikan hari ini.
           </div>`;

      } else {

        completedList.innerHTML =
          completed
            .map(renderTodayItem)
            .join('');
      }
    }
  }

  // ============================================================
  // TODAY ITEM
  // ============================================================

  function renderTodayItem(item) {

    const itemId =
      escapeHtml(item.id);

    const name =
      escapeHtml(item.name);

    const lastDay =
      getLastDay(item.id);

    const duration =
      getDuration(item);

    return `
      <div
        class="today-item"
        data-item-id="${itemId}"
      >

        <div class="today-item-info">

          <div class="today-item-name">
            ${name}
          </div>

          <div class="today-item-progress">
            Day ${lastDay}/${duration}
          </div>

        </div>

        <button
          type="button"
          class="today-item-button"
          data-action="open-detail"
          data-item-id="${itemId}"
        >
          Lihat
        </button>

      </div>
    `;
  }

  // ============================================================
  // RENDER CARDS
  // ============================================================

  function renderCards() {

    const grid =
      document.getElementById(
        'cards-grid'
      );

    const empty =
      document.getElementById(
        'empty-state'
      );

    if (!grid) {
      console.error(
        'Element #cards-grid tidak ditemukan.'
      );
      return;
    }

    let filtered =
      items.filter(item =>
        matchesSearch(item) &&
        matchesFilter(item)
      );

    if (!filtered.length) {

      grid.innerHTML = '';

      if (empty) {
        empty.style.display = '';
      }

      return;
    }

    if (empty) {
      empty.style.display = 'none';
    }

    grid.innerHTML =
      filtered
        .map(renderCard)
        .join('');
  }

  // ============================================================
  // SEARCH MATCH
  // ============================================================

  function matchesSearch(item) {

    if (!searchQuery) {
      return true;
    }

    const text =
      [
        item.name,
        item.description,
        item.id
      ]
        .join(' ')
        .toLowerCase();

    return text.includes(
      searchQuery
    );
  }

  // ============================================================
  // FILTER MATCH
  // ============================================================

  function matchesFilter(item) {

    const filter =
      String(currentFilter);

    const duration =
      getDuration(item);

    const count =
      getCompletedCount(item);

    if (filter === 'all') {
      return true;
    }

    if (filter === 'running') {
      return (
        count > 0 &&
        count < duration
      );
    }

    if (filter === 'done') {
      return count >= duration;
    }

    if (
      filter === '7' ||
      filter === '14' ||
      filter === '30'
    ) {
      return duration === Number(filter);
    }

    return true;
  }

  // ============================================================
  // RENDER CARD
  // ============================================================

  function renderCard(item) {

    const itemId =
      escapeHtml(item.id);

    const name =
      escapeHtml(item.name);

    const description =
      escapeHtml(item.description);

    const duration =
      getDuration(item);

    const itemProgress =
      getProgressForItem(item.id);

    const completedCount =
      itemProgress.length;

    // ----------------------------------------------------------
    // DAY TERAKHIR
    // ----------------------------------------------------------

    const lastDay =
      itemProgress.length
        ? Math.max.apply(
            null,
            itemProgress
          )
        : 0;

    // ----------------------------------------------------------
    // PROGRESS %
    // ----------------------------------------------------------

    const percent =
      duration > 0
        ? Math.min(
            100,
            Math.round(
              (completedCount / duration) * 100
            )
          )
        : 0;

    const done =
      completedCount >= duration;

    // ----------------------------------------------------------
    // STATUS
    // ----------------------------------------------------------

    let statusText =
      'Belum mulai';

    if (done) {
      statusText = 'Selesai';
    } else if (completedCount > 0) {
      statusText = 'Berjalan';
    }

    // ----------------------------------------------------------
    // DAY BUTTONS
    // ----------------------------------------------------------

    let daysHtml = '';

    for (
      let day = 1;
      day <= duration;
      day++
    ) {

      const checked =
        itemProgress.includes(day);

      daysHtml += `
        <button
          type="button"
          class="day-button ${checked ? 'completed' : ''}"
          data-day="${day}"
          data-item-id="${itemId}"
          aria-label="Day ${day}"
          title="Day ${day}${checked ? ' — selesai' : ''}"
        >
          ${day}
        </button>
      `;
    }

    // ----------------------------------------------------------
    // CARD
    // ----------------------------------------------------------

    return `
      <article
        class="item-card ${done ? 'is-done' : ''}"
        data-item-id="${itemId}"
      >

        <div class="item-card-header">

          <div class="item-card-title-wrap">

            <h3 class="item-card-title">
              ${name}
            </h3>

            ${
              description
                ? `
                  <p class="item-card-description">
                    ${description}
                  </p>
                `
                : ''
            }

          </div>

          <span
            class="item-card-status ${done ? 'done' : completedCount > 0 ? 'running' : 'pending'}"
          >
            ${statusText}
          </span>

        </div>


        <div class="item-card-progress">

          <div class="progress-info">

            <span>
              Day ${lastDay}/${duration}
            </span>

            <span>
              ${completedCount}/${duration}
            </span>

          </div>

          <div class="progress-bar">

            <div
              class="progress-bar-fill"
              style="width: ${percent}%"
            ></div>

          </div>

        </div>


        <div class="days-header">

          <span>
            Pilih Day
          </span>

          <button
            type="button"
            class="detail-button"
            data-action="open-detail"
            data-item-id="${itemId}"
          >
            Detail
          </button>

        </div>


        <div class="days-grid">

          ${daysHtml}

        </div>


        <div class="item-card-footer">

          <span>
            Klik Day untuk mencatat kehadiran.
          </span>

        </div>

      </article>
    `;
  }

  // ============================================================
  // TOGGLE DAY
  // ============================================================

  async function toggleDayCompletion(
    itemId,
    dayNumber,
    button
  ) {

    const key =
      `${String(itemId)}-${dayNumber}`;

    if (savingProgress.has(key)) {
      return;
    }

    const item =
      items.find(
        item =>
          String(item.id) ===
          String(itemId)
      );

    if (!item) {
      showToast(
        'Item tidak ditemukan.',
        'error'
      );
      return;
    }

    const duration =
      getDuration(item);

    if (
      dayNumber < 1 ||
      dayNumber > duration
    ) {
      return;
    }

    const current =
      getProgressForItem(itemId);

    const alreadyCompleted =
      current.includes(dayNumber);

    const newCompleted =
      !alreadyCompleted;

    // ----------------------------------------------------------
    // Lock
    // ----------------------------------------------------------

    savingProgress.add(key);

    if (button) {
      button.disabled = true;
      button.classList.add('saving');
    }

    // ----------------------------------------------------------
    // Optimistic update
    // ----------------------------------------------------------

    if (newCompleted) {

      if (!progress[itemId]) {
        progress[itemId] = [];
      }

      if (
        !progress[itemId].includes(
          dayNumber
        )
      ) {
        progress[itemId].push(
          dayNumber
        );
      }

      progress[itemId] =
        progress[itemId]
          .map(Number)
          .sort((a, b) => a - b);

    } else {

      progress[itemId] =
        getProgressForItem(itemId)
          .filter(
            day => day !== dayNumber
          );
    }

    renderAll();

    // ----------------------------------------------------------
    // Simpan ke server
    // ----------------------------------------------------------

    try {

      const result =
        await Auth.apiFetch(
          'updateProgress',
          {
            itemId: itemId,
            dayNumber: dayNumber,
            completed: newCompleted
          }
        );

      if (
        !result ||
        result.success === false
      ) {
        throw new Error(
          result?.error ||
          'Gagal menyimpan progres.'
        );
      }

      // --------------------------------------------------------
      // Simpan tanggal jika server memberikan tanggal
      // --------------------------------------------------------

      if (newCompleted && result.date) {

        if (!progressDates[itemId]) {
          progressDates[itemId] = {};
        }

        progressDates[itemId][dayNumber] =
          result.date;
      }

      // --------------------------------------------------------
      // Refresh dari server
      // supaya data frontend benar-benar sinkron
      // --------------------------------------------------------

      await refreshProgress();

      renderAll();

      showToast(
        newCompleted
          ? `Day ${dayNumber} berhasil dicatat.`
          : `Day ${dayNumber} dibatalkan.`,
        'success'
      );

    } catch (error) {

      console.error(
        'Update progress error:',
        error
      );

      // --------------------------------------------------------
      // Rollback
      // --------------------------------------------------------

      if (newCompleted) {

        progress[itemId] =
          getProgressForItem(itemId)
            .filter(
              day => day !== dayNumber
            );

      } else {

        if (!progress[itemId]) {
          progress[itemId] = [];
        }

        if (
          !progress[itemId].includes(
            dayNumber
          )
        ) {
          progress[itemId].push(
            dayNumber
          );
        }

        progress[itemId] =
          progress[itemId]
            .map(Number)
            .sort((a, b) => a - b);
      }

      renderAll();

      showToast(
        error.message ||
        'Gagal menyimpan progres.',
        'error'
      );

    } finally {

      savingProgress.delete(key);

      if (button) {
        button.disabled = false;
        button.classList.remove(
          'saving'
        );
      }
    }
  }

  // ============================================================
  // REFRESH PROGRESS
  // ============================================================

  async function refreshProgress() {

    const result =
      await Auth.apiFetch(
        'getProgress'
      );

    if (
      result &&
      result.success
    ) {

      progress =
        result.progress || {};

      progressDates =
        result.progressDates || {};

    }
  }

  // ============================================================
  // GET PROGRESS DATE
  // ============================================================

  function getProgressDate(
    itemId,
    dayNumber
  ) {

    let dates =
      progressDates[itemId];

    if (!dates) {

      const foundKey =
        Object.keys(
          progressDates
        ).find(
          key =>
            String(key).trim() ===
            String(itemId).trim()
        );

      if (foundKey) {
        dates =
          progressDates[foundKey];
      }
    }

    if (!dates) {
      return null;
    }

    return (
      dates[dayNumber] ??
      dates[String(dayNumber)] ??
      null
    );
  }

  // ============================================================
  // MODAL
  // ============================================================

  function openDayModal(itemId) {

    const item =
      items.find(
        item =>
          String(item.id) ===
          String(itemId)
      );

    if (!item) return;

    const duration =
      getDuration(item);

    const completed =
      getProgressForItem(item.id);

    const overlay =
      document.createElement('div');

    overlay.className =
      'modal-overlay';

    overlay.id =
      'day-modal';

    let daysHtml = '';

    for (
      let day = 1;
      day <= duration;
      day++
    ) {

      const isCompleted =
        completed.includes(day);

      const date =
        getProgressDate(
          item.id,
          day
        );

      daysHtml += `
        <button
          type="button"
          class="modal-day ${isCompleted ? 'completed' : ''}"
          data-modal-item="${escapeHtml(item.id)}"
          data-day="${day}"
        >

          <span class="modal-day-number">
            Day ${day}
          </span>

          <span class="modal-day-status">
            ${
              isCompleted
                ? (
                    date
                      ? escapeHtml(
                          formatDate(date)
                        )
                      : 'Selesai'
                  )
                : 'Belum'
            }
          </span>

        </button>
      `;
    }

    overlay.innerHTML = `
      <div class="modal-box">

        <div class="modal-header">

          <div>
            <h3>
              ${escapeHtml(item.name)}
            </h3>

            <p>
              Progress:
              ${completed.length}/${duration}
            </p>
          </div>

          <button
            type="button"
            class="modal-close"
            data-action="close-modal"
            aria-label="Tutup"
          >
            ×
          </button>

        </div>

        <div class="modal-days">
          ${daysHtml}
        </div>

        <div class="modal-footer">
          Klik Day untuk mencatat atau membatalkan kehadiran.
        </div>

      </div>
    `;

    document.body.appendChild(
      overlay
    );

    // ----------------------------------------------------------
    // Modal Day click
    // ----------------------------------------------------------

    overlay.addEventListener(
      'click',
      function (event) {

        const dayButton =
          event.target.closest(
            '.modal-day'
          );

        if (!dayButton) {
          return;
        }

        const day =
          Number(
            dayButton.dataset.day
          );

        toggleDayCompletion(
          item.id,
          day,
          dayButton
        );
      }
    );
  }

  // ============================================================
  // CLOSE MODAL
  // ============================================================

  function closeDayModal() {

    const modal =
      document.getElementById(
        'day-modal'
      );

    if (modal) {
      modal.remove();
    }
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(value) {

    if (!value) {
      return '';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );
  }

  // ============================================================
  // SHOW APP
  // ============================================================

  function showApp(show) {

    const app =
      document.getElementById(
        'app-container'
      );

    if (!app) {
      return;
    }

    app.style.display =
      show ? '' : 'none';
  }

  // ============================================================
  // SET TEXT
  // ============================================================

  function setText(
    id,
    value
  ) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value;
    }
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(
    message,
    type = 'success'
  ) {

    const container =
      document.getElementById(
        'toast-container'
      );

    if (!container) {
      console.log(message);
      return;
    }

    const toast =
      document.createElement('div');

    toast.className =
      `toast toast-${type}`;

    toast.textContent =
      message;

    container.appendChild(
      toast
    );

    setTimeout(
      function () {

        toast.classList.add(
          'hide'
        );

        setTimeout(
          function () {
            toast.remove();
          },
          300
        );

      },
      3000
    );
  }

  // ============================================================
  // ESCAPE HTML
  // ============================================================

  function escapeHtml(value) {

    return String(
      value ?? ''
    )
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  }

  // ============================================================
  // START
  // ============================================================

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

})();
