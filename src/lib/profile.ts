import { supabase } from './supabaseClient';
import type { Profile, UserInterest } from '../types/db';

// Plain profile/interests CRUD — RLS (`auth.uid() = user_id`) scopes every
// call to the signed-in user, so these go straight to Supabase from the
// browser rather than through the Express/Netlify server (see ERD.md).

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId: string, fields: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getInterests(userId: string): Promise<UserInterest[]> {
  const { data, error } = await supabase.from('user_interests').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function addInterest(userId: string, label: string): Promise<UserInterest> {
  const { data, error } = await supabase.from('user_interests').insert({ user_id: userId, label }).select().single();
  if (error) throw error;
  return data;
}

export async function removeInterest(id: string): Promise<void> {
  const { error } = await supabase.from('user_interests').delete().eq('id', id);
  if (error) throw error;
}
