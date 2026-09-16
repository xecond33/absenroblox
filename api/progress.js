const { getSession, getUserProgress, kv } = require('../../lib/db');

module.exports = async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: Fetch progress for a user
  if (req.method === 'GET') {
    // If not admin, you can only request your own progress
    const queryUserId = req.query.userId || session.id;
    
    if (queryUserId !== session.id && session.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Cannot view other users progress.' });
    }

    try {
      const progress = await getUserProgress(queryUserId);
      return res.status(200).json(progress);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }
  }

  // POST: Toggle day completion
  if (req.method === 'POST') {
    const { itemId, dayNumber, completed } = req.body;
    
    if (!itemId || !dayNumber) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
      // Users can only update their own progress
      const userId = session.id;
      const progressKey = `progress:${userId}`;
      let progress = await getUserProgress(userId); // returns object { itemId: [days...] }
      
      if (!progress[itemId]) {
        progress[itemId] = [];
      }

      const dayInt = parseInt(dayNumber);
      
      if (completed) {
        // Add day if not exists
        if (!progress[itemId].includes(dayInt)) {
          progress[itemId].push(dayInt);
          progress[itemId].sort((a, b) => a - b); // Keep it sorted
        }
      } else {
        // Remove day
        progress[itemId] = progress[itemId].filter(d => d !== dayInt);
      }

      await kv.set(progressKey, progress);
      return res.status(200).json({ message: 'Progress updated', progress: progress[itemId] });

    } catch (error) {
      console.error('Progress update error:', error);
      return res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
