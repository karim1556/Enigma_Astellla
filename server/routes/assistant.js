import { Router } from 'express';
import { getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();

// In a real app you'd persist interactions in DB. For now, use in-memory store per-process.
const MEMORY = new Map(); // key: userId, value: array of interactions

// POST /assistant/chat
router.post('/chat', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { message, context } = req.body || {};
  if (!message) return res.status(400).json({ error: 'validation_error', message: 'message is required' });

  const response = {
    response: `This is a placeholder response about: ${message}`,
    confidence: 0.9,
    sources: [{ type: 'medical_database', title: 'Drug Information Database', url: 'https://example.com/drug-info' }],
    followUpQuestions: [
      'Are you experiencing any side effects?',
      'Would you like to set a reminder?'
    ],
    disclaimer: 'This information is for educational purposes only.'
  };

  const item = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userMessage: message,
    assistantResponse: response.response,
    topic: 'general',
  };
  const arr = MEMORY.get(user.id) || [];
  arr.unshift(item);
  MEMORY.set(user.id, arr);

  return res.json(response);
});

// GET /assistant/interactions
router.get('/interactions', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const arr = MEMORY.get(user.id) || [];
  return res.json({ interactions: arr });
});

export default router;
