const bcrypt = require('bcryptjs');
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

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username min 3 karakter, password min 6 karakter.' });
  }

  try {
    const userKey = `user:${username.toLowerCase()}`;
    const existingUser = await kv.get(userKey);

    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan.' });
    }

    // Check if this is the very first user. If so, make them admin.
    const usersCount = await kv.dbsize(); // Simple heuristic, or we can check a specific counter.
    // A better approach is maintaining a metadata key, but let's check a dedicated "has_admin" flag.
    const hasAdmin = await kv.get('system:has_admin');
    
    let role = 'user';
    if (!hasAdmin) {
      role = 'admin';
      await kv.set('system:has_admin', true);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const userId = `user_${uuidv4().substring(0, 8)}`; // Generate short unique ID

    const userData = {
      id: userId,
      username,
      passwordHash: hash,
      role,
      createdAt: new Date().toISOString()
    };

    // Store user
    await kv.set(userKey, userData);
    
    // Also store mapping from ID to username for easy lookup later if needed
    await kv.set(`userid:${userId}`, username.toLowerCase());

    return res.status(200).json({ 
      message: 'Registrasi berhasil',
      user: { id: userId, username, role }
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};
