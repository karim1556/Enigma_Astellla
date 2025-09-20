import { Router } from 'express';
import { supabase, getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();

// GET /users/profile
router.get('/profile', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  // Ensure a profile row exists for this user; create minimal row if missing
  const upsert = {
    id: user.id,
    email: user.email || null,
    first_name: null,
    last_name: null,
    updated_at: new Date().toISOString(),
  };
  const { data: ensured, error: upsertErr } = await supabase
    .from('profiles')
    .upsert(upsert, { onConflict: 'id' })
    .select()
    .single();
  if (upsertErr) return res.status(400).json({ error: 'bad_request', message: upsertErr.message });

  const profile = ensured || {};
  return res.json({
    id: user.id,
    email: profile.email || user.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    dateOfBirth: profile.date_of_birth,
    phone: profile.phone,
    emergencyContact: profile.emergency_contact || null,
    preferences: profile.preferences || {},
  });
});

// PUT /users/profile
router.put('/profile', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const { firstName, lastName, phone, emergencyContact } = req.body || {};
  const update = {
    first_name: firstName,
    last_name: lastName,
    phone,
    emergency_contact: emergencyContact,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('profiles').upsert({ id: user.id, ...update }).select().single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  return res.json({ success: true, profile: data });
});

export default router;
