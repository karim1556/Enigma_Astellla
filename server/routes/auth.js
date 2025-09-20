import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'validation_error', message: 'email and password are required' });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { firstName, lastName, dateOfBirth, phone },
    },
  });
  if (error) return res.status(400).json({ error: 'validation_error', message: error.message });

  const user = data.user;
  // Create profile row
  if (user) {
    await supabase.from('profiles').insert({ id: user.id, email, first_name: firstName, last_name: lastName, phone, date_of_birth: dateOfBirth }).select();
  }

  return res.status(201).json({
    user: {
      id: user?.id,
      email: user?.email,
      firstName,
      lastName,
      createdAt: user?.created_at,
    },
    token: data.session?.access_token || null,
  });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'validation_error', message: 'email and password are required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'unauthorized', message: error.message });

  const { user, session } = data;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.user_metadata?.firstName || null,
      lastName: user.user_metadata?.lastName || null,
    },
    token: session?.access_token,
  });
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json({ message: 'Successfully logged out' });
});

export default router;
