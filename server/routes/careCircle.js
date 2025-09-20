import { Router } from 'express';
import { supabase, getUserFromAuthHeader } from '../lib/supabase.js';

const router = Router();
const preferSupabase = (process.env.CARE_CIRCLE_MODE || '').toLowerCase() === 'supabase';

// If CLERK is configured, use Clerk Orgs; otherwise fall back to Supabase table
const useClerk = !!process.env.CLERK_SECRET_KEY;
let clerk = null;
if (useClerk) {
  try {
    const { Clerk } = await import('@clerk/clerk-sdk-node');
    clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
  } catch (e) {
    console.warn('[care-circle] Failed to initialize Clerk SDK, falling back to Supabase table.', e?.message);
  }
}

async function getOrCreateOrgId(user) {
  if (!useClerk || !clerk) return null;
  // Try read from profile, tolerate missing column
  let profile = null;
  try {
    const res = await supabase.from('profiles').select('org_id, first_name, last_name').eq('id', user.id).single();
    profile = res.data || null;
    if (profile?.org_id) return profile.org_id;
  } catch (e) {
    console.warn('[care-circle] profiles select failed (possibly missing org_id column). Proceeding without it.');
  }
  // Create an org for this user
  const name = `${profile?.first_name || 'Care'} ${profile?.last_name || 'Circle'}`.trim();
  const baseSlug = `cc-${user.id.slice(0, 8)}`.toLowerCase();
  let slug = baseSlug;
  // Try to create; on slug conflict, append random suffix
  let org;
  try {
    org = await clerk.organizations.createOrganization({ name, slug });
  } catch {
    org = await clerk.organizations.createOrganization({ name, slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` });
  }
  try {
    await supabase.from('profiles').update({ org_id: org.id }).eq('id', user.id);
  } catch (e) {
    console.warn('[care-circle] profiles update failed (possibly missing org_id column).');
  }
  return org.id;
}

// Map Clerk membership to our API shape
function mapMember(m) {
  return {
    id: m.id,
    name: `${m.publicUserData?.firstName || ''} ${m.publicUserData?.lastName || ''}`.trim() || m.publicUserData?.identifier || m.emailAddress,
    email: m.publicUserData?.identifier || m.emailAddress,
    phone: null,
    role: m.role,
    permissions: { manageMedications: m.role === 'admin' || m.role === 'org:admin' },
    addedDate: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    status: m.status || 'active',
  };
}

// GET /care-circle
router.get('/', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });

  if (!preferSupabase && useClerk && clerk) {
    try {
      const orgId = await getOrCreateOrgId(user);
      const list = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId });
      const members = list?.data?.map(mapMember) || [];
      return res.json({ members });
    } catch (e) {
      console.warn('[care-circle] Clerk list failed, falling back to Supabase table:', e?.message || e);
      // Fall through to Supabase table listing
    }
  }

  // Fallback: Supabase table
  const { data, error } = await supabase
    .from('care_circle_members')
    .select('*')
    .eq('user_id', user.id)
    .order('added_date', { ascending: false });
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  let rows = data || [];
  // Dev convenience: if none for this user, try to surface earlier dev-bypass inserts under 'user_dev'
  const isDev = process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_MODE !== 'false';
  if (isDev && rows.length === 0 && user.id !== 'user_dev') {
    const alt = await supabase
      .from('care_circle_members')
      .select('*')
      .eq('user_id', 'user_dev')
      .order('added_date', { ascending: false });
    if (!alt.error && alt.data) rows = alt.data;
  }
  return res.json({ members: rows.map(m => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, role: m.role, permissions: m.permissions, addedDate: m.added_date, status: m.status })) });
});

// POST /care-circle/invite
router.post('/invite', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const { email, name, role } = req.body || {};
  if (!email) return res.status(400).json({ error: 'validation_error', message: 'email is required' });

  if (!preferSupabase && useClerk && clerk) {
    try {
      const orgId = await getOrCreateOrgId(user);
      const invitation = await clerk.organizations.createOrganizationInvitation({ organizationId: orgId, emailAddress: email, role: role || 'basic_member' });
      return res.status(201).json({ id: invitation.id, email: invitation.emailAddress, role: invitation.role, status: invitation.status });
    } catch (e) {
      console.warn('[care-circle] Clerk invitation failed, falling back to Supabase row. Reason:', e?.message || e);
      // Fall back to pending member row so the UI can proceed
      try {
        const payload = { user_id: user.id, name, email, role: role || 'member', permissions: { viewMedications: true }, status: 'pending', added_date: new Date().toISOString(), message: null };
        const { data, error } = await supabase.from('care_circle_members').insert(payload).select().single();
        if (error) {
          console.error('[care-circle] Fallback insert failed:', error);
          return res.status(400).json({ error: 'bad_request', message: e?.message || 'Failed to invite member' });
        }
        return res.status(201).json(data);
      } catch (f) {
        console.error('[care-circle] Fallback insert exception:', f);
        return res.status(400).json({ error: 'bad_request', message: e?.message || 'Failed to invite member' });
      }
    }
  }

  // Fallback: Supabase table
  const payload = { user_id: user.id, name, email, role: role || 'member', permissions: { viewMedications: true }, status: 'pending', added_date: new Date().toISOString(), message: null };
  const { data, error } = await supabase.from('care_circle_members').insert(payload).select().single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.status(201).json(data);
});

// PUT /care-circle/:id/permissions (maps to role changes in Clerk)
router.put('/:id/permissions', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;
  const { role = 'basic_member' } = req.body || {};

  if (useClerk && clerk) {
    try {
      // Clerk API expects organizationMembershipId for updates
      const updated = await clerk.organizations.updateOrganizationMembership(id, { role });
      return res.json(mapMember(updated));
    } catch (e) {
      return res.status(400).json({ error: 'bad_request', message: e?.message || 'Failed to update membership' });
    }
  }

  const { data, error } = await supabase
    .from('care_circle_members')
    .update({ permissions: { manageMedications: role !== 'basic_member' } })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.json(data);
});

// DELETE /care-circle/:id
router.delete('/:id', async (req, res) => {
  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  const id = req.params.id;

  if (useClerk && clerk) {
    try {
      await clerk.organizations.deleteOrganizationMembership(id);
      return res.status(204).send();
    } catch (e) {
      return res.status(400).json({ error: 'bad_request', message: e?.message || 'Failed to remove member' });
    }
  }

  const { error } = await supabase.from('care_circle_members').delete().eq('id', id).eq('user_id', user.id);
  if (error) return res.status(400).json({ error: 'bad_request', message: error.message });
  return res.status(204).send();
});

export default router;
