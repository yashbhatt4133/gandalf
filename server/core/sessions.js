// Framework-agnostic request handlers — the actual business logic behind
// every route. Both server/index.js (Express) and netlify/functions/*.js
// import these directly and are pure translation layers around them (see
// DEPLOYMENT.md's "two backend adapters, one core").

import { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveProviderForUser, isDeployedMode, localFallback, formatBadgeLabel, DEFAULT_MODELS } from './providers/index.js';
import { encryptApiKey } from './crypto.js';
import { generateQuizBatch, generateOneAdaptiveQuestion } from './quiz.js';
import { generateVerticals } from './verticals.js';
import { parseResumeText } from './cvParse.js';
import { NotFoundError, BadRequestError } from './errors.js';

function stripAnswerKey(row) {
  const { correct_option, ...rest } = row;
  return rest;
}

async function pickLevel(userId, domain, topic) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('topic_mastery').select('mastery_score').eq('user_id', userId).eq('domain', domain).eq('topic', topic).maybeSingle();
  const score = data?.mastery_score ?? 0;
  if (score >= 70) return 'advanced';
  if (score >= 40) return 'core';
  return 'foundational';
}

async function advanceStep(journeyId, stepName) {
  const admin = getSupabaseAdmin();
  const { data: steps } = await admin.from('journey_steps').select('*').eq('journey_id', journeyId).order('order_index');
  if (!steps) return;
  const idx = steps.findIndex((s) => s.step_name === stepName);
  if (idx === -1) return;
  await admin.from('journey_steps').update({ status: 'done' }).eq('id', steps[idx].id);
  const next = steps[idx + 1];
  if (next && next.status === 'upcoming') {
    await admin.from('journey_steps').update({ status: 'current' }).eq('id', next.id);
  }
}

// ---------- LLM provider settings ----------

export async function getLlmSettingsForUser(userId) {
  const admin = getSupabaseAdmin();
  const { data: settings } = await admin.from('user_llm_settings').select('*').eq('user_id', userId).maybeSingle();

  const hasPersonal = !!settings && (settings.preferred_provider === 'ollama' || !!settings.encrypted_api_key);
  let providerId = null;
  let model = null;
  let usingDefault = false;
  let usage;

  if (hasPersonal) {
    providerId = settings.preferred_provider;
    model = settings.preferred_model || DEFAULT_MODELS[providerId];
  } else {
    usingDefault = true;
    if (isDeployedMode()) {
      providerId = process.env.DEFAULT_LLM_PROVIDER || null;
      model = process.env.DEFAULT_LLM_MODEL || null;
      if (providerId) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: row } = await admin.from('usage_counters').select('*').eq('user_id', userId).eq('usage_date', today).maybeSingle();
        usage = { used: row?.request_count ?? 0, limit: Number(process.env.DEFAULT_KEY_DAILY_LIMIT || 30) };
      }
    } else {
      const fallback = localFallback();
      if (fallback) {
        providerId = fallback.providerId;
        model = fallback.model;
      }
    }
  }

  return {
    provider: providerId,
    model,
    hasKey: !!settings?.encrypted_api_key,
    usingDefault,
    defaultProvider: isDeployedMode() ? process.env.DEFAULT_LLM_PROVIDER : undefined,
    defaultModel: isDeployedMode() ? process.env.DEFAULT_LLM_MODEL : undefined,
    badgeLabel: providerId ? formatBadgeLabel(providerId, model, usingDefault) : 'No provider configured — see Settings',
    usage,
  };
}

export async function saveLlmSettingsForUser(userId, { provider, model, apiKey }) {
  if (!['ollama', 'groq', 'openai', 'gemini'].includes(provider)) {
    throw new BadRequestError('Invalid provider.');
  }

  const update = {
    user_id: userId,
    preferred_provider: provider,
    preferred_model: model || DEFAULT_MODELS[provider],
    updated_at: new Date().toISOString(),
  };
  if (apiKey === null) {
    update.encrypted_api_key = null;
  } else if (typeof apiKey === 'string' && apiKey.trim()) {
    update.encrypted_api_key = encryptApiKey(apiKey.trim());
  }

  const { error } = await getSupabaseAdmin().from('user_llm_settings').upsert(update);
  if (error) throw error;
  return { ok: true };
}

// ---------- CV / background parsing ----------

export async function parseCvForUser(userId, text) {
  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const parsedSkills = await parseResumeText({ provider, model, apiKey, text });
  return { parsedSkills };
}

// ---------- Quiz generation / answering ----------

export async function createQuizSession(userId, { sessionType, topic, domain, questionCount, journeyId, timeLimitSeconds }) {
  if (!['calibration', 'reassessment', 'adaptive', 'timed_test'].includes(sessionType)) {
    throw new BadRequestError('Invalid sessionType.');
  }
  if (!topic || !domain) throw new BadRequestError('topic and domain are required.');

  const count = Math.max(1, Math.min(50, Number(questionCount) || 5));
  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const level = await pickLevel(userId, domain, topic);

  const admin = getSupabaseAdmin();
  const { data: session, error: sessionErr } = await admin
    .from('quiz_sessions')
    .insert({
      journey_id: journeyId || null,
      user_id: userId,
      session_type: sessionType,
      level_at_time: level,
      time_limit_seconds: timeLimitSeconds || null,
      provider_used: provider.id,
      model_used: model,
    })
    .select()
    .single();
  if (sessionErr) throw sessionErr;

  const questions = await generateQuizBatch({ provider, model, apiKey, topic, domain, questionCount: count, level, avoidQuestions: [] });
  const rows = questions.map((q) => ({ ...q, quiz_session_id: session.id, user_id: userId }));
  const { data: inserted, error: qErr } = await admin.from('quiz_questions').insert(rows).select();
  if (qErr) throw qErr;

  const clientQuestions = inserted.sort((a, b) => a.order_index - b.order_index).map(stripAnswerKey);
  return { sessionId: session.id, questions: clientQuestions, timeLimitSeconds: session.time_limit_seconds };
}

