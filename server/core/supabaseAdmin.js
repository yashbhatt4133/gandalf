import { createClient } from '@supabase/supabase-js';

let client = null;

/** Service-role client — bypasses RLS by design (see ERD.md's closing note). */
export function getSupabaseAdmin() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/**
 * Verifies a user's JWT (from the `Authorization: Bearer <token>` header)
 * against Supabase Auth and returns the verified user id. Never trust a
 * client-supplied user id for writes — this is the only source of truth.
 */
export async function verifyUser(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AuthError('Missing Authorization header.');

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new AuthError('Invalid or expired session.');
  return data.user;
}

export class AuthError extends Error {}
