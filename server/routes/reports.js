import { Router } from 'express';
import { getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();

// In-memory store per user for demo purposes
const STORE = new Map();

function ensureUserStore(userId) {
  if (!STORE.has(userId)) STORE.set(userId, []);
  return STORE.get(userId);
}

// GET /reports
router.get('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const arr = ensureUserStore(user.id);
  return res.json({ reports: arr });
});

// GET /reports/generate?format=pdf&period=last_30_days
router.get('/generate', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { format = 'pdf', period = 'last_30_days', includeAdherence = 'true', includeMedications = 'true' } = req.query;
  const report = {
    id: crypto.randomUUID(),
    title: 'Adherence Report',
    description: 'Generated report',
    date: new Date().toISOString(),
    type: 'Adherence',
    status: 'Ready',
    size: '1.0 MB',
    format,
    period,
    includeAdherence: includeAdherence === 'true',
    includeMedications: includeMedications === 'true',
    downloadUrl: `https://example.com/reports/${user.id}/${Date.now()}.${format}`,
  };
  const arr = ensureUserStore(user.id);
  arr.unshift(report);
  return res.json({ reportId: report.id, downloadUrl: report.downloadUrl, expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString(), format });
});

export default router;
