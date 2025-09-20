import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}

// Default anon client (no RLS identity attached until you pass a token-bound client)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Admin client for privileged operations (e.g., Storage uploads)
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Create a client that runs with the user's RLS identity
export function supabaseForToken(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getUserFromAuthHeader(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const isDevBypass = (process.env.NODE_ENV !== 'production') && (process.env.AUTH_DEV_MODE !== 'false');
  if (!token) {
    if (isDevBypass) {
      console.warn('[auth] DEV BYPASS: No token provided. Using stub user.');
      return { user: { id: 'user_dev', email: 'dev@example.com' }, error: null, token: null };
    }
    return { user: null, error: { message: 'Missing bearer token' } };
  }

  // Prefer Clerk if configured
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { verifyToken } = await import('@clerk/clerk-sdk-node');
      const verified = await verifyToken(token, { 
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 60000, // tolerate 60s skew in dev
      });
      // Map to our "user" shape expected by routes
      const user = {
        id: verified.sub,
        email: verified.email || verified.primary_email || null,
        first_name: verified.first_name || null,
        last_name: verified.last_name || null,
      };
      return { user, error: null, token };
    } catch (e) {
      console.warn('[auth] Clerk token verification failed:', e?.message || e);
      // Dev-only fallback: try to decode JWT without verifying signature
      if (isDevBypass) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            const user = {
              id: payload.sub,
              email: payload.email || payload.primary_email || null,
              first_name: payload.first_name || null,
              last_name: payload.last_name || null,
            };
            console.warn('[auth] Using DEV JWT fallback (unverified). Do not use in production.');
            return { user, error: null, token };
          }
        } catch {}
        // Final dev bypass if decoding unsuccessful
        console.warn('[auth] DEV BYPASS: Falling back to stub user.');
        return { user: { id: 'user_dev', email: 'dev@example.com' }, error: null, token };
      }
      return { user: null, error: { message: (e && e.message) || 'Invalid Clerk token' } };
    }
  }

  // Fallback: Supabase Auth (legacy)
  const { data, error } = await supabase.auth.getUser(token);
  return { user: data?.user || null, error, token };
}
