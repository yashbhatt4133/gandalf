// Framework-agnostic request handlers — the actual business logic behind
// every route. Both server/index.js (Express) and netlify/functions/*.js
// import these directly and are pure translation layers around them (see
// DEPLOYMENT.md's "two backend adapters, one core").

import { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveProviderForUser, isDeployedMode, localFallback, formatBadgeLabel, DEFAULT_MODELS } from './providers/index.js';
import { encryptApiKey } from './crypto.js';
import { generateQuizBatch, generateOneAdaptiveQuestion, generateExplanation, validateGeneratedQuestion } from './quiz.js';
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

/**
 * Cross-session context for fresh, feedback-aware generation:
 * - `avoidQuestions`: question texts already asked to this user on this topic
 *   (across every past session), so regeneration doesn't repeat itself.
 * - `feedbackNotes`: the user's recent post-quiz comments, so their guidance
 *   ("write real interview questions") actually shapes the next prompt.
 */
async function gatherGenerationContext(admin, userId, topic) {
  let avoidQuestions = [];
  if (topic) {
    const { data: sessions } = await admin
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('topic', topic)
      .order('taken_at', { ascending: false })
      .limit(12);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length) {
      const { data: qs } = await admin.from('quiz_questions').select('question_text').in('quiz_session_id', sessionIds).limit(80);
      avoidQuestions = Array.from(new Set((qs ?? []).map((q) => q.question_text))).slice(0, 80);
    }
  }

  const { data: fb } = await admin
    .from('quiz_feedback')
    .select('post_comment, updated_at')
    .eq('user_id', userId)
    .not('post_comment', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);
  const feedbackNotes = (fb ?? []).map((f) => f.post_comment).filter((c) => c && c.trim());

  return { avoidQuestions, feedbackNotes };
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

const QUESTION_TYPES = ['mcq', 'predict_output'];
const DIFFICULTIES = ['foundational', 'core', 'advanced'];

export async function createQuizSession(userId, { sessionType, topic, domain, questionCount, journeyId, timeLimitSeconds, preQuestionTypes, preDifficulty, description }) {
  if (!['calibration', 'reassessment', 'adaptive', 'timed_test'].includes(sessionType)) {
    throw new BadRequestError('Invalid sessionType.');
  }
  if (!topic || !domain) throw new BadRequestError('topic and domain are required.');

  const count = Math.max(1, Math.min(50, Number(questionCount) || 5));
  const { provider, model, apiKey } = await resolveProviderForUser(userId);

  const cleanQuestionTypes = Array.isArray(preQuestionTypes) ? preQuestionTypes.filter((t) => QUESTION_TYPES.includes(t)) : [];
  const cleanDifficulty = DIFFICULTIES.includes(preDifficulty) ? preDifficulty : null;
  const cleanDescription = typeof description === 'string' && description.trim() ? description.trim().slice(0, 2000) : null;
  const level = cleanDifficulty || (await pickLevel(userId, domain, topic));

  const admin = getSupabaseAdmin();

  // Gather what's already been asked + recent feedback BEFORE inserting the new
  // session, so the new (still-empty) session doesn't pollute the avoid list.
  const { avoidQuestions, feedbackNotes } = await gatherGenerationContext(admin, userId, topic);

  const { data: session, error: sessionErr } = await admin
    .from('quiz_sessions')
    .insert({
      journey_id: journeyId || null,
      user_id: userId,
      session_type: sessionType,
      topic,
      domain,
      level_at_time: level,
      time_limit_seconds: timeLimitSeconds || null,
      provider_used: provider.id,
      model_used: model,
    })
    .select()
    .single();
  if (sessionErr) throw sessionErr;

  if (cleanQuestionTypes.length > 0 || cleanDifficulty || cleanDescription) {
    // Best-effort: if pre_description column isn't present yet, the insert is
    // ignored (error not thrown) and generation still proceeds using the value.
    await admin.from('quiz_feedback').insert({
      quiz_session_id: session.id,
      user_id: userId,
      pre_question_types: cleanQuestionTypes.length > 0 ? cleanQuestionTypes : null,
      pre_difficulty: cleanDifficulty,
      pre_description: cleanDescription,
    });
  }

  // Provider errors propagate out of this call (see generateQuizBatch) so the
  // client surfaces "generation failed" instead of silently getting filler.
  const questions = await generateQuizBatch({
    provider,
    model,
    apiKey,
    topic,
    domain,
    questionCount: count,
    level,
    avoidQuestions,
    preferredQuestionTypes: cleanQuestionTypes,
    description: cleanDescription,
    feedbackNotes,
  });
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

  const resolvedTopic = session.topic || topic;
  const resolvedDomain = session.domain || domain;

  const { data: existing } = await admin.from('quiz_questions').select('question_text, order_index').eq('quiz_session_id', sessionId).order('order_index');
  const nextIndex = existing?.length ?? 0;

  const { data: feedback } = await admin.from('quiz_feedback').select('pre_question_types, pre_difficulty, pre_description').eq('quiz_session_id', sessionId).maybeSingle();
  const preferredQuestionTypes = feedback?.pre_question_types ?? [];

  // Avoid both this session's own questions and any asked on this topic before.
  const { avoidQuestions: crossSession, feedbackNotes } = await gatherGenerationContext(admin, userId, resolvedTopic);
  const avoidQuestions = Array.from(new Set([...(existing ?? []).map((q) => q.question_text), ...crossSession]));

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const level = feedback?.pre_difficulty || (await pickLevel(userId, resolvedDomain, resolvedTopic));
  const question = await generateOneAdaptiveQuestion({
    provider,
    model,
    apiKey,
    topic: resolvedTopic,
    domain: resolvedDomain,
    level,
    avoidQuestions,
    preferredQuestionTypes,
    description: feedback?.pre_description ?? null,
    feedbackNotes,
  });

  const { data: inserted, error } = await admin
    .from('quiz_questions')
    .insert({ ...question, order_index: nextIndex, quiz_session_id: sessionId, user_id: userId })
    .select()
    .single();
  if (error) throw error;

  return { question: stripAnswerKey(inserted) };
}

