import { supabase } from './supabaseClient';
import type { Journey, JourneyStep, QuizSession, RecommendedTopic, StepName, TopicMastery } from '../types/db';

export async function listJourneys(userId: string): Promise<Journey[]> {
  const { data, error } = await supabase.from('journeys').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getJourney(journeyId: string): Promise<Journey | null> {
  const { data, error } = await supabase.from('journeys').select('*').eq('id', journeyId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createJourney(userId: string, topic: string, domain: string): Promise<Journey> {
  const { data, error } = await supabase.from('journeys').insert({ user_id: userId, topic, domain, status: 'active' }).select().single();
  if (error) throw error;

  const steps: Omit<JourneyStep, 'id'>[] = [
    { journey_id: data.id, user_id: userId, step_name: 'quiz', status: 'current', order_index: 0 },
    { journey_id: data.id, user_id: userId, step_name: 'recommended_topics', status: 'upcoming', order_index: 1 },
    { journey_id: data.id, user_id: userId, step_name: 'reassessment', status: 'upcoming', order_index: 2 },
  ];
  const { error: stepError } = await supabase.from('journey_steps').insert(steps);
  if (stepError) throw stepError;

  return data;
}

export async function listJourneySteps(journeyId: string): Promise<JourneyStep[]> {
  const { data, error } = await supabase.from('journey_steps').select('*').eq('journey_id', journeyId).order('order_index');
  if (error) throw error;
  return data ?? [];
}

export async function markStepDone(journeyId: string, stepName: StepName): Promise<void> {
  const steps = await listJourneySteps(journeyId);
  const idx = steps.findIndex((s) => s.step_name === stepName);
  if (idx === -1) return;

  await supabase.from('journey_steps').update({ status: 'done' }).eq('id', steps[idx].id);

  const next = steps[idx + 1];
  if (next && next.status === 'upcoming') {
    await supabase.from('journey_steps').update({ status: 'current' }).eq('id', next.id);
  }
}

export async function setJourneyStatus(journeyId: string, status: Journey['status']): Promise<void> {
  const { error } = await supabase.from('journeys').update({ status }).eq('id', journeyId);
  if (error) throw error;
}

export async function listQuizSessions(userId: string, journeyId?: string): Promise<QuizSession[]> {
  let query = supabase.from('quiz_sessions').select('*').eq('user_id', userId).order('taken_at', { ascending: true });
  if (journeyId) query = query.eq('journey_id', journeyId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listTopicMastery(userId: string, domain?: string): Promise<TopicMastery[]> {
  let query = supabase.from('topic_mastery').select('*').eq('user_id', userId);
  if (domain) query = query.eq('domain', domain);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listRecommendedTopics(journeyId: string): Promise<RecommendedTopic[]> {
  const { data, error } = await supabase.from('recommended_topics').select('*').eq('journey_id', journeyId).order('rank');
  if (error) throw error;
  return data ?? [];
}

export function subscribeRecommendedTopics(journeyId: string, onInsert: (row: RecommendedTopic) => void) {
  const channel = supabase
    .channel(`recommended_topics_${journeyId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recommended_topics', filter: `journey_id=eq.${journeyId}` }, (payload) => {
      onInsert(payload.new as RecommendedTopic);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markRecommendedTopicDone(id: string): Promise<void> {
  const { error } = await supabase.from('recommended_topics').update({ status: 'done' }).eq('id', id);
  if (error) throw error;
}
