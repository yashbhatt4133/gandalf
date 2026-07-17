import { supabase } from './supabaseClient';
import type { QuizQuestion, QuizSession } from '../types/db';

export interface HistoryFilters {
  topic?: string | null;
  tag?: string | null;
}

/** Reverse-chronological list of completed quiz sessions, optionally filtered by topic and/or tag. */
export async function listCompletedSessions(userId: string, filters: HistoryFilters = {}): Promise<QuizSession[]> {
  let sessionIdsWithTag: string[] | null = null;
  if (filters.tag) {
    const { data, error } = await supabase.from('quiz_questions').select('quiz_session_id').eq('user_id', userId).contains('tags', [filters.tag]);
    if (error) throw error;
    sessionIdsWithTag = Array.from(new Set((data ?? []).map((r) => r.quiz_session_id)));
    if (sessionIdsWithTag.length === 0) return [];
  }

  let query = supabase.from('quiz_sessions').select('*').eq('user_id', userId).eq('completed', true).order('taken_at', { ascending: false });
  if (filters.topic) query = query.eq('topic', filters.topic);
  if (sessionIdsWithTag) query = query.in('id', sessionIdsWithTag);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Session ids that contain at least one question flagged during "Validate" as
 *  having no correct option among its choices — powers the History list's
 *  "flawed question" indicator so those sessions are easy to spot again. */
export async function listFlaggedSessionIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('quiz_questions').select('quiz_session_id').eq('user_id', userId).eq('flagged_broken', true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.quiz_session_id));
}

/** Distinct, non-null topics across the user's completed sessions — powers the History topic filter. */
export async function listDistinctTopics(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('quiz_sessions').select('topic').eq('user_id', userId).eq('completed', true);
  if (error) throw error;
  const topics = (data ?? []).map((r) => r.topic).filter((t): t is string => !!t);
  return Array.from(new Set(topics)).sort();
}

/** Distinct tags across all of the user's questions — powers the History tag filter. */
export async function listDistinctTags(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('quiz_questions').select('tags').eq('user_id', userId);
  if (error) throw error;
  const tags = (data ?? []).flatMap((r) => r.tags ?? []);
  return Array.from(new Set(tags)).sort();
}

export async function getSessionWithQuestions(sessionId: string): Promise<{ session: QuizSession; questions: QuizQuestion[] } | null> {
  const { data: session, error: sessionErr } = await supabase.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session) return null;

  const { data: questions, error: questionsErr } = await supabase.from('quiz_questions').select('*').eq('quiz_session_id', sessionId).order('order_index');
  if (questionsErr) throw questionsErr;

  return { session, questions: questions ?? [] };
}
