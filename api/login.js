const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { v4: uuidv4 } = require('uuid');
const { kv } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  try {
    const userKey = `user:${username.toLowerCase()}`;
    const user = await kv.get(userKey);

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Create session
    const sessionId = uuidv4();
    
    // Store session in KV with expiration (e.g., 30 days)
    const sessionData = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    await kv.set(`session:${sessionId}`, sessionData, { ex: 30 * 24 * 60 * 60 });

    // Set cookie
    res.setHeader('Set-Cookie', cookie.serialize('absensi_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/'
    }));

    return res.status(200).json({ 
      message: 'Login berhasil',
      user: sessionData
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};
