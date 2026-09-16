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

  // Mencegah klik berkali-kali ketika proses simpan
  const savingProgress = {};

  // ==========================================================
  // INIT
  // ==========================================================

  async function init() {
    try {
      if (typeof Auth !== 'undefined' && Auth.requireAuth) {
        user = await Auth.requireAuth();
      }

      setupUI();
      await loadData();
      renderAll();

    } catch (error) {
      console.error('Gagal memuat aplikasi:', error);

      const app = document.getElementById('app');

      if (app) {
        app.innerHTML = `
          <div class="error-box">
            <h3>Gagal Memuat Data</h3>
            <p>${escapeHtml(error.message || 'Terjadi kesalahan.')}</p>
            <button onclick="location.reload()">Muat Ulang</button>
          </div>
        `;
      }
    }
  }

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadData() {
    try {
      // Ambil daftar map
      const itemResult = await Auth.apiFetch('getItems');

      if (Array.isArray(itemResult)) {
        items = itemResult;
      } else if (itemResult && Array.isArray(itemResult.items)) {
        items = itemResult.items;
      } else {
        items = [];
      }

      // Ambil progress user
      const progressResult = await Auth.apiFetch('getProgress');

      progress = {};
      progressDates = {};

      if (progressResult) {
        if (progressResult.progress) {
          progress = progressResult.progress;
        }

        if (progressResult.progressDates) {
          progressDates = progressResult.progressDates;
        }

        // Kalau backend mengembalikan langsung object progress
        if (
          !progressResult.progress &&
          !progressResult.progressDates &&
          typeof progressResult === 'object'
        ) {
          progress = progressResult;
        }
      }

      normalizeProgress();

    } catch (error) {
      console.error('loadData error:', error);
      throw error;
    }
  }

  // ==========================================================
  // NORMALISASI DATA PROGRESS
  // ==========================================================

  function normalizeProgress() {
    const normalized = {};

    Object.keys(progress || {}).forEach(function (itemId) {
      const value = progress[itemId];

      if (!Array.isArray(value)) {
        normalized[itemId] = [];
        return;
      }

      normalized[itemId] = value
        .map(function (day) {
          return Number(day);
        })
        .filter(function (day) {
          return Number.isFinite(day) && day > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
    });

    progress = normalized;
  }

  // ==========================================================
  // TANGGAL HARI INI
  // ==========================================================

  function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ==========================================================
  // PROGRESS PER MAP
  // ==========================================================

  function getProgressForItem(itemId) {
    const data = progress[itemId];

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(function (day) {
        return Number(day);
      })
      .filter(function (day) {
        return Number.isFinite(day) && day > 0;
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  function getCompletedDaysCount(itemId) {
    return getProgressForItem(itemId).length;
  }

  function isDayCompleted(itemId, dayNumber) {
    const days = getProgressForItem(itemId);

    return days.includes(Number(dayNumber));
  }

  // ==========================================================
  // DAY TERAKHIR / CURRENT DAY
  //
  // INI YANG MEMPERBAIKI MASALAH:
  // Block 90's kalau sudah sampai Day 6 -> Day 6/14
  // bukan kembali menjadi Day 1/14.
  // ==========================================================

  function getLastCompletedDay(itemId) {
    const days = getProgressForItem(itemId);

    if (!days.length) {
      return 0;
    }

    return Math.max.apply(null, days);
  }

  // ==========================================================
  // ABSENSI HARI INI
  //
  // Ini sengaja DIPISAH dari progress.
  // Progress Day 6 tidak berarti absensi hari ini Day 6.
  // ==========================================================

  function getTodayAttendance(item) {
    const itemId = String(item.id);
    const completedDays = getProgressForItem(itemId);

    if (!completedDays.length) {
      return null;
    }

    const today = getTodayDate();

    const dateData = progressDates[itemId];

    if (!dateData) {
      return null;
    }

    // Bentuk object:
    // {
    //   "1": "2026-09-16",
    //   "2": "2026-09-15"
    // }
    if (typeof dateData === 'object' && !Array.isArray(dateData)) {
      for (let i = completedDays.length - 1; i >= 0; i--) {
        const dayNumber = completedDays[i];

        if (String(dateData[dayNumber]) === today) {
          return dayNumber;
        }
      }
    }

    return null;
  }

  // ==========================================================
  // SETUP UI
  // ==========================================================

  function setupUI() {
    // Search
    const searchInput =
      document.getElementById('searchInput') ||
      document.getElementById('search');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchQuery = this.value.trim().toLowerCase();
        renderCards();
      });
    }

    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentFilter = this.dataset.filter || 'all';

        document
          .querySelectorAll('[data-filter]')
          .forEach(function (btn) {
            btn.classList.remove('active');
          });

        this.classList.add('active');

        renderCards();
      });
    });
  }

  // ==========================================================
  // FILTER
  // ==========================================================

  function getFilteredItems() {
    return items.filter(function (item) {
      const name = String(
        item.name ||
        item.title ||
        item.map_name ||
        ''
      ).toLowerCase();

      if (searchQuery && !name.includes(searchQuery)) {
        return false;
      }

      const todayAttendance = getTodayAttendance(item);

      if (currentFilter === 'done') {
        return todayAttendance !== null;
      }

      if (currentFilter === 'pending') {
        return todayAttendance === null;
      }

      return true;
    });
  }

  // ==========================================================
  // RENDER SEMUA
  // ==========================================================

  function renderAll() {
    renderUser();
    renderToday();
    renderCards();
  }

  // ==========================================================
  // RENDER USER
  // ==========================================================

  function renderUser() {
    if (!user) {
      return;
    }

    const nameElement =
      document.getElementById('userName') ||
      document.getElementById('username');

    if (nameElement) {
      nameElement.textContent =
        user.name ||
        user.username ||
        user.email ||
        'User';
    }
  }

  // ==========================================================
  // RENDER STATUS ABSENSI HARI INI
  // ==========================================================

  function renderToday() {
    const container =
      document.getElementById('todayAttendance') ||
      document.getElementById('todayList');

    if (!container) {
      return;
    }

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          Belum ada map.
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(function (item) {
      const todayDay = getTodayAttendance(item);

      const name =
        item.name ||
        item.title ||
        item.map_name ||
        'Map';

      const duration =
        Number(item.duration_days) ||
        Number(item.duration) ||
        14;

      if (todayDay !== null) {
        return `
          <div class="today-item">
            <div class="today-map-name">
              ${escapeHtml(name)}
            </div>

            <div class="today-status done">
              ✓ Sudah Absen Hari Ini
            </div>

            <div class="today-day">
              Day ${todayDay}/${duration}
            </div>
          </div>
        `;
      }

      return `
        <div class="today-item">
          <div class="today-map-name">
            ${escapeHtml(name)}
          </div>

          <div class="today-status pending">
            Belum Absen Hari Ini
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================
  // RENDER CARD MAP
  // ==========================================================

  function renderCards() {
    const container =
      document.getElementById('itemsContainer') ||
      document.getElementById('mapContainer') ||
      document.getElementById('cardsContainer') ||
      document.getElementById('items');

    if (!container) {
      return;
    }

    const filteredItems = getFilteredItems();

    if (!filteredItems.length) {
      container.innerHTML = `
        <div class="empty-state">
          Tidak ada map yang ditemukan.
        </div>
      `;
      return;
    }

    container.innerHTML = filteredItems.map(function (item) {

      const itemId = String(item.id);

      // ======================================================
      // PENTING:
      // Ambil progress KHUSUS map ini.
      // ======================================================

      const itemProgress = getProgressForItem(itemId);

      const checkedCount = itemProgress.length;

      // Day TERAKHIR yang sudah dicentang.
      // Contoh [1,2,3,4,5,6] -> 6
      const lastDay = itemProgress.length
        ? Math.max.apply(null, itemProgress)
        : 0;

      const duration =
        Number(item.duration_days) ||
        Number(item.duration) ||
        14;

      const todayDay = getTodayAttendance(item);

      // ======================================================
      // LABEL PROGRESS
      // ======================================================

      const progressLabel =
        `Day ${lastDay}/${duration}`;

      // ======================================================
      // STATUS HARI INI
      // ======================================================

      let todayStatus = '';

      if (todayDay !== null) {
        todayStatus = `
          <div class="today-status done">
            ✓ Sudah Absen Hari Ini
          </div>
        `;
      } else {
        todayStatus = `
          <div class="today-status pending">
            Belum Absen Hari Ini
          </div>
        `;
      }

      // ======================================================
      // INFORMASI MAP
      // ======================================================

      const name =
        item.name ||
        item.title ||
        item.map_name ||
        'Map';

      const reward =
        item.reward ||
        item.reward_amount ||
        item.robux ||
        0;

      const mapUrl =
        item.map_url ||
        item.url ||
        item.link ||
        '#';

      return `
        <div
          class="map-card"
          data-item-id="${escapeHtml(itemId)}"
        >

          <div class="map-card-header">

            <div class="map-title">
              <span class="map-dot"></span>

              <span>
                ${escapeHtml(name)}
              </span>
            </div>

          </div>

          <div class="map-card-body">

            ${todayStatus}

            <!-- ============================================
                 PROGRESS MAP
                 BUKAN progress absensi hari ini
                 ============================================ -->

            <div class="map-progress">
              <span class="progress-icon">◻</span>

              <span>
                ${progressLabel}
              </span>
            </div>

            <div class="map-reward">
              <span>💡</span>
              <span>${escapeHtml(String(reward))} robux</span>
            </div>

          </div>

          <div class="map-card-actions">

            ${
              mapUrl && mapUrl !== '#'
                ? `
                  <a
                    href="${escapeAttribute(mapUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-button"
                  >
                    Buka Map
                  </a>
                `
                : ''
            }

            <button
              type="button"
              class="attendance-button"
              data-action="open-days"
              data-item-id="${escapeHtml(itemId)}"
            >
              Pilih Day
            </button>

          </div>

        </div>
      `;
    }).join('');

    // Pasang event setelah HTML dibuat
    bindCardEvents();
  }

  // ==========================================================
  // EVENT CARD
  // ==========================================================

  function bindCardEvents() {
    document
      .querySelectorAll('[data-action="open-days"]')
      .forEach(function (button) {

        button.addEventListener('click', function () {

          const itemId = this.dataset.itemId;

          const item = items.find(function (data) {
            return String(data.id) === String(itemId);
          });

          if (!item) {
            return;
          }

          showDaySelector(item);
        });
      });
  }

  // ==========================================================
  // PILIH DAY
  // ==========================================================

  function showDaySelector(item) {
    const duration =
      Number(item.duration_days) ||
      Number(item.duration) ||
      14;

    const completedDays = getProgressForItem(item.id);

    const name =
      item.name ||
      item.title ||
      item.map_name ||
      'Map';

    // Hapus modal lama
    const oldModal = document.getElementById('daySelectorModal');

    if (oldModal) {
      oldModal.remove();
    }

    const modal = document.createElement('div');

    modal.id = 'daySelectorModal';

    modal.className = 'day-modal-overlay';

    modal.innerHTML = `
      <div class="day-modal">

        <div class="day-modal-header">

          <h3>
            ${escapeHtml(name)}
          </h3>

          <button
            type="button"
            class="day-modal-close"
            id="closeDayModal"
          >
            ×
          </button>

        </div>

        <div class="day-modal-info">
          Pilih Day yang sudah kamu kerjakan.
        </div>

        <div class="day-grid">

          ${Array.from(
            { length: duration },
            function (_, index) {

              const day = index + 1;

              const checked = completedDays.includes(day);

              return `
                <button
                  type="button"
                  class="day-button ${checked ? 'completed' : ''}"
                  data-day="${day}"
                  data-item-id="${escapeHtml(String(item.id))}"
                  ${savingProgress[item.id] ? 'disabled' : ''}
                >
                  <span>
                    Day ${day}
                  </span>

                  ${
                    checked
                      ? '<span>✓</span>'
                      : ''
                  }
                </button>
              `;
            }
          ).join('')}

        </div>

        <div class="day-modal-footer">
          <small>
            Tidak ada timer. Kamu mencatat absensi secara manual.
          </small>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Close
    const closeButton =
      document.getElementById('closeDayModal');

    if (closeButton) {
      closeButton.addEventListener('click', function () {
        modal.remove();
      });
    }

    // Klik luar modal
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        modal.remove();
      }
    });

    // Day buttons
    modal
      .querySelectorAll('.day-button')
      .forEach(function (button) {

        button.addEventListener('click', async function () {

          const day = Number(this.dataset.day);
          const itemId = this.dataset.itemId;

          await toggleDayCompletion(
            itemId,
            day,
            this,
            modal
          );
        });
      });
  }

  // ==========================================================
  // TOGGLE DAY
  // ==========================================================

  async function toggleDayCompletion(
    itemId,
    dayNumber,
    button,
    modal
  ) {

    itemId = String(itemId);
    dayNumber = Number(dayNumber);

    if (savingProgress[itemId]) {
      return;
    }

    savingProgress[itemId] = true;

    if (button) {
      button.disabled = true;
      button.classList.add('saving');
    }

    try {

      const currentDays = getProgressForItem(itemId);

      const alreadyCompleted =
        currentDays.includes(dayNumber);

      let newDays;

      if (alreadyCompleted) {

        // Hapus Day
        newDays = currentDays.filter(function (day) {
          return day !== dayNumber;
        });

      } else {

        // Tambah Day
        newDays = currentDays.slice();

        if (!newDays.includes(dayNumber)) {
          newDays.push(dayNumber);
        }

        newDays.sort(function (a, b) {
          return a - b;
        });
      }

      // ======================================================
      // OPTIMISTIC UPDATE
      // ======================================================

      progress[itemId] = newDays;

      if (!progressDates[itemId]) {
        progressDates[itemId] = {};
      }

      if (!alreadyCompleted) {

        // Hari ini dicatat untuk Day yang baru dipilih
        progressDates[itemId][dayNumber] = getTodayDate();

      } else {

        // Jika Day di-uncheck, tanggalnya juga dihapus
        delete progressDates[itemId][dayNumber];
      }

      renderCards();
      renderToday();

      // ======================================================
      // SIMPAN KE SERVER
      // ======================================================

      const result = await Auth.apiFetch(
        'updateProgress',
        {
          itemId: itemId,
          dayNumber: dayNumber,
          completed: !alreadyCompleted
        }
      );

      // ======================================================
      // GUNAKAN TANGGAL DARI SERVER JIKA ADA
      // ======================================================

      if (
        result &&
        result.date &&
        !alreadyCompleted
      ) {
        if (!progressDates[itemId]) {
          progressDates[itemId] = {};
        }

        progressDates[itemId][dayNumber] =
          String(result.date);
      }

      // ======================================================
      // JANGAN loadData() DI SINI
      //
      // Ini sengaja supaya data yang baru disimpan tidak
      // langsung tertimpa oleh pembacaan lama dari server.
      // ======================================================

      renderCards();
      renderToday();

      // Update tampilan tombol Day
      if (modal && document.body.contains(modal)) {

        const dayButton =
          modal.querySelector(
            `.day-button[data-day="${dayNumber}"]`
          );

        if (dayButton) {

          if (!alreadyCompleted) {
            dayButton.classList.add('completed');

            if (
              !dayButton.querySelector('.check')
            ) {
              const check =
                document.createElement('span');

              check.className = 'check';
              check.textContent = '✓';

              dayButton.appendChild(check);
            }

          } else {

            dayButton.classList.remove('completed');

            const check =
              dayButton.querySelector('.check');

            if (check) {
              check.remove();
            }
          }
        }
      }

    } catch (error) {

      console.error(
        'Gagal menyimpan progress:',
        error
      );

      // ======================================================
      // KALAU SERVER GAGAL, KEMBALIKAN STATE LAMA
      // ======================================================

      if (alreadyCompleted) {

        if (!progress[itemId]) {
          progress[itemId] = [];
        }

        progress[itemId].push(dayNumber);

        progress[itemId].sort(function (a, b) {
          return a - b;
        });

        if (!progressDates[itemId]) {
          progressDates[itemId] = {};
        }

        progressDates[itemId][dayNumber] =
          getTodayDate();

      } else {

        progress[itemId] =
          progress[itemId].filter(function (day) {
            return day !== dayNumber;
          });

        if (
          progressDates[itemId]
        ) {
          delete progressDates[itemId][dayNumber];
        }
      }

      renderCards();
      renderToday();

      alert(
        'Gagal menyimpan absensi. Silakan coba lagi.'
      );

    } finally {

      savingProgress[itemId] = false;

      if (button) {
        button.disabled = false;
        button.classList.remove('saving');
      }
    }
  }

  // ==========================================================
  // ESCAPE HTML
  // ==========================================================

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================
  // ESCAPE ATTRIBUTE
  // ==========================================================

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==========================================================
  // GLOBAL
  // ==========================================================

  window.AbsensiMap = {
    loadData,
    renderAll,
    renderCards,
    renderToday,
    getProgressForItem,
    getLastCompletedDay,
    getTodayAttendance,
    toggleDayCompletion
  };

  // ==========================================================
  // START
  // ==========================================================

  await init();

})();

Yang paling penting sudah saya ubah di sini: "Day X/14" sekarang memakai Day tertinggi yang benar-benar tersimpan pada map tersebut. Jadi kalau Block 90's punya "[1,2,3,4,5,6]", tampil Day 6/14, sedangkan Street Skate Party yang baru "[1]" tetap Day 1/14.

Dan tidak ada stay timer sama sekali.
