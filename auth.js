// ============================================================
// AbsensiMap — auth.js (Vercel Serverless Version)
// ============================================================

const Auth = (() => {
  'use strict';

  // State
  let currentUser = null;

  async function getSession() {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) return null;
      const data = await res.json();
      currentUser = data.user;
      return data.user;
    } catch (e) {
      return null;
    }
  }

  async function getUser() {
    if (currentUser) return currentUser;
    return await getSession();
  }

  async function getProfile() {
    return await getUser(); // user data already includes role
  }

  async function register(email, password, username) {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error } };
      return { data };
    } catch (e) {
      return { error: { message: 'Koneksi gagal.' } };
    }
  }

  async function login(email, password) {
    try {
      // we use email field for username in our new register logic 
      // but let's assume the user typed username in the email field 
      // or we just call the field 'email' but it expects username
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error } };
      currentUser = data.user;
      return { data };
    } catch (e) {
      return { error: { message: 'Koneksi gagal.' } };
    }
  }

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
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
