const cookie = require('cookie');
const { kv } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies.absensi_session;

  if (sessionId) {
    await kv.del(`session:${sessionId}`);
  }

  // Clear cookie
  res.setHeader('Set-Cookie', cookie.serialize('absensi_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: -1,
    path: '/'
  }));

  return res.status(200).json({ message: 'Logout berhasil' });
};
