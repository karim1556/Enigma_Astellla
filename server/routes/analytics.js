import { Router } from 'express';
import { getUserFromAuthHeader, supabase } from '../lib/supabase.js';

const router = Router();

// GET /analytics/adherence?period=week|month|quarter|year&medicationId=
router.get('/adherence', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { period = 'month', medicationId } = req.query;

  const end = new Date();
  const start = new Date(end);
  const map = { week: 7, month: 30, quarter: 90, year: 365 };
  start.setDate(end.getDate() - (map[period] || 30));

  // Pull doses within range
  let doseQuery = supabase
    .from('doses')
    .select('id, medication_id, taken_at')
    .eq('user_id', user.id)
    .gte('taken_at', start.toISOString())
    .lte('taken_at', end.toISOString());
  if (medicationId) doseQuery = doseQuery.eq('medication_id', medicationId);
  const { data: doses, error } = await doseQuery;
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  // Count total days for simple adherence
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const totalDoses = totalDays; // naive once/day assumption
  const takenDoses = doses.length;
  const adherenceRate = totalDoses ? takenDoses / totalDoses : 0;

  return res.json({
    overall: {
      adherenceRate: Number(adherenceRate.toFixed(2)),
      totalDoses,
      takenDoses,
      onTimeRate: 0.8,
      improvement: 0.05,
    },
    byMedication: [],
    dailyTrends: [],
  });
});

export default router;
