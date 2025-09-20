import { Router } from 'express';
import { supabase, getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();

// GET /medications
router.get('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const { active, category } = req.query;
  let query = supabase.from('medications').select('*').eq('user_id', user.id);
  if (active !== undefined) query = query.eq('is_active', String(active) === 'true');
  if (category) query = query.eq('category', category);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  return res.json({ medications: data });
});

// POST /medications
router.post('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const body = req.body || {};
  const payload = {
    user_id: user.id,
    name: body.name,
    dosage: body.dosage,
    frequency: body.frequency,
    instructions: body.instructions,
    category: body.category,
    start_date: body.startDate || new Date().toISOString().slice(0,10),
    end_date: body.endDate || null,
    reminder_times: body.reminderTimes || [],
    refill_reminder: body.refillReminder ?? false,
    side_effects: body.sideEffects || [],
    interactions: body.interactions || [],
    is_active: true,
  };

  const { data, error } = await supabase.from('medications').insert(payload).select().single();
  if (error) return res.status(400).json({ error: 'validation_error', message: error.message });

  return res.status(201).json(data);
});

// GET /medications/for-user?userId=...
router.get('/for-user', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const targetUserId = req.query.userId || user.id;
  const isDev = process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_MODE !== 'false';
  if (!isDev && targetUserId !== user.id) {
    return res.status(403).json({ error: 'forbidden', message: 'You can only view your own medications' });
  }

  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json({ medications: data || [] });
});

// POST /medications/for-user
// Create a medication for a specific user ID (defaults to current user)
router.post('/for-user', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const body = req.body || {};
  const targetUserId = body.userId || user.id;

  // In production, only allow creating for self unless explicitly permitted (dev bypass otherwise)
  const isDev = process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_MODE !== 'false';
  if (!isDev && targetUserId !== user.id) {
    return res.status(403).json({ error: 'forbidden', message: 'You can only add medications for your own account' });
  }

  if (!body.name) return res.status(400).json({ error: 'validation_error', message: 'name is required' });

  // Coerce reminderTimes: accept string like "08:00, 20:00" or array
  let reminderTimes = body.reminderTimes;
  if (typeof reminderTimes === 'string') {
    reminderTimes = reminderTimes.split(',').map((t) => String(t).trim()).filter(Boolean);
  }
  if (!Array.isArray(reminderTimes)) reminderTimes = [];

  const payload = {
    user_id: targetUserId,
    name: body.name,
    dosage: body.dosage,
    frequency: body.frequency || null,
    instructions: body.instructions || null,
    category: body.category || null,
    start_date: body.startDate || new Date().toISOString().slice(0,10),
    end_date: body.endDate || null,
    reminder_times: reminderTimes,
    refill_reminder: body.refillReminder ?? false,
    side_effects: Array.isArray(body.sideEffects) ? body.sideEffects : [],
    interactions: Array.isArray(body.interactions) ? body.interactions : [],
    is_active: true,
  };

  const { data, error } = await supabase.from('medications').insert(payload).select().single();
  if (error) return res.status(400).json({ error: 'validation_error', message: error.message, details: { payload } });

  return res.status(201).json(data);
});

// PUT /medications/:id
router.put('/:id', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const id = req.params.id;
  const updates = req.body || {};

  const map = {
    dosage: 'dosage',
    frequency: 'frequency',
    reminderTimes: 'reminder_times',
    endDate: 'end_date',
    startDate: 'start_date',
    instructions: 'instructions',
    category: 'category',
    name: 'name',
  };
  const payload = {};
  Object.entries(map).forEach(([key, col]) => {
    if (key in updates) payload[col] = updates[key];
  });

  const { data, error } = await supabase
    .from('medications')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  return res.json(data);
});

// DELETE /medications/:id (soft)
router.delete('/:id', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const id = req.params.id;
  const { error } = await supabase
    .from('medications')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.status(204).send();
});

// POST /medications/:id/doses
router.post('/:id/doses', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;
  const { takenAt, notes } = req.body || {};
  const { data, error } = await supabase.from('doses').insert({ medication_id: id, user_id: user.id, taken_at: takenAt, notes }).select().single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.status(201).json(data);
});

// GET /medications/:id/adherence?period=month
router.get('/:id/adherence', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;
  const { period = 'month' } = req.query;

  const end = new Date();
  const start = new Date(end);
  const map = { week: 7, month: 30, quarter: 90, year: 365 };
  start.setDate(end.getDate() - (map[period] || 30));

  const { data: doses, error } = await supabase
    .from('doses')
    .select('*')
    .eq('user_id', user.id)
    .eq('medication_id', id)
    .gte('taken_at', start.toISOString())
    .lte('taken_at', end.toISOString());
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  // naive adherence approximation: doses taken / expected once-daily doses
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const totalDoses = totalDays; // once daily assumption
  const takenDoses = doses.length;
  const adherenceRate = totalDoses ? takenDoses / totalDoses : 0;

  return res.json({ medicationId: id, period, adherenceRate, totalDoses, takenDoses, missedDoses: Math.max(0, totalDoses - takenDoses), onTimeDoses: takenDoses, lateDoses: 0, trends: { improvingAdherence: null, consistentTiming: null } });
});

export default router;
