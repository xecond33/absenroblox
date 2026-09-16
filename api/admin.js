const { getSession, kv } = require('../../lib/db');

module.exports = async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  // Scan or get all user keys (Caution: SCAN in Redis can be tricky via REST KV, 
  // but `@vercel/kv` provides `scan` or `keys`). Let's use `keys` for simplicity 
  // since the user base is assumed small.
  
  if (req.method === 'GET') {
    try {
      // Get all user keys matching pattern "user:*"
      const userKeys = await kv.keys('user:*');
      const users = [];

      if (userKeys.length > 0) {
        // MGET all users
        const usersData = await kv.mget(...userKeys);
        usersData.forEach(u => {
          if (u) {
            // Strip passwordHash before sending to client
            delete u.passwordHash;
            users.push(u);
          }
        });
      }

      // We might also want to return all progress, or fetch progress per user on demand.
      // Let's send users. The frontend will fetch progress for a specific user using /api/progress?userId=...
      return res.status(200).json({ users });
    } catch (error) {
      console.error('Admin API error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // DELETE: Reset progress for a specific user or oneself
  if (req.method === 'DELETE') {
    const userId = req.query.userId;
    // Allow self-reset or admin-reset
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    if (userId !== session.id && session.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden to reset other users' });
    }

    try {
      await kv.del(`progress:${userId}`);
      return res.status(200).json({ message: 'Progress reset successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to reset progress' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
