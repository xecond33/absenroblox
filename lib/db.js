const { kv } = require('@vercel/kv');
const cookie = require('cookie');

// Helper to get session from request
async function getSession(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies.absensi_session;

  if (!sessionId) return null;

  const session = await kv.get(`session:${sessionId}`);
  return session; // Returns { id: 'user_001', role: 'admin', username: '...' }
}

// Helper to get user progress
async function getUserProgress(userId) {
  // We can store progress as a hash or separate keys.
  // Storing as one object per user is easiest for simple reads.
  // Key: progress:<user_id> -> { "item_id": [1, 2, 3] }
  const progress = await kv.get(`progress:${userId}`);
  return progress || {};
}

module.exports = {
  kv,
  getSession,
  getUserProgress
};
