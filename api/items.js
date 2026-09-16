const { getSession, kv } = require('../../lib/db');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_ITEMS = [
  { id: uuidv4(), name: '404', duration_days: 30, map_name: '404 Map', required_minutes: 30 },
  { id: uuidv4(), name: '90s blok', duration_days: 30, map_name: '90s Block', required_minutes: 45 },
  { id: uuidv4(), name: 'flux', duration_days: 30, map_name: 'Flux Map', required_minutes: 30 },
  { id: uuidv4(), name: 'lawson', duration_days: 30, map_name: 'Lawson Map', required_minutes: 60 },
  { id: uuidv4(), name: 'la miami', duration_days: 30, map_name: 'La Miami Map', required_minutes: 30 },
  { id: uuidv4(), name: 'noir pulse', duration_days: 30, map_name: 'Noir Pulse Map', required_minutes: 30 }
];

module.exports = async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: Read all items (Allowed for all authenticated users)
  if (req.method === 'GET') {
    try {
      let items = await kv.get('items');
      
      // Auto-seed if empty
      if (!items) {
        items = DEFAULT_ITEMS;
        await kv.set('items', items);
      }
      
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  // POST, PUT, DELETE: Admin only
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }

  let items = await kv.get('items') || [];

  try {
    if (req.method === 'POST') {
      // Create new item
      const { name, duration_days, map_name, required_minutes } = req.body;
      const newItem = {
        id: uuidv4(),
        name,
        duration_days: parseInt(duration_days),
        map_name,
        required_minutes: parseInt(required_minutes)
      };
      items.push(newItem);
      await kv.set('items', items);
      return res.status(201).json(newItem);
    }

    if (req.method === 'PUT') {
      // Update item
      const { id, name, duration_days, map_name, required_minutes } = req.body;
      const index = items.findIndex(i => i.id === id);
      if (index === -1) return res.status(404).json({ error: 'Item not found' });

      items[index] = {
        id,
        name,
        duration_days: parseInt(duration_days),
        map_name,
        required_minutes: parseInt(required_minutes)
      };
      await kv.set('items', items);
      return res.status(200).json(items[index]);
    }

    if (req.method === 'DELETE') {
      // Delete item
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Item ID required' });
      
      items = items.filter(i => i.id !== id);
      await kv.set('items', items);
      return res.status(200).json({ message: 'Item deleted' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Items API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