export async function submitQuizFeedback(userId, { sessionId, satisfaction, comment }) {
  if (!sessionId) throw new BadRequestError('sessionId is required.');
  const admin = getSupabaseAdmin();
  const { data: session } = await admin.from('quiz_sessions').select('id').eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (!session) throw new NotFoundError('Session not found.');

  const cleanSatisfaction = Number.isInteger(satisfaction) && satisfaction >= 1 && satisfaction <= 5 ? satisfaction : null;

  const { error } = await admin.from('quiz_feedback').upsert(
    {
      quiz_session_id: sessionId,
      user_id: userId,
      post_satisfaction: cleanSatisfaction,
      post_comment: typeof comment === 'string' ? comment.trim().slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'quiz_session_id' }
  );
  if (error) throw error;

  return { ok: true };
}

// ---------- Per-question review (History screen) ----------

/** "Explain More" — a fresh, personalized explanation for one past question. */
export async function explainQuestion(userId, { questionId }) {
  if (!questionId) throw new BadRequestError('questionId is required.');
  const admin = getSupabaseAdmin();
  const { data: question } = await admin.from('quiz_questions').select('*').eq('id', questionId).eq('user_id', userId).maybeSingle();
  if (!question) throw new NotFoundError('Question not found.');

  const { data: profile } = await admin.from('profiles').select('target_role').eq('user_id', userId).maybeSingle();
  const { data: interestRows } = await admin.from('user_interests').select('label').eq('user_id', userId);
  const interests = (interestRows ?? []).map((r) => r.label);

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const explanation = await generateExplanation({ provider, model, apiKey, question, targetRole: profile?.target_role, interests });
  return { explanation };
}

/**
 * "Validate" — independently re-solve the question, check the stored answer key,
 * and persist the verified result: the question's `correct_option`/`explanation`
 * are updated to the validated answer and `is_correct` is recomputed for the
 * user's original pick, so the History record reflects the corrected answer.
 */
export async function validateQuestion(userId, { questionId }) {
  if (!questionId) throw new BadRequestError('questionId is required.');
  const admin = getSupabaseAdmin();
  const { data: question } = await admin.from('quiz_questions').select('*').eq('id', questionId).eq('user_id', userId).maybeSingle();
  if (!question) throw new NotFoundError('Question not found.');

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const result = await validateGeneratedQuestion({ provider, model, apiKey, question });

  const storedCorrectOption = String(question.correct_option ?? '').trim().toUpperCase();
  const updatedCorrectOption = result.independentAnswer;
  const updatedExplanation = result.explanation || question.explanation || '';
  const isCorrect = question.chosen_option ? String(question.chosen_option).trim().toUpperCase() === updatedCorrectOption : question.is_correct;

  const { error } = await admin
    .from('quiz_questions')
    .update({ correct_option: updatedCorrectOption, explanation: updatedExplanation, is_correct: isCorrect })
    .eq('id', questionId);
  if (error) throw error;

  return {
    independentAnswer: result.independentAnswer,
    keyIsCorrect: result.keyIsCorrect,
    verdict: result.verdict,
    storedCorrectOption,
    updatedCorrectOption,
    updatedExplanation,
    isCorrect,
    changed: storedCorrectOption !== updatedCorrectOption,
  };
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

export async function finishSession(userId, { sessionId }) {
  const admin = getSupabaseAdmin();
  const { data: session } = await admin.from('quiz_sessions').select('*').eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (!session) throw new NotFoundError('Session not found.');

  let resolvedTopic = session.topic;
  let resolvedDomain = session.domain;
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
