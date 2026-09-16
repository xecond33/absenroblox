// =========================================================================
// AbsensiMap — APP.JS
// SISTEM ABSENSI MANUAL
// Tidak menggunakan timer / durasi stay / verifikasi map
// =========================================================================

(function () {

  'use strict';


  // ============================================================
  // STATE
  // ============================================================

  let user = null;
  let items = [];

  // Format:
  // {
  //   itemId: [1, 2, 3]
  // }
  let progress = {};

  // Format:
  // {
  //   itemId: {
  //     1: "2026-09-16T..."
  //   }
  // }
  let progressDates = {};

  let currentFilter = 'all';
  let searchQuery = '';

  const savingProgress = new Set();


  // ============================================================
  // DOM
  // ============================================================

  const $ = (selector) => {
    return document.querySelector(selector);
  };


  // ============================================================
  // INIT
  // ============================================================

  async function init() {

    try {

      // -----------------------------------------
      // Ambil user login
      // -----------------------------------------

      user = await Auth.getUser();

      if (!user) {
        redirectToLogin();
        return;
      }


      // -----------------------------------------
      // Setup
      // -----------------------------------------

      setupListeners();

      updateUserInfo();


      // -----------------------------------------
      // Load data
      // -----------------------------------------

      await loadData();


      // -----------------------------------------
      // Render
      // -----------------------------------------

      renderAll();


      hideLoading();


    } catch (error) {

      console.error('INIT ERROR:', error);

      hideLoading();

      showToast(
        getErrorMessage(error),
        'error'
      );

    }
  }


  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadData() {

    // -----------------------------------------
    // Items
    // -----------------------------------------

    const itemsResult =
      await Auth.apiFetch('getItems');


    if (
      !itemsResult ||
      itemsResult.success === false
    ) {
      throw new Error(
        itemsResult?.error ||
        'Gagal mengambil data item'
      );
    }


    items =
      Array.isArray(itemsResult.items)
        ? itemsResult.items.map(normalizeItem)
        : [];


    // -----------------------------------------
    // Progress
    // -----------------------------------------

    await refreshProgress();
  }


  // ============================================================
  // REFRESH PROGRESS
  // ============================================================

  async function refreshProgress() {

    const result =
      await Auth.apiFetch('getProgress');


    if (
      !result ||
      result.success === false
    ) {
      throw new Error(
        result?.error ||
        'Gagal mengambil progress'
      );
    }


    progress =
      result.progress || {};

    progressDates =
      result.progressDates || {};


    // -----------------------------------------
    // Normalisasi
    // -----------------------------------------

    if (
      !progress ||
      typeof progress !== 'object' ||
      Array.isArray(progress)
    ) {
      progress = {};
    }


    if (
      !progressDates ||
      typeof progressDates !== 'object' ||
      Array.isArray(progressDates)
    ) {
      progressDates = {};
    }


    Object.keys(progress).forEach(function (itemId) {

      if (!Array.isArray(progress[itemId])) {
        progress[itemId] = [];
      }

      progress[itemId] =
        progress[itemId]
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);

    });
  }


  // ============================================================
  // NORMALIZE ITEM
  // ============================================================

  function normalizeItem(item) {

    item = item || {};

    return {

      id:
        String(
          item.id ??
          item.item_id ??
          ''
        ).trim(),

      name:
        String(
          item.name ??
          item.title ??
          ''
        ),

      description:
        String(
          item.description ??
          ''
        ),

      duration:
        Number(
          item.duration ??
          item.days ??
          0
        ),

      created_at:
        item.created_at || ''

    };
  }


  // ============================================================
  // SETUP LISTENERS
  // ============================================================

  function setupListeners() {

    // -----------------------------------------
    // Search
    // -----------------------------------------

    const searchInput =
      $('#searchInput') ||
      $('#search') ||
      document.querySelector(
        '[data-search]'
      );


    if (searchInput) {

      searchInput.addEventListener(
        'input',
        function (e) {

          searchQuery =
            String(
              e.target.value || ''
            )
              .trim()
              .toLowerCase();


          renderAll();
        }
      );
    }


    // -----------------------------------------
    // Filter
    // -----------------------------------------

    document.addEventListener(
      'click',
      function (e) {

        const filterButton =
          e.target.closest(
            '[data-filter]'
          );


        if (!filterButton) {
          return;
        }


        currentFilter =
          filterButton.dataset.filter ||
          'all';


        document
          .querySelectorAll(
            '[data-filter]'
          )
          .forEach(function (button) {

            button.classList.toggle(
              'active',
              button === filterButton
            );

          });


        renderAll();
      }
    );


    // -----------------------------------------
    // Logout
    // -----------------------------------------

    const logoutButton =
      $('#logoutBtn') ||
      $('#logout') ||
      document.querySelector(
        '[data-action="logout"]'
      );


    if (logoutButton) {

      logoutButton.addEventListener(
        'click',
        handleLogout
      );
    }


    // -----------------------------------------
    // Refresh
    // -----------------------------------------

    const refreshButton =
      $('#refreshBtn') ||
      document.querySelector(
        '[data-action="refresh"]'
      );


    if (refreshButton) {

      refreshButton.addEventListener(
        'click',
        async function () {

          try {

            showLoading();

            await loadData();

            renderAll();

            showToast(
              'Data berhasil diperbarui',
              'success'
            );

          } catch (error) {

            console.error(
              'REFRESH ERROR:',
              error
            );

            showToast(
              getErrorMessage(error),
              'error'
            );

          } finally {

            hideLoading();
          }

        }
      );
    }
  }


  // ============================================================
  // USER INFO
  // ============================================================

  function updateUserInfo() {

    if (!user) {
      return;
    }


    const username =
      user.username ||
      user.name ||
      'User';


    document
      .querySelectorAll(
        '[data-user-name]'
      )
      .forEach(function (element) {

        element.textContent =
          username;

      });


    const usernameElements = [
      '#username',
      '#userName',
      '#profileName'
    ];


    usernameElements.forEach(function (selector) {

      const element =
        $(selector);

      if (element) {
        element.textContent =
          username;
      }

    });
  }


  // ============================================================
  // RENDER ALL
  // ============================================================

  function renderAll() {

    renderItems();

    renderSummary();
  }


  // ============================================================
  // FILTER ITEMS
  // ============================================================

  function getFilteredItems() {

    return items.filter(function (item) {

      const name =
        String(item.name || '')
          .toLowerCase();

      const description =
        String(item.description || '')
          .toLowerCase();


      // Search
      if (
        searchQuery &&
        !name.includes(searchQuery) &&
        !description.includes(searchQuery)
      ) {

        return false;
      }


      const completedDays =
        getProgressForItem(item.id).length;


      const duration =
        Number(item.duration || 0);


      // Filter
      switch (currentFilter) {

        case 'completed':

          return (
            duration > 0 &&
            completedDays >= duration
          );


        case 'progress':

          return (
            completedDays > 0 &&
            completedDays < duration
          );


        case 'pending':

          return completedDays === 0;


        case 'all':
        default:

          return true;
      }

    });
  }


  // ============================================================
  // RENDER ITEMS
  // ============================================================

  function renderItems() {

    const container =
      $('#itemsContainer') ||
      $('#itemsList') ||
      document.querySelector(
        '[data-items-container]'
      );


    if (!container) {

      console.warn(
        'Container item tidak ditemukan'
      );

      return;
    }


    const filteredItems =
      getFilteredItems();


    if (!filteredItems.length) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">
            Tidak ada data
          </div>
          <div class="empty-text">
            Belum ada item yang sesuai.
          </div>
        </div>
      `;

      return;
    }


    container.innerHTML =
      filteredItems
        .map(renderItem)
        .join('');
  }


  // ============================================================
  // RENDER ITEM
  // ============================================================

  function renderItem(item) {

    const itemId =
      escapeHtml(item.id);

    const name =
      escapeHtml(item.name);

    const description =
      escapeHtml(item.description);

    const duration =
      Number(item.duration || 0);


    const completedDays =
      getProgressForItem(item.id);


    const completedCount =
      completedDays.length;


    const percentage =
      duration > 0
        ? Math.min(
            100,
            Math.round(
              completedCount /
              duration *
              100
            )
          )
        : 0;


    let daysHtml = '';


    for (
      let day = 1;
      day <= duration;
      day++
    ) {

      const completed =
        completedDays.includes(day);


      const date =
        getProgressDate(
          item.id,
          day
        );


      daysHtml +=
        renderDayButton(
          item.id,
          day,
          completed,
          date
        );
    }


    return `
      <div
        class="item-card"
        data-item-id="${itemId}"
      >

        <div class="item-header">

          <div class="item-title-area">

            <h3 class="item-title">
              ${name}
            </h3>

            ${
              description
                ? `
                  <div class="item-description">
                    ${description}
                  </div>
                `
                : ''
            }

          </div>

          <div class="item-progress-text">
            ${completedCount}/${duration}
          </div>

        </div>


        <div class="progress-bar-wrapper">

          <div class="progress-bar">

            <div
              class="progress-bar-fill"
              style="width:${percentage}%"
            ></div>

          </div>

          <span class="progress-percent">
            ${percentage}%
          </span>

        </div>


        <div class="days-grid">

          ${daysHtml}

        </div>

      </div>
    `;
  }


  // ============================================================
  // RENDER DAY BUTTON
  // ============================================================

  function renderDayButton(
    itemId,
    day,
    completed,
    date
  ) {

    const safeItemId =
      escapeHtml(itemId);


    const safeDate =
      date
        ? escapeHtml(formatDate(date))
        : '';


    return `
      <button
        type="button"
        class="day-button ${
          completed
            ? 'completed'
            : ''
        }"
        data-item-id="${safeItemId}"
        data-day="${day}"
        onclick="window.AbsensiMap.toggleDayCompletion(
          '${escapeJs(itemId)}',
          ${day},
          this
        )"
      >

        <span class="day-number">
          Day ${day}
        </span>

        ${
          completed
            ? `
              <span class="day-check">
                ✓
              </span>
            `
            : `
              <span class="day-check">
                ○
              </span>
            `
        }

        ${
          safeDate
            ? `
              <span class="day-date">
                ${safeDate}
              </span>
            `
            : ''
        }

      </button>
    `;
  }


  // ============================================================
  // TOGGLE DAY COMPLETION
  // ============================================================

  async function toggleDayCompletion(
    itemId,
    dayNumber,
    button
  ) {

    itemId =
      String(itemId || '').trim();

    dayNumber =
      Number(dayNumber);


    if (!itemId) {

      showToast(
        'Item tidak valid',
        'error'
      );

      return;
    }


    if (
      !Number.isInteger(dayNumber) ||
      dayNumber < 1
    ) {

      showToast(
        'Day tidak valid',
        'error'
      );

      return;
    }


    const lockKey =
      itemId + ':' + dayNumber;


    if (
      savingProgress.has(lockKey)
    ) {

      return;
    }


    const item =
      items.find(function (x) {

        return String(x.id) === itemId;

      });


    if (!item) {

      showToast(
        'Item tidak ditemukan',
        'error'
      );

      return;
    }


    const duration =
      Number(item.duration || 0);


    if (
      duration > 0 &&
      dayNumber > duration
    ) {

      showToast(
        'Day melebihi durasi item',
        'error'
      );

      return;
    }


    const current =
      getProgressForItem(itemId);


    const alreadyCompleted =
      current.includes(dayNumber);


    const newCompleted =
      !alreadyCompleted;


    // -----------------------------------------
    // Lock
    // -----------------------------------------

    savingProgress.add(lockKey);


    // -----------------------------------------
    // Simpan state lama untuk rollback
    // -----------------------------------------

    const oldProgress =
      Array.isArray(progress[itemId])
        ? [...progress[itemId]]
        : [];


    const oldDates =
      progressDates[itemId]
        ? {
            ...progressDates[itemId]
          }
        : {};


    // -----------------------------------------
    // Optimistic UI
    // -----------------------------------------

    if (newCompleted) {

      if (!progress[itemId]) {
        progress[itemId] = [];
      }

      if (
        !progress[itemId].includes(dayNumber)
      ) {

        progress[itemId].push(dayNumber);

      }

      progress[itemId].sort(
        (a, b) => a - b
      );

    } else {

      progress[itemId] =
        progress[itemId]
          .filter(
            d => d !== dayNumber
          );


      if (
        progressDates[itemId]
      ) {

        delete progressDates[itemId][
          dayNumber
        ];
      }
    }


    updateDayButton(
      button,
      newCompleted
    );


    try {

      // ---------------------------------------
      // SEND TO BACKEND
      // ---------------------------------------

      const result =
        await Auth.apiFetch(
          'updateProgress',
          {
            itemId: itemId,
            dayNumber: dayNumber,
            completed: newCompleted
          }
        );


      console.log(
        'UPDATE PROGRESS RESULT:',
        result
      );


      if (
        !result ||
        result.success === false
      ) {

        throw new Error(
          result?.error ||
          'Gagal menyimpan progress'
        );
      }


      // ---------------------------------------
      // Date
      // ---------------------------------------

      if (
        newCompleted &&
        result.date
      ) {

        if (!progressDates[itemId]) {

          progressDates[itemId] = {};
        }


        progressDates[itemId][dayNumber] =
          result.date;
      }


      // ---------------------------------------
      // Sinkronkan dengan server
      // ---------------------------------------

      await refreshProgress();


      renderAll();


      showToast(
        newCompleted
          ? `Day ${dayNumber} berhasil disimpan`
          : `Day ${dayNumber} dibatalkan`,
        'success'
      );


    } catch (error) {

      console.error(
        'UPDATE PROGRESS ERROR:',
        error
      );


      // ---------------------------------------
      // ROLLBACK
      // ---------------------------------------

      progress[itemId] =
        oldProgress;


      progressDates[itemId] =
        oldDates;


      renderAll();


      showToast(
        getErrorMessage(error),
        'error'
      );


    } finally {

      savingProgress.delete(lockKey);
    }
  }


  // ============================================================
  // UPDATE DAY BUTTON
  // ============================================================

  function updateDayButton(
    button,
    completed
  ) {

    if (!button) {
      return;
    }


    button.classList.toggle(
      'completed',
      completed
    );


    const check =
      button.querySelector(
        '.day-check'
      );


    if (check) {

      check.textContent =
        completed
          ? '✓'
          : '○';
    }
  }


  // ============================================================
  // GET PROGRESS ITEM
  // ============================================================

  function getProgressForItem(itemId) {

    itemId =
      String(itemId || '').trim();


    const value =
      progress[itemId];


    if (!Array.isArray(value)) {
      return [];
    }


    return value
      .map(Number)
      .filter(Number.isFinite);
  }


  // ============================================================
  // GET PROGRESS DATE
  // ============================================================

  function getProgressDate(
    itemId,
    day
  ) {

    if (
      !progressDates ||
      !progressDates[itemId]
    ) {

      return '';
    }


    return (
      progressDates[itemId][day] ||
      ''
    );
  }


  // ============================================================
  // SUMMARY
  // ============================================================

  function renderSummary() {

    const totalItems =
      items.length;


    let totalDays = 0;
    let completedDays = 0;


    items.forEach(function (item) {

      const duration =
        Number(item.duration || 0);


      totalDays += duration;


      completedDays +=
        getProgressForItem(item.id)
          .length;

    });


    const percentage =
      totalDays > 0
        ? Math.min(
            100,
            Math.round(
              completedDays /
              totalDays *
              100
            )
          )
        : 0;


    setText(
      '#totalItems',
      totalItems
    );


    setText(
      '#completedDays',
      completedDays
    );


    setText(
      '#totalDays',
      totalDays
    );


    setText(
      '#overallProgress',
      percentage + '%'
    );


    const progressFill =
      $('#overallProgressFill');


    if (progressFill) {

      progressFill.style.width =
        percentage + '%';
    }


    // Support data attributes
    document
      .querySelectorAll(
        '[data-total-items]'
      )
      .forEach(function (el) {

        el.textContent =
          totalItems;

      });


    document
      .querySelectorAll(
        '[data-completed-days]'
      )
      .forEach(function (el) {

        el.textContent =
          completedDays;

      });


    document
      .querySelectorAll(
        '[data-total-days]'
      )
      .forEach(function (el) {

        el.textContent =
          totalDays;

      });


    document
      .querySelectorAll(
        '[data-overall-progress]'
      )
      .forEach(function (el) {

        el.textContent =
          percentage + '%';

      });
  }


  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {

    try {

      await Auth.logout();

    } catch (error) {

      console.warn(
        'Logout error:',
        error
      );

    } finally {

      redirectToLogin();
    }
  }


  // ============================================================
  // REDIRECT LOGIN
  // ============================================================

  function redirectToLogin() {

    const loginPage =
      'login.html';


    if (
      window.location.pathname
        .toLowerCase()
        .endsWith(loginPage)
    ) {

      return;
    }


    window.location.href =
      loginPage;
  }


  // ============================================================
  // LOADING
  // ============================================================

  function showLoading() {

    const loading =
      $('#loading') ||
      $('#loadingOverlay') ||
      document.querySelector(
        '[data-loading]'
      );


    if (loading) {

      loading.style.display =
        'flex';
    }
  }


  function hideLoading() {

    const loading =
      $('#loading') ||
      $('#loadingOverlay') ||
      document.querySelector(
        '[data-loading]'
      );


    if (loading) {

      loading.style.display =
        'none';
    }
  }


  // ============================================================
  // TOAST
  // ============================================================

  function showToast(
    message,
    type = 'info'
  ) {

    message =
      String(
        message ||
        'Terjadi sesuatu'
      );


    let toast =
      $('#toast');


    if (!toast) {

      toast =
        document.createElement(
          'div'
        );

      toast.id =
        'toast';


      toast.style.position =
        'fixed';

      toast.style.left =
        '50%';

      toast.style.bottom =
        '24px';

      toast.style.transform =
        'translateX(-50%)';

      toast.style.zIndex =
        '99999';

      toast.style.padding =
        '12px 18px';

      toast.style.borderRadius =
        '10px';

      toast.style.background =
        '#222';

      toast.style.color =
        '#fff';

      toast.style.fontSize =
        '14px';

      toast.style.maxWidth =
        '90%';

      toast.style.boxShadow =
        '0 5px 20px rgba(0,0,0,.25)';


      document.body.appendChild(
        toast
      );
    }


    toast.textContent =
      message;


    toast.dataset.type =
      type;


    toast.style.display =
      'block';


    clearTimeout(
      toast._timeout
    );


    toast._timeout =
      setTimeout(
        function () {

          toast.style.display =
            'none';

        },
        2500
      );
  }


  // ============================================================
  // HELPERS
  // ============================================================

  function setText(
    selector,
    value
  ) {

    const element =
      $(selector);


    if (element) {

      element.textContent =
        value;
    }
  }


  function getErrorMessage(error) {

    if (!error) {
      return 'Terjadi kesalahan';
    }


    if (
      typeof error === 'string'
    ) {

      return error;
    }


    return (
      error.message ||
      error.error ||
      'Terjadi kesalahan'
    );
  }


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


  function escapeHtml(value) {

    return String(value ?? '')
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


  function escapeJs(value) {

    return String(value ?? '')
      .replace(
        /\\/g,
        '\\\\'
      )
      .replace(
        /'/g,
        "\\'"
      )
      .replace(
        /"/g,
        '\\"'
      )
      .replace(
        /\n/g,
        '\\n'
      )
      .replace(
        /\r/g,
        '\\r'
      );
  }


  // ============================================================
  // GLOBAL
  // ============================================================

  window.AbsensiMap = {

    toggleDayCompletion:
      toggleDayCompletion,

    refreshProgress:
      refreshProgress,

    loadData:
      loadData,

    renderAll:
      renderAll

  };


  // ============================================================
  // START
  // ============================================================

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();
  }


})();
