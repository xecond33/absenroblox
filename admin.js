// ============================================================
// AbsensiMap — admin.js (Vercel Serverless Version)
// ============================================================

(async function () {
  'use strict';

  // ---- State ----
  let items = [];
  let users = [];
  
  let editingItemId = null; // null = add mode
  let confirmCallback = null;

  // ---- DOM Elements ----
  const $appContainer = document.getElementById('app-container');
  const $globalLoader = document.getElementById('global-loader');
  const $toastContainer = document.getElementById('toast-container');
  
  // Tabs
  const $tabs = document.querySelectorAll('.admin-tab');
  const $panels = document.querySelectorAll('.admin-panel');
  
  // Items Panel
  const $tableItemsBody = document.getElementById('table-items-body');
  const $btnAddItem = document.getElementById('btn-add-item');
  
  // Users Panel
  const $usersGrid = document.getElementById('users-grid');
  
  // Modals
  const $modalItem = document.getElementById('modal-item');
  const $modalItemTitle = document.getElementById('modal-item-title');
  const $formItem = document.getElementById('form-item');
  
  const $modalUser = document.getElementById('modal-user');
  const $modalUserTitle = document.getElementById('modal-user-title');
  const $tableUserProgressBody = document.getElementById('table-user-progress-body');
  
  const $modalConfirm = document.getElementById('modal-confirm');
  const $modalConfirmMsg = document.getElementById('modal-confirm-msg');
  const $modalConfirmOk = document.getElementById('modal-confirm-ok');

  // ---- Initialize ----
  async function init() {
    try {
      const user = await Auth.requireAdmin();
      if (!user) return; // redirecting
      
      setupUI();
      await loadAdminData();
      renderItems();
      renderUsers();
      
      $appContainer.style.display = '';
      $globalLoader.classList.add('hidden');
      document.body.classList.add('loaded'); // Fixed opacity issue
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('Gagal memuat admin panel.', 'error');
    }
  }

  function setupUI() {
    $tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        $tabs.forEach(t => t.classList.remove('active'));
        $panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
      });
    });

    $btnAddItem.addEventListener('click', () => openItemModal());
    $formItem.addEventListener('submit', handleItemSubmit);

    document.querySelectorAll('.modal-close, #modal-item-cancel, #modal-confirm-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) closeModal(modal);
      });
    });

    $modalConfirmOk.addEventListener('click', () => {
      closeModal($modalConfirm);
      if (confirmCallback) confirmCallback();
    });
  }

  // ---- Data Fetching ----
  async function loadAdminData() {
    // 1. Fetch Items
    const itemsRes = await fetch('/api/items');
    if (itemsRes.ok) items = await itemsRes.json();

    // 2. Fetch Users
    const usersRes = await fetch('/api/admin');
    if (usersRes.ok) {
      const data = await usersRes.json();
      users = data.users || [];
    }
  }

  // ---- Render Items Table ----
  function renderItems() {
    if (items.length === 0) {
      $tableItemsBody.innerHTML = `<tr><td colspan="5" style="text-align:center">Belum ada item absensi.</td></tr>`;
      return;
    }

    $tableItemsBody.innerHTML = items.map(item => `
      <tr>
        <td>${escHtml(item.name)}</td>
        <td>${escHtml(item.map_name)}</td>
        <td>${item.duration_days} Hari</td>
        <td>${item.required_minutes} Menit</td>
        <td class="actions-cell">
          <button class="btn-icon" onclick="AdminPanel.editItem('${item.id}')" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="AdminPanel.deleteItem('${item.id}')" title="Hapus">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // ---- Render Users Grid ----
  function renderUsers() {
    if (users.length === 0) {
      $usersGrid.innerHTML = `<div style="color:var(--text-muted)">Tidak ada pengguna ditemukan.</div>`;
      return;
    }

    $usersGrid.innerHTML = users.map(u => {
      const isAd = u.role === 'admin';
      return `
        <div class="user-card" onclick="AdminPanel.viewUserProgress('${u.id}', '${escHtml(u.username)}')">
          <div class="user-card-name">${escHtml(u.username)}</div>
          <div class="user-card-role ${isAd ? 'role-admin' : 'role-user'}">${u.role}</div>
          <div style="font-size:0.75rem; margin-top:8px; color:var(--accent-light);">Lihat Progress &rarr;</div>
        </div>
      `;
    }).join('');
  }

  // ---- Item CRUD Logic ----
  function openItemModal(itemId = null) {
    editingItemId = itemId;
    if (itemId) {
      const item = items.find(i => i.id === itemId);
      $modalItemTitle.textContent = 'Edit Item';
      document.getElementById('input-name').value = item.name;
      document.getElementById('input-map').value = item.map_name;
      document.getElementById('input-duration').value = item.duration_days;
      document.getElementById('input-minutes').value = item.required_minutes;
    } else {
      $modalItemTitle.textContent = 'Tambah Item';
      $formItem.reset();
    }
    openModal($modalItem);
  }

  async function handleItemSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('input-name').value.trim();
    const map_name = document.getElementById('input-map').value.trim();
    const duration_days = parseInt(document.getElementById('input-duration').value);
    const required_minutes = parseInt(document.getElementById('input-minutes').value);

    const payload = { name, map_name, duration_days, required_minutes };
    if (editingItemId) payload.id = editingItemId;
    
    const btn = document.getElementById('btn-save-item');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      const res = await fetch('/api/items', {
        method: editingItemId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error();
      const updatedItem = await res.json();

      if (editingItemId) {
        const idx = items.findIndex(i => i.id === editingItemId);
        if (idx > -1) items[idx] = updatedItem;
        showToast('Item berhasil diupdate.', 'success');
      } else {
        items.push(updatedItem);
        showToast('Item berhasil ditambahkan.', 'success');
      }
      
      closeModal($modalItem);
      renderItems();
    } catch (err) {
      showToast('Terjadi kesalahan.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  }

  function confirmDelete(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    $modalConfirmMsg.textContent = `Menghapus "${item.name}" akan menghapus dari daftar. Lanjutkan?`;
    confirmCallback = async () => {
      try {
        const res = await fetch(`/api/items?id=${itemId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        
        items = items.filter(i => i.id !== itemId);
        showToast('Item berhasil dihapus.', 'success');
        renderItems();
      } catch (err) {
        showToast('Gagal menghapus item.', 'error');
      }
    };
    
    openModal($modalConfirm);
  }

  // ---- View User Progress ----
  async function viewUserProgress(userId, username) {
    $modalUserTitle.textContent = `Progress: ${username}`;
    $tableUserProgressBody.innerHTML = `<tr><td colspan="3">Memuat progress...</td></tr>`;
    openModal($modalUser);

    try {
      // Fetch progress from API using admin access
      const res = await fetch(`/api/progress?userId=${userId}`);
      if (!res.ok) throw new Error();
      
      const userProgress = await res.json(); // { itemId: [1, 2, 3] }
      let html = '';
      
      items.forEach(item => {
        const checkedDays = userProgress[item.id] || [];
        const completedCount = checkedDays.length;
        const pct = Math.round((completedCount / item.duration_days) * 100);
        let status = completedCount === 0 ? 'idle' : (completedCount >= item.duration_days ? 'done' : 'running');
        let statusLabel = status === 'idle' ? 'Belum Mulai' : (status === 'done' ? 'Selesai' : 'Berjalan');
        
        html += `
          <tr>
            <td>${escHtml(item.name)}</td>
            <td>
              <span class="card-status status-${status}">
                <span class="status-dot"></span> ${statusLabel}
              </span>
            </td>
            <td>
              <div style="font-size:0.8rem; font-weight:600; margin-bottom:4px;">${completedCount} / ${item.duration_days} (${pct}%)</div>
              <div class="progress-bar" style="height:4px; width:100px;">
                <div class="progress-fill ${status === 'done' ? 'complete' : ''}" style="width:${pct}%"></div>
              </div>
            </td>
          </tr>
        `;
      });
      
      $tableUserProgressBody.innerHTML = html;
      
      // Add reset button
      $tableUserProgressBody.innerHTML += `
        <tr>
          <td colspan="3" style="text-align:right;">
            <button class="btn btn-danger btn-sm" onclick="AdminPanel.resetProgress('${userId}', '${escHtml(username)}')">Reset Progress User Ini</button>
          </td>
        </tr>
      `;

    } catch (e) {
      $tableUserProgressBody.innerHTML = `<tr><td colspan="3">Gagal memuat progress.</td></tr>`;
    }
  }

  function resetProgress(userId, username) {
    $modalConfirmMsg.textContent = `Yakin mereset seluruh progress milik ${username}? Semua centang harinya akan kembali 0.`;
    confirmCallback = async () => {
      try {
        const res = await fetch(`/api/admin?userId=${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        
        showToast('Progress berhasil di-reset.', 'success');
        closeModal($modalUser);
      } catch (err) {
        showToast('Gagal mereset progress.', 'error');
      }
    };
    
    openModal($modalConfirm);
  }

  // ---- Helpers ----
  function openModal(el) {
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeModal(el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

  // Expose to global for inline onclick
  window.AdminPanel = {
    editItem: openItemModal,
    deleteItem: confirmDelete,
    viewUserProgress: viewUserProgress,
    resetProgress: resetProgress
  };

  // ---- Bootstrap ----
  document.addEventListener('DOMContentLoaded', init);

})();
