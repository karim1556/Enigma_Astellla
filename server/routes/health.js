import { Router } from 'express';
import { supabase, supabaseAdmin, supabaseForToken, getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();

// Default empty profile shape
function emptyProfile(userId) {
  return {
    user_id: userId,
    conditions: [], // past/ongoing problems
    allergies: [],
    current_meds: [], // [{name, dosage, frequency, started_on}]
    surgeries: [], // [{name, date, notes}]
    lifestyle: { smoking: null, alcohol: null, activityLevel: null, diet: null },
    vitals: { height_cm: null, weight_kg: null, bp: null, blood_sugar: null },
    family_history: [], // e.g., [{condition, relative}]
    notes: null,
    updated_at: new Date().toISOString(),
  };
}

// GET /health/profile
router.get('/profile', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const { data, error } = await supabase
    .from('health_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = No rows found
    return res.status(400).json({ error: 'bad_request', message: error.message });
  }

  return res.json({ profile: data || emptyProfile(user.id) });
});

// PUT /health/profile (upsert)
router.put('/profile', async (req, res) => {
  const { user, error: authError, token } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const input = req.body || {};
  // Coerce arrays for conditions and allergies if client sent string
  const toArray = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  input.conditions = toArray(input.conditions);
  input.allergies = toArray(input.allergies);
  if (!Array.isArray(input.current_meds)) input.current_meds = [];
  if (!Array.isArray(input.surgeries)) input.surgeries = [];
  if (typeof input.family_history === 'string') input.family_history = input.family_history.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const payload = {
    ...emptyProfile(user.id),
    ...input,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  // Try with user token if present, else admin
  let row;
  try {
    if (token) {
      const client = supabaseForToken(token);
      const up = await client.from('health_profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
      if (!up.error) row = up.data;
    }
  } catch {}

  if (!row) {
    if (!supabaseAdmin) return res.status(400).json({ error: 'bad_request', message: 'Failed to save profile and no admin client available' });
    const { data, error } = await supabaseAdmin.from('health_profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
    if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
    row = data;
  }

  return res.json({ profile: row });
});

export default router;
