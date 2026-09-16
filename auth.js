// ============================================================
// AbsensiMap — auth.js (Apps Script Version)
// ============================================================

const Auth = (() => {
  'use strict';

  // !!! GANTI URL DI BAWAH INI DENGAN URL WEB APP APPS SCRIPT-MU !!!
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwkeuf1IomPg4Y-kYyNVG1m0nTzEodB8k3Bx5UXNxgRC05Gc5yuOJIEzsEtQkNI42d7/exec';

  let currentUser = null;

  async function apiFetch(action, params = {}) {
    const token = localStorage.getItem('absensi_token');
    const payload = { action, ...params };
    if (token) payload.token = token;

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        // GAS Web App allows POST with text/plain to avoid preflight issues
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status && data.status >= 400) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  async function getSession() {
    try {
      if (!localStorage.getItem('absensi_token')) return null;
      const data = await apiFetch('me');
      currentUser = data.user;
      return data.user;
    } catch (e) {
      localStorage.removeItem('absensi_token');
      return null;
    }
  }

  async function getUser() {
    if (currentUser) return currentUser;
    return await getSession();
  }

  async function getProfile() {
    return await getUser();
  }

  async function register(username, password) {
    try {
      const data = await apiFetch('register', { username, password });
      return { data };
    } catch (err) {
      return { error: { message: err.message || 'Registrasi gagal.' } };
    }
  }

  async function login(username, password) {
    try {
      const data = await apiFetch('login', { username, password });
      localStorage.setItem('absensi_token', data.token);
      currentUser = data.user;
      return { data };
    } catch (err) {
      return { error: { message: err.message || 'Login gagal.' } };
    }
  }

  async function logout() {
    try {
      await apiFetch('logout');
    } catch (e) { }
    localStorage.removeItem('absensi_token');
    currentUser = null;
    window.location.href = 'login.html';
  }

  async function isAdmin() {
    const user = await getUser();
    return user?.role === 'admin';
  }

  async function requireAuth() {
    const user = await getSession();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    return user;
  }

  async function requireAdmin() {
    const user = await requireAuth();
    if (!user) return null;
    if (user.role !== 'admin') {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  }

  async function redirectIfAuthenticated() {
    const user = await getSession();
    if (user) {
      window.location.href = 'index.html';
      return true;
    }
    return false;
  }

  return {
    apiFetch,
    getSession,
    getUser,
    getProfile,
    register,
    login,
    logout,
    isAdmin,
    requireAuth,
    requireAdmin,
    redirectIfAuthenticated
  };
})();
