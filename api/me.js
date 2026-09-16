const { getSession } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getSession(req);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ user: session });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
