import { Router } from 'express';
import { supabase, getUserFromAuthHeader } from '../lib/supabase.js';
import { getTwilio, getTwilioFromNumber } from '../lib/twilio.js';

const router = Router();
const devIntervals = new Map(); // key: user.id -> NodeJS.Timer

// GET /notifications
router.get('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const { type, read } = req.query;
  let query = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  if (read !== undefined) query = query.eq('read', String(read) === 'true');
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json({ notifications: data });
});

// PUT /notifications/:id/read
router.put('/:id/read', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json({ success: true });
});

// POST /notifications/preferences
router.post('/preferences', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const prefs = req.body || {};
  const { data, error } = await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id).select().single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json({ preferences: data.preferences });
});

// POST /notifications/meds/now
// Sends an SMS to all care circle members with phone numbers about upcoming medications
router.post('/meds/now', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const twilio = getTwilio();
  const from = getTwilioFromNumber();
  if (!twilio || !from) {
    return res.status(400).json({ error: 'bad_request', message: 'Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)' });
  }

  // Load user's active medications
  const { data: meds, error: medsErr } = await supabase
    .from('medications')
    .select('name, dosage, reminder_times, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);
  if (medsErr) return res.status(400).json({ error: 'bad_request', message: medsErr.message });

  // Compute upcoming within next 120 minutes based on reminder_times (HH:MM format)
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const windowMin = 120;
  const upcoming = [];
  for (const m of meds || []) {
    const times = Array.isArray(m.reminder_times) ? m.reminder_times : [];
    for (const t of times) {
      const [hh, mm] = String(t).split(':').map((x) => parseInt(x, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const mins = hh * 60 + mm;
        const diff = mins - nowMin;
        if (diff >= 0 && diff <= windowMin) {
          upcoming.push({ name: m.name, dosage: m.dosage, time: t });
        }
      }
    }
  }

  if (upcoming.length === 0) {
    return res.json({ sent: 0, message: 'No upcoming medications within next 2 hours' });
  }

  // Load care circle members with phone numbers
  const { data: members, error: memErr } = await supabase
    .from('care_circle_members')
    .select('name, phone, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'accepted', 'active', 'member']);
  if (memErr) return res.status(400).json({ error: 'bad_request', message: memErr.message });

  const targets = (members || []).filter((m) => (m.phone || '').trim());
  if (targets.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'No care circle members with phone numbers' });
  }

  const lines = upcoming.map((u) => `• ${u.name}${u.dosage ? ` (${u.dosage})` : ''} at ${u.time}`);
  const body = `Medication Reminder\nNext 2 hrs:\n${lines.join('\n')}`;

  let sent = 0;
  const errors = [];
  await Promise.all(targets.map(async (t) => {
    try {
      await twilio.messages.create({ from, to: t.phone, body });
      sent += 1;
    } catch (e) {
      errors.push({ to: t.phone, error: e?.message || String(e) });
    }
  }));

  return res.json({ sent, attempted: targets.length, upcoming: upcoming.length, errors });
});

async function sendCustomSMS({ userId, phone, meds }) {
  const twilio = getTwilio();
  const from = getTwilioFromNumber();
  if (!twilio || !from) throw new Error('Twilio not configured');
  const lines = (Array.isArray(meds) ? meds : []).map((m) => `• ${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.time ? ` at ${m.time}` : ''}`);
  const body = `Medication Reminder\n${lines.length ? lines.join('\n') : 'New medications added'}`;
  await twilio.messages.create({ from, to: phone, body });
  return { sent: 1 };
}

// POST /notifications/send { phone, meds: [{name,dosage,time}] }
router.post('/send', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { phone, meds } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'validation_error', message: 'phone is required' });
  try {
    const r = await sendCustomSMS({ userId: user.id, phone, meds });
    return res.json({ success: true, ...r });
  } catch (e) {
    return res.status(400).json({ error: 'bad_request', message: e?.message || 'Failed to send SMS' });
  }
});

// POST /notifications/dev/start { phone, meds }
router.post('/dev/start', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { phone, meds } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'validation_error', message: 'phone is required' });
  // Clear any existing
  const existing = devIntervals.get(user.id);
  if (existing) clearInterval(existing);
  const interval = setInterval(() => {
    sendCustomSMS({ userId: user.id, phone, meds }).catch((e) => console.warn('[dev/start] SMS failed:', e?.message || e));
  }, 2 * 60 * 1000); // every 2 min
  devIntervals.set(user.id, interval);
  return res.json({ success: true, message: 'Dev auto SMS started (2 min interval)' });
});

// POST /notifications/dev/stop
router.post('/dev/stop', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const existing = devIntervals.get(user.id);
  if (existing) {
    clearInterval(existing);
    devIntervals.delete(user.id);
    return res.json({ success: true, message: 'Dev auto SMS stopped' });
  }
  return res.json({ success: true, message: 'No active auto SMS' });
});

export default router;
