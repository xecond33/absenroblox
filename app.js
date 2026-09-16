// ============================================================
// AbsensiMap — app.js
// Versi Manual — TANPA TIMER
// ============================================================

(async function () {
  'use strict';

  // ==========================================================
  // STATE
  // ==========================================================

  let user = null;
  let items = [];
  let progress = {};
  let progressDates = {};

  let currentFilter = 'all';
  let searchQuery = '';

  // Mencegah klik berkali-kali pada proses penyimpanan
  const savingProgress = new Set();

  // ==========================================================
  // INIT
  // ==========================================================

  async function init() {
    try {
      showLoader(true);

      if (typeof Auth === 'undefined') {
        throw new Error('auth.js tidak ditemukan.');
      }

      user = Auth.getCurrentUser();

      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      setupUserInfo();
      setupEventListeners();

      await loadData();

      renderAll();

      showApp(true);

    } catch (error) {
      console.error('Init error:', error);

      showToast(
        error.message || 'Gagal memuat aplikasi.',
        'error'
      );

    } finally {
      showLoader(false);
    }
  }

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadData() {
    // --------------------------------------------------------
    // LOAD ITEMS
    // --------------------------------------------------------

    const itemResponse = await Auth.apiFetch('getItems');

    if (!itemResponse || !itemResponse.success) {
      throw new Error(
        itemResponse?.message || 'Gagal mengambil data item.'
      );
    }

    items = Array.isArray(itemResponse.items)
      ? itemResponse.items
      : [];

    // --------------------------------------------------------
    // LOAD PROGRESS
    // --------------------------------------------------------

    const progressResponse = await Auth.apiFetch('getProgress');

    if (!progressResponse || !progressResponse.success) {
      throw new Error(
        progressResponse?.message || 'Gagal mengambil data progress.'
      );
    }

    progress = normalizeProgress(progressResponse.progress || {});
    progressDates = normalizeProgressDates(
      progressResponse.progressDates || {}
    );
  }

  // ==========================================================
  // NORMALIZE PROGRESS
  // ==========================================================

  function normalizeProgress(data) {
    const result = {};

    Object.keys(data || {}).forEach(function (key) {
      const cleanKey = String(key).trim();

      let values = data[key];

      if (!Array.isArray(values)) {
        values = [values];
      }

      result[cleanKey] = values
        .map(function (value) {
          return Number(value);
        })
        .filter(function (value) {
          return Number.isFinite(value) && value > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
    });

    return result;
  }

  // ==========================================================
  // NORMALIZE PROGRESS DATES
  // ==========================================================

  function normalizeProgressDates(data) {
    const result = {};

    Object.keys(data || {}).forEach(function (itemId) {
      const cleanItemId = String(itemId).trim();

      result[cleanItemId] = {};

      const itemDates = data[itemId] || {};

      Object.keys(itemDates).forEach(function (day) {
        const dayNumber = Number(day);

        if (Number.isFinite(dayNumber)) {
          result[cleanItemId][dayNumber] = itemDates[day];
        }
      });
    });

    return result;
  }

  // ==========================================================
  // USER INFO
  // ==========================================================

  function setupUserInfo() {
    const name =
      user.name ||
      user.nama ||
      user.username ||
      'User';

    const initial = name
      .trim()
      .charAt(0)
      .toUpperCase();

    const nameDisplay =
      document.getElementById('user-name-display');

    const avatar =
      document.getElementById('user-avatar-initial');

    const greeting =
      document.getElementById('greeting-title');

    if (nameDisplay) {
      nameDisplay.textContent = name;
    }

    if (avatar) {
      avatar.textContent = initial || 'U';
    }

    if (greeting) {
      greeting.textContent = `Halo, ${name}!`;
    }

    // --------------------------------------------------------
    // ADMIN LINK
    // --------------------------------------------------------

    const adminLink =
      document.getElementById('btn-admin-link');

    const role = String(
      user.role ||
      user.user_role ||
      ''
    ).toLowerCase();

    if (
      adminLink &&
      (
        role === 'admin' ||
        role === 'administrator'
      )
    ) {
      adminLink.style.display = 'inline-flex';
    }
  }

  // ==========================================================
  // EVENT LISTENERS
  // ==========================================================

  function setupEventListeners() {

    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    const logoutButton =
      document.getElementById('btn-logout');

    if (logoutButton) {
      logoutButton.addEventListener('click', async function () {
        try {
          logoutButton.disabled = true;

          await Auth.logout();

          window.location.href = 'login.html';

        } catch (error) {
          console.error('Logout error:', error);

          logoutButton.disabled = false;

          showToast(
            'Gagal keluar dari aplikasi.',
            'error'
          );
        }
      });
    }

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    const searchInput =
      document.getElementById('search-input');

    if (searchInput) {
      searchInput.addEventListener(
        'input',
        function (event) {
          searchQuery =
            String(event.target.value || '')
              .trim()
              .toLowerCase();

          renderCards();
        }
      );
    }

    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

    const filterChips =
      document.getElementById('filter-chips');

    if (filterChips) {
      filterChips.addEventListener(
        'click',
        function (event) {

          const button =
            event.target.closest('.chip');

          if (!button) return;

          currentFilter =
            button.dataset.filter || 'all';

          filterChips
            .querySelectorAll('.chip')
            .forEach(function (chip) {
              chip.classList.remove('active');
            });

          button.classList.add('active');

          renderCards();
        }
      );
    }

    // --------------------------------------------------------
    // CARD / DAY CLICK
    // --------------------------------------------------------

    document.addEventListener(
      'click',
      function (event) {

        // Tombol buka hari
        const dayButton =
          event.target.closest(
            '[data-action="toggle-day"]'
          );

        if (dayButton) {
          const itemId =
            String(
              dayButton.dataset.itemId || ''
            ).trim();

          const dayNumber =
            Number(
              dayButton.dataset.dayNumber
            );

          if (
            itemId &&
            Number.isFinite(dayNumber)
          ) {
            toggleDayCompletion(
              itemId,
              dayNumber
            );
          }

          return;
        }

        // Tombol buka daftar hari
        const openButton =
          event.target.closest(
            '[data-action="open-days"]'
          );

        if (openButton) {
          const itemId =
            String(
              openButton.dataset.itemId || ''
            ).trim();

          if (itemId) {
            openDayModal(itemId);
          }

          return;
        }

        // Tombol close modal
        const closeButton =
          event.target.closest(
            '[data-action="close-modal"]'
          );

        if (closeButton) {
          closeDayModal();
        }
      }
    );

    // --------------------------------------------------------
    // ESC CLOSE MODAL
    // --------------------------------------------------------

    document.addEventListener(
      'keydown',
      function (event) {
        if (event.key === 'Escape') {
          closeDayModal();
        }
      }
    );
  }

  // ==========================================================
  // RENDER ALL
  // ==========================================================

  function renderAll() {
    renderStats();
    renderToday();
    renderCards();
  }

  // ==========================================================
  // GET ITEM ID
  // ==========================================================

  function getItemId(item) {
    return String(
      item?.id ??
      item?.item_id ??
      item?.itemId ??
      ''
    ).trim();
  }

  // ==========================================================
  // GET ITEM NAME
  // ==========================================================

  function getItemName(item) {
    return String(
      item?.name ??
      item?.nama ??
      item?.title ??
      item?.map_name ??
      'Tanpa Nama'
    );
  }

  // ==========================================================
  // GET ITEM DURATION
  // ==========================================================

  function getItemDuration(item) {
    const duration =
      Number(item?.duration_days) ||
      Number(item?.duration) ||
      Number(item?.days) ||
      14;

    return duration > 0 ? duration : 14;
  }

  // ==========================================================
  // GET PROGRESS
  // ==========================================================

  function getProgressForItem(itemId) {
    const key = String(itemId).trim();

    if (!progress[key]) {
      return [];
    }

    return progress[key]
      .map(Number)
      .filter(function (day) {
        return Number.isFinite(day) && day > 0;
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  // ==========================================================
  // CHECK DAY COMPLETED
  // ==========================================================

  function isDayCompleted(itemId, dayNumber) {
    const itemProgress =
      getProgressForItem(itemId);

    return itemProgress.includes(
      Number(dayNumber)
    );
  }

  // ==========================================================
  // LAST COMPLETED DAY
  // ==========================================================

  function getLastCompletedDay(itemId) {
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

  // ==========================================================
  // COMPLETED COUNT
  // ==========================================================

  function getCompletedDaysCount(itemId) {
    return getProgressForItem(itemId).length;
  }

  // ==========================================================
  // TODAY DATE
  // ==========================================================

  function getTodayDate() {
    const date = new Date();

    const year =
      date.getFullYear();

    const month =
      String(date.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(date.getDate())
        .padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ==========================================================
  // DATE ONLY
  // ==========================================================

  function dateOnly(value) {
    if (!value) return '';

    const stringValue =
      String(value).trim();

    // YYYY-MM-DD
    const match =
      stringValue.match(
        /^(\d{4}-\d{2}-\d{2})/
      );

    if (match) {
      return match[1];
    }

    const date =
      new Date(stringValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  // ==========================================================
  // TODAY ATTENDANCE
  // ==========================================================

  function getTodayAttendance(item) {
    const itemId =
      getItemId(item);

    const today =
      getTodayDate();

    const itemDates =
      progressDates[itemId] || {};

    for (
      const dayKey in itemDates
    ) {
      const attendanceDate =
        dateOnly(itemDates[dayKey]);

      if (attendanceDate === today) {
        return {
          attended: true,
          day: Number(dayKey),
          date: itemDates[dayKey]
        };
      }
    }

    return {
      attended: false,
      day: null,
      date: null
    };
  }

  // ==========================================================
  // RENDER STATS
  // ==========================================================

  function renderStats() {
    const total =
      items.length;

    let done = 0;
    let running = 0;
    let todayCount = 0;

    items.forEach(function (item) {
      const itemId =
        getItemId(item);

      const duration =
        getItemDuration(item);

      const completed =
        getCompletedDaysCount(itemId);

      if (completed >= duration) {
        done++;
      } else if (completed > 0) {
        running++;
      }

      if (
        getTodayAttendance(item).attended
      ) {
        todayCount++;
      }
    });

    const totalElement =
      document.getElementById('stat-total');

    const runningElement =
      document.getElementById('stat-running');

    const doneElement =
      document.getElementById('stat-done');

    const todayElement =
      document.getElementById('stat-today');

    if (totalElement) {
      totalElement.textContent = total;
    }

    if (runningElement) {
      runningElement.textContent = running;
    }

    if (doneElement) {
      doneElement.textContent = done;
    }

    if (todayElement) {
      todayElement.textContent =
        `${todayCount}/${total}`;
    }
  }

  // ==========================================================
  // RENDER TODAY
  // ==========================================================

  function renderToday() {
    const pendingList =
      document.getElementById(
        'today-pending-list'
      );

    const completedList =
      document.getElementById(
        'today-completed-list'
      );

    if (!pendingList || !completedList) {
      return;
    }

    const pending = [];
    const completed = [];

    items.forEach(function (item) {
      const attendance =
        getTodayAttendance(item);

      if (attendance.attended) {
        completed.push({
          item,
          attendance
        });
      } else {
        pending.push(item);
      }
    });

    // --------------------------------------------------------
    // PENDING
    // --------------------------------------------------------

    if (!pending.length) {
      pendingList.innerHTML = `
        <div class="today-empty">
          Semua item sudah absen hari ini.
        </div>
      `;
    } else {
      pendingList.innerHTML =
        pending.map(function (item) {

          const itemId =
            getItemId(item);

          const name =
            escapeHtml(
              getItemName(item)
            );

          return `
            <div class="today-item">
              <div class="today-item-info">
                <strong>${name}</strong>
                <span>Belum absen hari ini</span>
              </div>

              <button
                class="btn btn-primary btn-sm"
                data-action="open-days"
                data-item-id="${escapeAttr(itemId)}">
                Absen
              </button>
            </div>
          `;
        }).join('');
    }

    // --------------------------------------------------------
    // COMPLETED
    // --------------------------------------------------------

    if (!completed.length) {
      completedList.innerHTML = `
        <div class="today-empty">
          Belum ada absensi hari ini.
        </div>
      `;
    } else {
      completedList.innerHTML =
        completed.map(function (entry) {

          const item =
            entry.item;

          const attendance =
            entry.attendance;

          const name =
            escapeHtml(
              getItemName(item)
            );

          return `
            <div class="today-item">
              <div class="today-item-info">
                <strong>${name}</strong>
                <span>✓ Sudah Absen Hari ${attendance.day}</span>
              </div>
            </div>
          `;
        }).join('');
    }
  }

  // ==========================================================
  // FILTER ITEMS
  // ==========================================================

  function getFilteredItems() {

    return items.filter(function (item) {

      const itemId =
        getItemId(item);

      const name =
        getItemName(item)
          .toLowerCase();

      const duration =
        getItemDuration(item);

      const completed =
        getCompletedDaysCount(itemId);

      const isDone =
        completed >= duration;

      const isRunning =
        completed > 0 &&
        completed < duration;

      // ------------------------------------------------------
      // SEARCH
      // ------------------------------------------------------

      if (
        searchQuery &&
        !name.includes(searchQuery) &&
        !itemId.toLowerCase().includes(searchQuery)
      ) {
        return false;
      }

      // ------------------------------------------------------
      // FILTER
      // ------------------------------------------------------

      switch (currentFilter) {

        case '7':
          return duration === 7;

        case '14':
          return duration === 14;

        case '30':
          return duration === 30;

        case 'running':
          return isRunning;

        case 'done':
          return isDone;

        case 'all':
        default:
          return true;
      }
    });
  }

  // ==========================================================
  // RENDER CARDS
  // ==========================================================

  function renderCards() {

    // PENTING:
    // index.html menggunakan id="cards-grid"
    const container =
      document.getElementById('cards-grid') ||
      document.getElementById('itemsContainer') ||
      document.getElementById('mapContainer') ||
      document.getElementById('cardsContainer') ||
      document.getElementById('items');

    const emptyState =
      document.getElementById('empty-state');

    if (!container) {
      console.error(
        'Container cards tidak ditemukan.'
      );
      return;
    }

    const filteredItems =
      getFilteredItems();

    // --------------------------------------------------------
    // EMPTY
    // --------------------------------------------------------

    if (!filteredItems.length) {

      container.innerHTML = '';

      if (emptyState) {
        emptyState.style.display = 'block';
      }

      return;
    }

    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    container.innerHTML =
      filteredItems.map(function (item) {

        const itemId =
          getItemId(item);

        const itemName =
          getItemName(item);

        const duration =
          getItemDuration(item);

        const itemProgress =
          getProgressForItem(itemId);

        const checkedCount =
          itemProgress.length;

        // ====================================================
        // INI YANG MENENTUKAN DAY PADA KARTU
        // ====================================================

        const lastDay =
          itemProgress.length
            ? Math.max.apply(
                null,
                itemProgress
              )
            : 0;

        const progressLabel =
          `Day ${lastDay}/${duration}`;

        const percentage =
          duration > 0
            ? Math.min(
                100,
                Math.round(
                  (checkedCount / duration) * 100
                )
              )
            : 0;

        const completed =
          checkedCount >= duration;

        const todayAttendance =
          getTodayAttendance(item);

        // ------------------------------------------------------
        // DESCRIPTION
        // ------------------------------------------------------

        const description =
          item.description ||
          item.desc ||
          '';

        // ------------------------------------------------------
        // SAFE HTML
        // ------------------------------------------------------

        const safeName =
          escapeHtml(itemName);

        const safeDescription =
          escapeHtml(description);

        // ------------------------------------------------------
        // TODAY BADGE
        // ------------------------------------------------------

        const todayBadge =
          todayAttendance.attended
            ? `
              <span class="badge badge-success">
                ✓ Absen Hari Ini
              </span>
            `
            : '';

        // ------------------------------------------------------
        // STATUS
        // ------------------------------------------------------

        let statusText = 'Belum Mulai';

        if (completed) {
          statusText = 'Selesai';
        } else if (checkedCount > 0) {
          statusText = 'Berjalan';
        }

        return `
          <article
            class="map-card"
            data-item-id="${escapeAttr(itemId)}">

            <div class="map-card-header">

              <div class="map-card-title">
                <h3>${safeName}</h3>

                ${
                  safeDescription
                    ? `<p>${safeDescription}</p>`
                    : ''
                }
              </div>

              ${todayBadge}

            </div>

            <div class="map-progress">

              <span class="progress-icon">
                ${completed ? '✓' : '◻'}
              </span>

              <span>
                ${progressLabel}
              </span>

            </div>

            <div class="progress-bar">
              <div
                class="progress-bar-fill"
                style="width:${percentage}%">
              </div>
            </div>

            <div class="map-card-meta">

              <span>
                ${checkedCount}/${duration} hari
              </span>

              <span>
                ${percentage}%
              </span>

            </div>

            <div class="map-card-status">
              <span>${statusText}</span>
            </div>

            <button
              type="button"
              class="btn btn-primary btn-block"
              data-action="open-days"
              data-item-id="${escapeAttr(itemId)}">

              ${
                completed
                  ? 'Lihat Absensi'
                  : 'Pilih Hari'
              }

            </button>

          </article>
        `;
      }).join('');
  }

  // ==========================================================
  // OPEN DAY MODAL
  // ==========================================================

  function openDayModal(itemId) {

    const item =
      items.find(function (entry) {
        return getItemId(entry) ===
          String(itemId).trim();
      });

    if (!item) {
      showToast(
        'Item tidak ditemukan.',
        'error'
      );
      return;
    }

    const duration =
      getItemDuration(item);

    const completedDays =
      getProgressForItem(itemId);

    const todayAttendance =
      getTodayAttendance(item);

    // --------------------------------------------------------
    // REMOVE OLD MODAL
    // --------------------------------------------------------

    closeDayModal();

    // --------------------------------------------------------
    // CREATE MODAL
    // --------------------------------------------------------

    const modal =
      document.createElement('div');

    modal.id = 'day-modal';
    modal.className = 'modal-overlay';

    modal.innerHTML = `
      <div class="modal">

        <div class="modal-header">

          <div>
            <h3>
              ${escapeHtml(getItemName(item))}
            </h3>

            <p>
              Pilih hari absensi secara manual.
            </p>
          </div>

          <button
            type="button"
            class="modal-close"
            data-action="close-modal">
            ×
          </button>

        </div>

        <div class="modal-body">

          <div class="manual-info">
            <strong>
              ${completedDays.length}/${duration} hari
            </strong>

            <span>
              ${
                todayAttendance.attended
                  ? `Hari ini sudah absen — Hari ${todayAttendance.day}`
                  : 'Belum absen hari ini'
              }
            </span>
          </div>

          <div class="days-grid">

            ${Array.from(
              { length: duration },
              function (_, index) {

                const day =
                  index + 1;

                const isCompleted =
                  completedDays.includes(day);

                const isToday =
                  todayAttendance.day === day;

                return `
                  <button
                    type="button"
                    class="
                      day-button
                      ${isCompleted ? 'completed' : ''}
                      ${isToday ? 'today' : ''}
                    "
                    data-action="toggle-day"
                    data-item-id="${escapeAttr(itemId)}"
                    data-day-number="${day}">

                    <span class="day-number">
                      ${day}
                    </span>

                    <span class="day-label">
                      ${
                        isCompleted
                          ? '✓'
                          : 'Absen'
                      }
                    </span>

                  </button>
                `;
              }
            ).join('')}

          </div>

          <p class="manual-note">
            Klik hari untuk mencatat atau membatalkan absensi.
            Tidak menggunakan timer.
          </p>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Klik area luar modal untuk menutup
    modal.addEventListener(
      'click',
      function (event) {
        if (event.target === modal) {
          closeDayModal();
        }
      }
    );
  }

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  function closeDayModal() {

    const modal =
      document.getElementById('day-modal');

    if (modal) {
      modal.remove();
    }
  }

  // ==========================================================
  // TOGGLE DAY COMPLETION
  // ==========================================================

  async function toggleDayCompletion(
    itemId,
    dayNumber
  ) {

    const cleanItemId =
      String(itemId).trim();

    const day =
      Number(dayNumber);

    if (
      !cleanItemId ||
      !Number.isFinite(day) ||
      day <= 0
    ) {
      return;
    }

    const key =
      `${cleanItemId}__${day}`;

    if (savingProgress.has(key)) {
      return;
    }

    const currentlyCompleted =
      isDayCompleted(
        cleanItemId,
        day
      );

    const newValue =
      !currentlyCompleted;

    savingProgress.add(key);

    try {

      // ------------------------------------------------------
      // OPTIMISTIC UI UPDATE
      // ------------------------------------------------------

      if (!progress[cleanItemId]) {
        progress[cleanItemId] = [];
      }

      if (newValue) {

        if (
          !progress[cleanItemId].includes(day)
        ) {
          progress[cleanItemId].push(day);
        }

        progress[cleanItemId].sort(
          function (a, b) {
            return a - b;
          }
        );

      } else {

        progress[cleanItemId] =
          progress[cleanItemId].filter(
            function (value) {
              return Number(value) !== day;
            }
          );
      }

      renderAll();

      // ------------------------------------------------------
      // SAVE SERVER
      // ------------------------------------------------------

      const response =
        await Auth.apiFetch(
          'updateProgress',
          {
            itemId: cleanItemId,
            dayNumber: day,
            completed: newValue
          }
        );

      if (
        !response ||
        !response.success
      ) {
        throw new Error(
          response?.message ||
          'Gagal menyimpan absensi.'
        );
      }

      // ------------------------------------------------------
      // SAVE DATE
      // ------------------------------------------------------

      if (!progressDates[cleanItemId]) {
        progressDates[cleanItemId] = {};
      }

      if (newValue) {

        progressDates[cleanItemId][day] =
          response.date ||
          getTodayDate();

      } else {

        delete progressDates[
          cleanItemId
        ][day];
      }

      renderAll();

      // ------------------------------------------------------
      // UPDATE MODAL
      // ------------------------------------------------------

      openDayModal(cleanItemId);

      showToast(
        newValue
          ? `Hari ${day} berhasil diabsen.`
          : `Absensi Hari ${day} dibatalkan.`,
        'success'
      );

    } catch (error) {

      console.error(
        'toggleDayCompletion error:',
        error
      );

      // ------------------------------------------------------
      // ROLLBACK
      // ------------------------------------------------------

      if (!progress[cleanItemId]) {
        progress[cleanItemId] = [];
      }

      if (currentlyCompleted) {

        if (
          !progress[cleanItemId].includes(day)
        ) {
          progress[cleanItemId].push(day);
        }

        progress[cleanItemId].sort(
          function (a, b) {
            return a - b;
          }
        );

      } else {

        progress[cleanItemId] =
          progress[cleanItemId].filter(
            function (value) {
              return Number(value) !== day;
            }
          );
      }

      renderAll();

      showToast(
        error.message ||
        'Gagal menyimpan absensi.',
        'error'
      );

    } finally {
      savingProgress.delete(key);
    }
  }

  // ==========================================================
  // LOADER
  // ==========================================================

  function showLoader(show) {

    const loader =
      document.getElementById('global-loader');

    if (!loader) return;

    loader.style.display =
      show ? 'flex' : 'none';
  }

  // ==========================================================
  // SHOW APP
  // ==========================================================

  function showApp(show) {

    const app =
      document.getElementById('app-container');

    if (!app) return;

    app.style.display =
      show ? 'block' : 'none';
  }

  // ==========================================================
  // TOAST
  // ==========================================================

  function showToast(
    message,
    type = 'info'
  ) {

    const container =
      document.getElementById(
        'toast-container'
      );

    if (!container) {
      alert(message);
      return;
    }

    const toast =
      document.createElement('div');

    toast.className =
      `toast toast-${type}`;

    toast.textContent =
      message;

    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('show');
    }, 10);

    setTimeout(function () {

      toast.classList.remove('show');

      setTimeout(function () {
        toast.remove();
      }, 300);

    }, 3000);
  }

  // ==========================================================
  // ESCAPE HTML
  // ==========================================================

  function escapeHtml(value) {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================
  // ESCAPE ATTRIBUTE
  // ==========================================================

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  // ==========================================================
  // START
  // ==========================================================

  await init();

})();
