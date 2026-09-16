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

  // Mencegah klik berkali-kali saat proses penyimpanan
  let savingProgress = false;


  // ==========================================================
  // DOM ELEMENTS
  // ==========================================================

  const $appContainer =
    document.getElementById('app-container');

  const $globalLoader =
    document.getElementById('global-loader');

  const $userNameDisplay =
    document.getElementById('user-name-display');

  const $userAvatarInitial =
    document.getElementById('user-avatar-initial');

  const $btnAdminLink =
    document.getElementById('btn-admin-link');

  const $btnLogout =
    document.getElementById('btn-logout');

  const $greetingTitle =
    document.getElementById('greeting-title');

  const $toastContainer =
    document.getElementById('toast-container');

  const $cardsGrid =
    document.getElementById('cards-grid');

  const $emptyState =
    document.getElementById('empty-state');

  const $searchInput =
    document.getElementById('search-input');

  const $filterChips =
    document.getElementById('filter-chips');

  const $statTotal =
    document.getElementById('stat-total');

  const $statRunning =
    document.getElementById('stat-running');

  const $statDone =
    document.getElementById('stat-done');

  const $statToday =
    document.getElementById('stat-today');

  const $todayPendingList =
    document.getElementById('today-pending-list');

  const $todayCompletedList =
    document.getElementById('today-completed-list');


  // ==========================================================
  // INITIALIZE
  // ==========================================================

  async function init() {

    try {

      user = await Auth.requireAuth();

      if (!user) return;

      setupUI();

      await loadData();

      renderAll();

      if ($appContainer) {
        $appContainer.style.display = '';
      }

      if ($globalLoader) {
        $globalLoader.classList.add('hidden');
      }

      document.body.classList.add('loaded');

    } catch (err) {

      console.error('Init error:', err);

      showToast(
        'Gagal memuat data dari server.',
        'error'
      );

      if ($globalLoader) {

        $globalLoader.innerHTML = `
          <div style="
            color:red;
            font-weight:bold;
            text-align:center;
          ">
            Gagal terhubung ke Apps Script API.<br>
            Pastikan URL Apps Script sudah benar di auth.js.
          </div>
        `;
      }
    }
  }


  // ==========================================================
  // SETUP UI
  // ==========================================================

  function setupUI() {

    if ($userNameDisplay) {
      $userNameDisplay.textContent =
        user.username;
    }

    if ($userAvatarInitial) {
      $userAvatarInitial.textContent =
        user.username
          .charAt(0)
          .toUpperCase();
    }

    if ($greetingTitle) {
      $greetingTitle.textContent =
        `Halo, ${user.username} 👋`;
    }


    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (
      user.role === 'admin' &&
      $btnAdminLink
    ) {
      $btnAdminLink.style.display =
        'inline-flex';
    }


    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    if ($btnLogout) {

      $btnLogout.addEventListener(
        'click',
        () => Auth.logout()
      );
    }


    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if ($searchInput) {

      $searchInput.addEventListener(
        'input',
        function (e) {

          searchQuery =
            e.target.value;

          renderCards();
        }
      );
    }


    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

    if ($filterChips) {

      $filterChips.addEventListener(
        'click',
        function (e) {

          const chip =
            e.target.closest('.chip');

          if (!chip) return;

          currentFilter =
            chip.dataset.filter;

          $filterChips
            .querySelectorAll('.chip')
            .forEach(function (c) {

              c.classList.remove(
                'active'
              );
            });

          chip.classList.add('active');

          renderCards();
        }
      );
    }


    // --------------------------------------------------------
    // CARD CLICK
    // --------------------------------------------------------

    if ($cardsGrid) {

      $cardsGrid.addEventListener(
        'click',
        handleCardClicks
      );
    }
  }


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadData() {

    try {

      // ------------------------------------------------------
      // ITEMS
      // ------------------------------------------------------

      const itemsData =
        await Auth.apiFetch(
          'getItems'
        );

      items =
        itemsData.items || [];


      // ------------------------------------------------------
      // PROGRESS USER
      // ------------------------------------------------------

      const progData =
        await Auth.apiFetch(
          'getProgress'
        );

      progress =
        progData.progress || {};

      progressDates =
        progData.progressDates || {};

    } catch (e) {

      console.error(
        'Load data error:',
        e
      );

      showToast(
        'Gagal memuat data absensi.',
        'error'
      );

      throw e;
    }
  }


  // ==========================================================
  // DATE
  // ==========================================================

  function getTodayDate() {

    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        now.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


  // ==========================================================
  // PROGRESS HELPERS
  // ==========================================================

  function getProgressForItem(itemId) {

    return progress[itemId] || [];
  }


  function getCompletedDaysCount(itemId) {

    return getProgressForItem(itemId)
      .length;
  }


  function isDayCompleted(
    itemId,
    dayNumber
  ) {

    return getProgressForItem(itemId)
      .includes(
        Number(dayNumber)
      );
  }


  function getDayDate(
    itemId,
    dayNumber
  ) {

    if (
      !progressDates[itemId]
    ) {
      return null;
    }

    return (
      progressDates[itemId][dayNumber] ||
      progressDates[itemId][String(dayNumber)] ||
      null
    );
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  function getStatus(item) {

    const completed =
      getCompletedDaysCount(
        item.id
      );

    const duration =
      Number(item.duration_days) || 0;

    if (completed === 0) {
      return 'idle';
    }

    if (
      completed >= duration
    ) {
      return 'done';
    }

    return 'running';
  }


  function getStatusLabel(status) {

    if (status === 'idle') {
      return 'Belum Mulai';
    }

    if (status === 'running') {
      return 'Sedang Berjalan';
    }

    return 'Selesai';
  }


  function calculatePct(item) {

    const duration =
      Number(item.duration_days) || 0;

    if (duration <= 0) {
      return 0;
    }

    const completed =
      getCompletedDaysCount(
        item.id
      );

    return Math.min(
      100,
      Math.round(
        (completed / duration) * 100
      )
    );
  }


  // ==========================================================
  // ABSENSI HARI INI
  // ==========================================================

  function getTodayAttendance(item) {

    const today =
      getTodayDate();

    const dates =
      progressDates[item.id] || {};

    const completedDays =
      getProgressForItem(item.id);

    for (
      let i = 0;
      i < completedDays.length;
      i++
    ) {

      const dayNumber =
        Number(
          completedDays[i]
        );

      const attendanceDate =
        dates[dayNumber] ||
        dates[String(dayNumber)];

      if (
        attendanceDate &&
        String(attendanceDate)
          .substring(0, 10) === today
      ) {

        return dayNumber;
      }
    }

    return null;
  }


  // ==========================================================
  // TOAST
  // ==========================================================

  function showToast(
    message,
    type = 'info'
  ) {

    if (!$toastContainer) {
      return;
    }

    const toast =
      document.createElement('div');

    toast.className =
      `toast toast-${type}`;

    const icon =
      type === 'success'
        ? '✓'
        : type === 'error'
          ? '⚠'
          : 'ℹ';

    toast.innerHTML = `
      ${icon}
      <span>
        ${escHtml(message)}
      </span>
    `;

    $toastContainer.appendChild(
      toast
    );

    setTimeout(function () {

      toast.style.animation =
        'toastOut 0.4s var(--ease) forwards';

      setTimeout(function () {

        toast.remove();

      }, 400);

    }, 3000);
  }


  // ==========================================================
  // DAY CLICK
  // ==========================================================

  async function toggleDayCompletion(
    itemId,
    dayNumber,
    isCurrentlyCompleted
  ) {

    // Jangan proses klik lain
    // selama request sebelumnya belum selesai
    if (savingProgress) {
      return;
    }

    savingProgress = true;

    const targetCompleted =
      !isCurrentlyCompleted;


    // --------------------------------------------------------
    // SIMPAN DATA LAMA
    // untuk rollback jika server gagal
    // --------------------------------------------------------

    const oldProgress =
      JSON.parse(
        JSON.stringify(progress)
      );

    const oldProgressDates =
      JSON.parse(
        JSON.stringify(progressDates)
      );


    // --------------------------------------------------------
    // OPTIMISTIC UPDATE
    // langsung tampilkan perubahan
    // --------------------------------------------------------

    if (!progress[itemId]) {

      progress[itemId] = [];
    }


    if (targetCompleted) {

      // Tambahkan Day
      if (
        !progress[itemId]
          .includes(
            Number(dayNumber)
          )
      ) {

        progress[itemId].push(
          Number(dayNumber)
        );
      }


      // Simpan tanggal hari ini
      if (
        !progressDates[itemId]
      ) {

        progressDates[itemId] = {};
      }

      progressDates[itemId][
        String(dayNumber)
      ] =
        getTodayDate();


    } else {

      // Hapus Day
      progress[itemId] =
        progress[itemId].filter(
          function (d) {

            return (
              Number(d) !==
              Number(dayNumber)
            );
          }
        );


      // Hapus tanggal absensi
      if (
        progressDates[itemId]
      ) {

        delete progressDates[itemId][
          dayNumber
        ];

        delete progressDates[itemId][
          String(dayNumber)
        ];
      }
    }


    // Langsung render
    renderAll();


    // --------------------------------------------------------
    // KIRIM KE SERVER
    // --------------------------------------------------------

    try {

      const result =
        await Auth.apiFetch(
          'updateProgress',
          {
            itemId: itemId,

            dayNumber:
              Number(dayNumber),

            completed:
              targetCompleted
          }
        );


      // ------------------------------------------------------
      // CEK RESPONSE SERVER
      // ------------------------------------------------------

      if (
        !result ||
        (
          result.error &&
          !result.message
        )
      ) {

        throw new Error(
          result.error ||
          'Server gagal menyimpan data.'
        );
      }


      // ------------------------------------------------------
      // JIKA ABSEN BERHASIL
      // ------------------------------------------------------

      if (targetCompleted) {

        // Pastikan Day tetap tercatat
        if (
          !progress[itemId]
        ) {

          progress[itemId] = [];
        }

        if (
          !progress[itemId]
            .includes(
              Number(dayNumber)
            )
        ) {

          progress[itemId].push(
            Number(dayNumber)
          );
        }


        // Gunakan tanggal dari server
        // jika tersedia.
        if (
          !progressDates[itemId]
        ) {

          progressDates[itemId] = {};
        }

        progressDates[itemId][
          String(dayNumber)
        ] =
          result.date ||
          getTodayDate();


        showToast(
          `Day ${dayNumber} berhasil dicatat sebagai absensi hari ini.`,
          'success'
        );

      } else {

        showToast(
          `Absensi Day ${dayNumber} dibatalkan.`,
          'info'
        );
      }


      // ------------------------------------------------------
      // PENTING:
      // TIDAK ADA loadData() DI SINI
      //
      // Karena loadData() dapat mengambil tanggal berbeda
      // dari browser dan menyebabkan status kembali
      // "Belum Absen Hari Ini".
      // ------------------------------------------------------

      renderAll();


    } catch (err) {

      console.error(
        'Update progress error:',
        err
      );


      // ------------------------------------------------------
      // ROLLBACK
      // Kembalikan kondisi sebelum klik
      // ------------------------------------------------------

      progress =
        oldProgress;

      progressDates =
        oldProgressDates;

      renderAll();


      showToast(
        'Gagal menyimpan absensi ke server.',
        'error'
      );

    } finally {

      savingProgress = false;
    }
  }


  // ==========================================================
  // CARD CLICK HANDLER
  // ==========================================================

  function handleCardClicks(e) {

    // --------------------------------------------------------
    // DAY
    // --------------------------------------------------------

    const dayCell =
      e.target.closest(
        '.day-cell'
      );

    if (dayCell) {

      const itemId =
        dayCell.dataset.itemId;

      const dayNumber =
        parseInt(
          dayCell.dataset.day,
          10
        );

      const isCompleted =
        dayCell.classList.contains(
          'checked'
        );


      toggleDayCompletion(
        itemId,
        dayNumber,
        isCompleted
      );

      return;
    }


    // --------------------------------------------------------
    // RESET
    // --------------------------------------------------------

    const resetBtn =
      e.target.closest(
        '.btn-reset-prog'
      );

    if (resetBtn) {

      resetMyProgress();

      return;
    }
  }


  // ==========================================================
  // RESET PROGRESS
  // ==========================================================

  async function resetMyProgress() {

    const confirmed =
      confirm(
        'Yakin ingin mereset seluruh progress milikmu?\n\n' +
        'Semua Day yang sudah dicentang akan dihapus.'
      );

    if (!confirmed) {
      return;
    }


    try {

      await Auth.apiFetch(
        'resetProgress'
      );

      progress = {};
      progressDates = {};

      renderAll();

      showToast(
        'Semua progress berhasil direset.',
        'success'
      );

    } catch (err) {

      console.error(
        'Reset progress error:',
        err
      );

      showToast(
        'Gagal mereset progress.',
        'error'
      );
    }
  }


  // ==========================================================
  // FILTERING
  // ==========================================================

  function filteredData() {

    let result =
      items.slice();


    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if (
      searchQuery.trim()
    ) {

      const q =
        searchQuery
          .toLowerCase()
          .trim();

      result =
        result.filter(
          function (item) {

            return (
              String(
                item.name || ''
              )
                .toLowerCase()
                .includes(q)

              ||

              String(
                item.map_name || ''
              )
                .toLowerCase()
                .includes(q)
            );
          }
        );
    }


    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

    if (
      currentFilter === '7'
    ) {

      result =
        result.filter(
          item =>
            Number(
              item.duration_days
            ) === 7
        );

    } else if (
      currentFilter === '14'
    ) {

      result =
        result.filter(
          item =>
            Number(
              item.duration_days
            ) === 14
        );

    } else if (
      currentFilter === '30'
    ) {

      result =
        result.filter(
          item =>
            Number(
              item.duration_days
            ) === 30
        );

    } else if (
      currentFilter === 'running'
    ) {

      result =
        result.filter(
          item =>
            getStatus(item) ===
            'running'
        );

    } else if (
      currentFilter === 'done'
    ) {

      result =
        result.filter(
          item =>
            getStatus(item) ===
            'done'
        );
    }


    return result;
  }


  // ==========================================================
  // STATISTICS
  // ==========================================================

  function renderStats() {

    const total =
      items.length;

    let running = 0;
    let done = 0;

    items.forEach(
      function (item) {

        const status =
          getStatus(item);

        if (
          status === 'running'
        ) {

          running++;
        }

        if (
          status === 'done'
        ) {

          done++;
        }
      }
    );


    if ($statTotal) {

      $statTotal.textContent =
        total;
    }

    if ($statRunning) {

      $statRunning.textContent =
        running;
    }

    if ($statDone) {

      $statDone.textContent =
        done;
    }
  }


  // ==========================================================
  // RENDER ABSENSI HARI INI
  // ==========================================================

  function renderToday() {

    let pendingHTML = '';
    let completedHTML = '';

    let pendingCount = 0;
    let completedCount = 0;


    items.forEach(
      function (item) {

        const todayDay =
          getTodayAttendance(item);


        // ----------------------------------------------------
        // SUDAH ABSEN
        // ----------------------------------------------------

        if (
          todayDay !== null
        ) {

          completedCount++;

          completedHTML += `
            <div class="today-item">

              <div class="today-item-name">

                <div class="dot green"></div>

                ${escHtml(item.name)}

              </div>

              <div class="today-item-info">

                <span>
                  ✓ Sudah Absen Hari Ini
                </span>

                <span>
                  📅 Day ${todayDay}/${item.duration_days}
                </span>

                <span>
                  📍 ${escHtml(
                    item.map_name || '-'
                  )}
                </span>

              </div>

            </div>
          `;

        } else {

          // --------------------------------------------------
          // BELUM ABSEN
          // --------------------------------------------------

          pendingCount++;

          pendingHTML += `
            <div class="today-item">

              <div class="today-item-name">

                <div class="dot red"></div>

                ${escHtml(item.name)}

              </div>

              <div class="today-item-info">

                <span>
                  ⚠ Belum Absen Hari Ini
                </span>

                <span>
                  📍 ${escHtml(
                    item.map_name || '-'
                  )}
                </span>

                <span>
                  ⏱️ Wajib stay ${
                    item.required_minutes || 0
                  } menit
                </span>

              </div>

            </div>
          `;
        }
      }
    );


    // --------------------------------------------------------
    // EMPTY PENDING
    // --------------------------------------------------------

    if (
      pendingCount === 0
    ) {

      pendingHTML = `
        <div class="today-empty">
          Semua absensi hari ini sudah selesai ✓
        </div>
      `;
    }


    // --------------------------------------------------------
    // EMPTY COMPLETED
    // --------------------------------------------------------

    if (
      completedCount === 0
    ) {

      completedHTML = `
        <div class="today-empty">
          Belum ada absensi yang diselesaikan hari ini.
        </div>
      `;
    }


    if (
      $todayPendingList
    ) {

      $todayPendingList.innerHTML =
        pendingHTML;
    }


    if (
      $todayCompletedList
    ) {

      $todayCompletedList.innerHTML =
        completedHTML;
    }


    // --------------------------------------------------------
    // STAT TODAY
    // --------------------------------------------------------

    if ($statToday) {

      $statToday.textContent =
        `${completedCount}/${items.length}`;
    }
  }


  // ==========================================================
  // RENDER CARDS
  // ==========================================================

  function renderCards() {

    const list =
      filteredData();


    // --------------------------------------------------------
    // EMPTY
    // --------------------------------------------------------

    if (!list.length) {

      if ($cardsGrid) {

        $cardsGrid.style.display =
          'none';
      }

      if ($emptyState) {

        $emptyState.style.display =
          '';
      }

      return;
    }


    if ($cardsGrid) {

      $cardsGrid.style.display =
        '';
    }

    if ($emptyState) {

      $emptyState.style.display =
        'none';
    }


    $cardsGrid.innerHTML =
      list.map(
        function (item, idx) {

          const status =
            getStatus(item);

          const statusLabel =
            getStatusLabel(
              status
            );

          const percent =
            calculatePct(item);

          const checkedCount =
            getCompletedDaysCount(
              item.id
            );

          const todayDay =
            getTodayAttendance(
              item
            );


          // --------------------------------------------------
          // DAYS
          // --------------------------------------------------

          let daysCells = '';

          const duration =
            Number(
              item.duration_days
            ) || 0;


          for (
            let i = 1;
            i <= duration;
            i++
          ) {

            const isChecked =
              isDayCompleted(
                item.id,
                i
              );

            const isTodayAttendance =
              todayDay === i;


            let cls =
              'day-cell';


            if (isChecked) {

              cls +=
                ' checked';
            }


            if (
              isTodayAttendance
            ) {

              cls +=
                ' today-attendance';
            }


            daysCells += `
              <div
                class="${cls}"
                data-item-id="${escHtml(
                  item.id
                )}"
                data-day="${i}"
                title="Klik untuk ${
                  isChecked
                    ? 'membatalkan'
                    : 'mencatat'
                } absensi Day ${i}"
              >
                ${
                  isChecked
                    ? '✓'
                    : ''
                }
                ${i}
              </div>
            `;
          }


          // --------------------------------------------------
          // TODAY STATUS
          // --------------------------------------------------

          let todayStatusHTML = '';


          if (
            todayDay !== null
          ) {

            todayStatusHTML = `
              <div style="
                margin-top:10px;
                padding:10px 12px;
                border-radius:10px;
                background:rgba(34,197,94,.10);
                color:#16a34a;
                font-size:.82rem;
                font-weight:700;
              ">
                ✓ Sudah Absen Hari Ini —
                Day ${todayDay}
              </div>
            `;

          } else {

            todayStatusHTML = `
              <div style="
                margin-top:10px;
                padding:10px 12px;
                border-radius:10px;
                background:rgba(239,68,68,.08);
                color:#dc2626;
                font-size:.82rem;
                font-weight:700;
              ">
                ⚠ Belum Absen Hari Ini
              </div>
            `;
          }


          // --------------------------------------------------
          // CARD
          // --------------------------------------------------

          return `
            <div
              class="card"
              style="
                animation-delay:${idx * 0.05}s
              "
              data-card-id="${escHtml(
                item.id
              )}"
            >

              <!-- HEADER -->

              <div class="card-header">

                <div class="card-title-group">

                  <span class="card-name">
                    ${escHtml(
                      item.name
                    )}
                  </span>

                  <span class="card-duration-badge">
                    ${duration} Hari
                  </span>

                </div>

              </div>


              <!-- MAP INFO -->

              <div class="card-map-info">

                <div class="card-map-info-row">

                  <span class="info-icon">
                    📍
                  </span>

                  <span class="info-label">
                    Map:
                  </span>

                  <span class="info-value">
                    ${escHtml(
                      item.map_name || '-'
                    )}
                  </span>

                </div>


                <div class="card-map-info-row">

                  <span class="info-icon">
                    ⏱️
                  </span>

                  <span class="info-label">
                    Stay wajib:
                  </span>

                  <span class="info-value">
                    ${
                      item.required_minutes || 0
                    } Menit
                  </span>

                </div>

              </div>


              <!-- PROGRESS -->

              <div class="card-progress">

                <div class="progress-info">

                  <span class="progress-text">
                    Progress
                    ${checkedCount}/${duration}
                  </span>

                  <span class="progress-pct">
                    ${percent}%
                  </span>

                </div>


                <div class="progress-bar">

                  <div
                    class="progress-fill ${
                      status === 'done'
                        ? 'complete'
                        : ''
                    }"
                    style="
                      width:${percent}%
                    "
                  ></div>

                </div>


                <div style="
                  font-size:.8rem;
                  margin-top:8px;
                  font-weight:600;
                  color:var(--text-muted);
                ">

                  Status:
                  ${escHtml(
                    statusLabel
                  )}

                </div>

                ${todayStatusHTML}

              </div>


              <!-- DAYS -->

              <div class="card-days">

                <div class="card-days-grid">

                  ${daysCells}

                </div>

              </div>


              <!-- MANUAL INFO -->

              <div style="
                margin-top:14px;
                padding:12px;
                border-radius:10px;
                background:var(--bg-secondary, #f5f5f5);
                font-size:.75rem;
                color:var(--text-muted);
                line-height:1.5;
              ">

                <strong>
                  📌 Absensi Manual
                </strong>

                <br>

                Klik Day yang sudah kamu lakukan.
                Setelah diklik, absensi langsung dicatat.

                <br><br>

                📍 Map dan ⏱️ waktu stay hanya
                sebagai informasi. Website tidak
                menjalankan atau memverifikasi timer.

              </div>

            </div>
          `;
        }
      ).join('');


    // --------------------------------------------------------
    // RESET BUTTON
    // --------------------------------------------------------

    renderResetButton();
  }


  // ==========================================================
  // RESET BUTTON
  // ==========================================================

  function renderResetButton() {

    const oldButton =
      document.getElementById(
        'btn-reset-my-prog'
      );

    if (oldButton) {

      oldButton.remove();
    }


    if (
      Object.keys(progress).length === 0
    ) {

      return;
    }


    if (!$cardsGrid) {

      return;
    }


    const btn =
      document.createElement(
        'button'
      );

    btn.id =
      'btn-reset-my-prog';

    btn.className =
      'btn btn-ghost btn-reset-prog';

    btn.style =
      'margin:20px auto; display:block; color:var(--danger);';

    btn.innerText =
      'Reset Semua Progress Milikku';


    $cardsGrid.parentNode.insertBefore(
      btn,
      $cardsGrid.nextSibling
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
  // ESCAPE HTML
  // ==========================================================

  function escHtml(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return '';
    }


    const div =
      document.createElement(
        'div'
      );

    div.textContent =
      String(value);

    return div.innerHTML;
  }


  // ==========================================================
  // START
  // ==========================================================

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

})();
