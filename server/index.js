import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import medicationRoutes from './routes/medications.js';
import prescriptionRoutes from './routes/prescriptions.js';
import careCircleRoutes from './routes/careCircle.js';
import notificationRoutes from './routes/notifications.js';
import assistantRoutes from './routes/assistant.js';
import analyticsRoutes from './routes/analytics.js';
import reportsRoutes from './routes/reports.js';
import healthRoutes from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/medications', medicationRoutes);
app.use('/prescriptions', prescriptionRoutes);
app.use('/care-circle', careCircleRoutes);
app.use('/notifications', notificationRoutes);
app.use('/assistant', assistantRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/reports', reportsRoutes);
app.use('/health', healthRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Resource not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
