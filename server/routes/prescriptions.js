import { Router } from 'express';
import multer from 'multer';
import { supabase, supabaseAdmin, supabaseForToken, getUserFromAuthHeader } from '../lib/supabase.js';
import { performOCR } from '../lib/ocr.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /prescriptions/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const { user, error: authError, token } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'file is required' });

  const notes = req.body?.notes || null;
  const fileExt = req.file.originalname.split('.').pop();
  const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  // Ensure bucket exists (admin only)
  if (supabaseAdmin) {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = (buckets || []).some((b) => b.name === 'prescriptions');
      if (!exists) {
        await supabaseAdmin.storage.createBucket('prescriptions', { public: true });
      }
    } catch (e) {
      // continue; we'll surface errors on upload
    }
  }

  // Upload to Supabase Storage bucket 'prescriptions'
  let storageRes, storageErr;
  if (supabaseAdmin) {
    ({ data: storageRes, error: storageErr } = await supabaseAdmin.storage
      .from('prescriptions')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false }));
  } else {
    ({ data: storageRes, error: storageErr } = await supabase.storage
      .from('prescriptions')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false }));
  }
  if (storageErr) return res.status(400).json({ error: 'bad_request', message: storageErr.message });

  const { data: urlData } = (supabaseAdmin || supabase).storage.from('prescriptions').getPublicUrl(storageRes.path);
  const fileUrl = urlData?.publicUrl;

  // Perform OCR on the image
  let ocrText = '';
  let ocrError = null;
  try {
    ocrText = await performOCR(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (e) {
    console.error('[prescriptions/upload] OCR failed:', e);
    ocrError = e.message;
  }

  const extractedData = {
    fullText: ocrText,
    patientName: null, // You can add more sophisticated parsing logic here later
    doctorName: null,
    pharmacy: null,
    date: new Date().toISOString().slice(0, 10),
    medications: [],
    notes,
  };

  const payload = {
    user_id: user.id,
    file_name: req.file.originalname,
    file_url: fileUrl,
    status: ocrText ? 'approved' : 'processing', // Move to approved if OCR has text, otherwise stays in processing
    extracted_data: extractedData,
    confidence: 0.5,
    warnings: ocrError ? [{ type: 'ocr_error', message: ocrError }] : [],
    upload_date: new Date().toISOString(),
  };

  let data, error;
  if (token) {
    try {
      const client = supabaseForToken(token);
      ({ data, error } = await client.from('prescriptions').insert(payload).select().single());
    } catch (e) {
      console.warn('[prescriptions/upload] user insert threw; will try admin fallback');
    }
  }
  if (!data) {
    // Dev-bypass or user insert failed: use admin client if available
    if (supabaseAdmin) {
      const { data: adminData, error: adminErr } = await supabaseAdmin.from('prescriptions').insert(payload).select().single();
      if (adminErr) {
        console.error('[prescriptions/upload] admin insert error', adminErr);
        return res.status(400).json({ error: 'bad_request', message: adminErr.message || 'Failed to save prescription' });
      }
      data = adminData;
    } else if (error) {
      return res.status(400).json({ error: 'bad_request', message: error.message || 'Failed to save prescription. Check RLS policies and auth.' });
    } else {
      return res.status(400).json({ error: 'bad_request', message: 'Failed to save prescription and no admin client available' });
    }
  }

  return res.json({ prescriptionId: data.id, status: data.status, extractedData: data.extracted_data, confidence: data.confidence, warnings: data.warnings });
});

// GET /prescriptions
router.get('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const status = req.query.status;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('prescriptions').select('*', { count: 'exact' }).eq('user_id', user.id);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query.order('upload_date', { ascending: false }).range(from, to);
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });

  const totalPages = Math.ceil((count || 0) / limit) || 1;
  return res.json({
    prescriptions: data?.map((p) => ({
      id: p.id,
      uploadDate: p.upload_date,
      status: p.status,
      doctorName: p.extracted_data?.doctorName || null,
      pharmacy: p.extracted_data?.pharmacy || null,
      medicationCount: p.extracted_data?.medications?.length || 0,
      totalCost: null,
    })) || [],
    pagination: { currentPage: page, totalPages, totalItems: count || 0 },
  });
});

// PUT /prescriptions/:id/approve
router.put('/:id/approve', async (req, res) => {
  const { user, error: authError, token } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;
  const { medications = [] } = req.body || {};

  // Mark prescription approved and optionally create medications rows
  const client = supabaseForToken(token);
  const { data: p, error: upErr } = await client
    .from('prescriptions')
    .update({ status: 'approved', approved_date: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (upErr) return res.status(400).json({ error: 'bad_request', message: upErr.message });

  if (Array.isArray(medications) && medications.length > 0) {
    const rows = medications.filter(m => m.approved).map(m => ({
      user_id: user.id,
      name: m.name || m.id || 'Unknown',
      dosage: m.dosage || null,
      frequency: m.frequency || null,
      instructions: m.instructions || null,
      category: 'prescription',
      start_date: new Date().toISOString().slice(0,10),
      refills_remaining: m.refills ?? null,
      is_active: true,
    }));
    if (rows.length) {
      const { error: insErr, count } = await client.from('medications').insert(rows, { count: 'exact' });
      if (insErr) return res.status(400).json({ error: 'bad_request', message: insErr.message });
    }
  }

  return res.json({ success: true, prescriptionId: id });
});

export default router;