export async function generateNextAdaptiveQuestion(userId, { sessionId, topic, domain }) {
  const admin = getSupabaseAdmin();
  const { data: session } = await admin.from('quiz_sessions').select('*').eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (!session) throw new NotFoundError('Session not found.');

  const { data: existing } = await admin.from('quiz_questions').select('question_text, order_index').eq('quiz_session_id', sessionId).order('order_index');
  const avoidQuestions = (existing ?? []).map((q) => q.question_text);
  const nextIndex = existing?.length ?? 0;

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const level = await pickLevel(userId, domain, topic);
  const question = await generateOneAdaptiveQuestion({ provider, model, apiKey, topic, domain, level, avoidQuestions });

  const { data: inserted, error } = await admin
    .from('quiz_questions')
    .insert({ ...question, order_index: nextIndex, quiz_session_id: sessionId, user_id: userId })
    .select()
    .single();
  if (error) throw error;

  return { question: stripAnswerKey(inserted) };
}

export async function submitAnswer(userId, { questionId, chosenOption, timeSpentSeconds }) {
  const admin = getSupabaseAdmin();
  const { data: question } = await admin.from('quiz_questions').select('*').eq('id', questionId).eq('user_id', userId).maybeSingle();
  if (!question) throw new NotFoundError('Question not found.');

  const isCorrect = String(chosenOption).trim().toUpperCase() === String(question.correct_option).trim().toUpperCase();

  const { error } = await admin
    .from('quiz_questions')
    .update({ chosen_option: chosenOption, is_correct: isCorrect, time_spent_seconds: timeSpentSeconds ?? null })
    .eq('id', questionId);
  if (error) throw error;

  return { isCorrect, correctOption: question.correct_option, explanation: question.explanation || '' };
}

export async function finishSession(userId, { sessionId, topic, domain }) {
  const admin = getSupabaseAdmin();
  const { data: session } = await admin.from('quiz_sessions').select('*').eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (!session) throw new NotFoundError('Session not found.');

  let resolvedTopic = topic;
  let resolvedDomain = domain;
  if (session.journey_id) {
    const { data: journey } = await admin.from('journeys').select('topic, domain').eq('id', session.journey_id).maybeSingle();
    if (journey) {
      resolvedTopic = journey.topic;
      resolvedDomain = journey.domain;
    }
  }

  const { data: questions } = await admin.from('quiz_questions').select('*').eq('quiz_session_id', sessionId);
  const total = questions?.length ?? 0;
  const correct = (questions ?? []).filter((q) => q.is_correct).length;
  const timeTakenSeconds = (questions ?? []).reduce((sum, q) => sum + (q.time_spent_seconds || 0), 0);
  const scorePct = total > 0 ? Math.round((100 * correct) / total) : 0;

  await admin.from('quiz_sessions').update({ completed: true, score: scorePct, time_taken_seconds: timeTakenSeconds }).eq('id', sessionId);

  let outcome = null;
  if (resolvedDomain && resolvedTopic) {
    const { data: existingMastery } = await admin
      .from('topic_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('domain', resolvedDomain)
      .eq('topic', resolvedTopic)
      .maybeSingle();

    const prevAttempts = existingMastery?.attempts_count ?? 0;
    const prevCorrect = existingMastery?.correct_count ?? 0;
    const prevAvgTime = existingMastery?.avg_time_seconds ?? 0;

    const newAttempts = prevAttempts + total;
    const newCorrect = prevCorrect + correct;
    const newAvgTime = newAttempts > 0 ? (prevAvgTime * prevAttempts + timeTakenSeconds) / newAttempts : 0;
    const masteryScore = newAttempts > 0 ? Math.round((100 * newCorrect) / newAttempts) : 0;

    await admin.from('topic_mastery').upsert(
      {
        user_id: userId,
        domain: resolvedDomain,
        topic: resolvedTopic,
        attempts_count: newAttempts,
        correct_count: newCorrect,
        avg_time_seconds: newAvgTime,
        mastery_score: masteryScore,
        last_practiced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,domain,topic' }
    );
  }

  if (session.journey_id && session.session_type === 'calibration') {
    await advanceStep(session.journey_id, 'quiz');
  }

  if (session.journey_id && session.session_type === 'reassessment') {
    if (scorePct > 80) {
      outcome = 'mastered';
      await admin.from('journeys').update({ status: 'mastered' }).eq('id', session.journey_id);
    } else if (scorePct <= 40) {
      outcome = 'reset';
      await admin.from('recommended_topics').update({ status: 'todo' }).eq('journey_id', session.journey_id).eq('status', 'done');
    } else {
      outcome = 'read_more';
    }
    await advanceStep(session.journey_id, 'reassessment');
  }

  return { score: scorePct, total, timeTakenSeconds, level: session.level_at_time, outcome };
}

// ---------- Learning verticals ----------

export async function generateVerticalsForJourney(userId, { journeyId, topic, domain }) {
  const admin = getSupabaseAdmin();
  const { data: interestRows } = await admin.from('user_interests').select('label').eq('user_id', userId);
  const interests = (interestRows ?? []).map((r) => r.label);

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const verticals = await generateVerticals({ provider, model, apiKey, topic, domain, interests });

  const rows = verticals.map((v) => ({ ...v, journey_id: journeyId, user_id: userId, status: 'todo' }));
  const { error } = await admin.from('recommended_topics').insert(rows);
  if (error) throw error;

  await advanceStep(journeyId, 'recommended_topics');

  return { generated: rows.length };
}
