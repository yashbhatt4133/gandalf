// Framework-agnostic request handlers — the actual business logic behind
// every route. Both server/index.js (Express) and netlify/functions/*.js
// import these directly and are pure translation layers around them (see
// DEPLOYMENT.md's "two backend adapters, one core").

import { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveProviderForUser, isDeployedMode, localFallback, formatBadgeLabel, DEFAULT_MODELS } from './providers/index.js';
import { encryptApiKey } from './crypto.js';
import { generateQuizBatch, generateOneAdaptiveQuestion, generateExplanation, validateGeneratedQuestion, generateTopicSuggestions } from './quiz.js';
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

const PASS_THRESHOLD = 80;

/** Distinct lowercased tags drawn from the incorrectly-answered questions in a
 *  session — i.e. the sub-topics the candidate is weak on. Empty = no gaps. */
async function weakTagsForSession(admin, sessionId) {
  const { data: qs } = await admin.from('quiz_questions').select('tags, is_correct').eq('quiz_session_id', sessionId);
  const weak = new Set();
  for (const q of qs ?? []) {
    if (q.is_correct === false) for (const t of q.tags ?? []) weak.add(String(t).toLowerCase());
  }
  return Array.from(weak);
}

/** The journey's current weak sub-topics: the most recent completed reassessment
 *  if one exists (so a failed retry narrows to what's *still* failing), else the
 *  calibration. Used to scope recommended-topic and reassessment generation. */
async function gapTagsForJourney(admin, userId, journeyId) {
  const { data: sessions } = await admin
    .from('quiz_sessions')
    .select('id, session_type, taken_at')
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .eq('completed', true)
    .in('session_type', ['calibration', 'reassessment'])
    .order('taken_at', { ascending: false });
  const latest = (sessions ?? []).find((s) => s.session_type === 'reassessment') ?? (sessions ?? [])[0];
  if (!latest) return [];
  return weakTagsForSession(admin, latest.id);
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

  // Reassessment re-tests only the sub-topics the candidate was weak on
  // (derived from the journey's latest calibration/reassessment). Calibration
  // stays broad.
  const focusTags = sessionType === 'reassessment' && journeyId ? await gapTagsForJourney(admin, userId, journeyId) : [];

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
    focusTags,
  });
  const rows = questions.map((q) => ({ ...q, quiz_session_id: session.id, user_id: userId }));
  const { data: inserted, error: qErr } = await admin.from('quiz_questions').insert(rows).select();
  if (qErr) throw qErr;

  const clientQuestions = inserted.sort((a, b) => a.order_index - b.order_index).map(stripAnswerKey);
  return { sessionId: session.id, questions: clientQuestions, timeLimitSeconds: session.time_limit_seconds };
}

/** Dynamic topic-chip suggestions for the Adaptive Quiz picker's "Suggest topics"
 *  action — profile-personalized, and de-duped against topics already shown. */
export async function suggestTopicsForUser(userId, { domain, existing }) {
  if (!domain || typeof domain !== 'string') throw new BadRequestError('domain is required.');
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('target_role').eq('user_id', userId).maybeSingle();
  const { data: interestRows } = await admin.from('user_interests').select('label').eq('user_id', userId);
  const interests = (interestRows ?? []).map((r) => r.label);

  const cleanExisting = Array.isArray(existing)
    ? Array.from(new Set(existing.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()))).slice(0, 40)
    : [];

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const topics = await generateTopicSuggestions({ provider, model, apiKey, domain, targetRole: profile?.target_role, interests, existing: cleanExisting });
  return { topics };
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

/** Recomputes one quiz session's `score` straight from its questions, excluding
 *  any `flagged_broken` ones from both the numerator and denominator — so a
 *  question found to have no correct option among its choices (see
 *  `validateQuestion`) neither helps nor hurts the session score. */
async function recomputeSessionScore(admin, sessionId) {
  const { data: qs } = await admin.from('quiz_questions').select('is_correct, flagged_broken').eq('quiz_session_id', sessionId);
  const counted = (qs ?? []).filter((q) => !q.flagged_broken);
  const total = counted.length;
  const correct = counted.filter((q) => q.is_correct).length;
  const scorePct = total > 0 ? Math.round((100 * correct) / total) : 0;
  await admin.from('quiz_sessions').update({ score: scorePct }).eq('id', sessionId);
  return scorePct;
}

/** Recomputes a user's `topic_mastery` row for one domain/topic from scratch,
 *  across every completed session on that topic — rather than incrementally
 *  patching it once at `finishSession` time. This is what keeps mastery stats
 *  correct after a retroactive edit (a `validateQuestion` correction, or a
 *  question later flagged broken): re-deriving from the current state of
 *  `quiz_questions` is the only way those edits actually propagate, and
 *  `flagged_broken` rows are excluded from both attempts and correct counts. */
async function recomputeTopicMastery(admin, userId, domain, topic) {
  const { data: sessions } = await admin
    .from('quiz_sessions')
    .select('id, taken_at')
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('topic', topic)
    .eq('completed', true);
  const sessionIds = (sessions ?? []).map((s) => s.id);

  let attempts = 0;
  let correct = 0;
  let avgTime = 0;
  if (sessionIds.length > 0) {
    const { data: qs } = await admin.from('quiz_questions').select('is_correct, flagged_broken, time_spent_seconds').in('quiz_session_id', sessionIds);
    const counted = (qs ?? []).filter((q) => !q.flagged_broken);
    attempts = counted.length;
    correct = counted.filter((q) => q.is_correct).length;
    const totalTime = counted.reduce((sum, q) => sum + (q.time_spent_seconds || 0), 0);
    avgTime = attempts > 0 ? totalTime / attempts : 0;
  }
  const masteryScore = attempts > 0 ? Math.round((100 * correct) / attempts) : 0;
  const lastPracticedAt = (sessions ?? []).reduce((latest, s) => (!latest || new Date(s.taken_at) > new Date(latest) ? s.taken_at : latest), null);

  await admin.from('topic_mastery').upsert(
    {
      user_id: userId,
      domain,
      topic,
      attempts_count: attempts,
      correct_count: correct,
      avg_time_seconds: avgTime,
      mastery_score: masteryScore,
      last_practiced_at: lastPracticedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,domain,topic' }
  );
}

/**
 * "Validate" — independently re-solve the question, check the stored answer key,
 * and persist the verified result. Two outcomes:
 * - The key was just mis-marked: `correct_option`/`explanation` are updated to the
 *   validated answer and `is_correct` is recomputed for the user's original pick.
 * - No listed option is actually correct (the question itself is flawed): the
 *   question is marked `flagged_broken` and excluded from scoring (`is_correct`
 *   and `correct_option` cleared to null) rather than "corrected" to a still-wrong
 *   letter. Either way, the owning session's score and the topic's mastery stats
 *   are recomputed so History and the Journey metrics panel stay accurate.
 */
export async function validateQuestion(userId, { questionId }) {
  if (!questionId) throw new BadRequestError('questionId is required.');
  const admin = getSupabaseAdmin();
  const { data: question } = await admin.from('quiz_questions').select('*').eq('id', questionId).eq('user_id', userId).maybeSingle();
  if (!question) throw new NotFoundError('Question not found.');

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  const result = await validateGeneratedQuestion({ provider, model, apiKey, question });

  const storedCorrectOption = String(question.correct_option ?? '').trim().toUpperCase();
  const flaggedBroken = result.independentAnswer === 'NONE';
  const updatedCorrectOption = flaggedBroken ? null : result.independentAnswer;
  const updatedExplanation = result.explanation || question.explanation || '';
  const isCorrect = flaggedBroken
    ? null
    : question.chosen_option
    ? String(question.chosen_option).trim().toUpperCase() === updatedCorrectOption
    : question.is_correct;

  const validatedAt = new Date().toISOString();
  const { error } = await admin
    .from('quiz_questions')
    .update({ correct_option: updatedCorrectOption, explanation: updatedExplanation, is_correct: isCorrect, flagged_broken: flaggedBroken, validated_at: validatedAt })
    .eq('id', questionId);
  if (error) throw error;

  const { data: session } = await admin.from('quiz_sessions').select('id, domain, topic, completed').eq('id', question.quiz_session_id).maybeSingle();
  if (session?.completed) {
    await recomputeSessionScore(admin, session.id);
    if (session.domain && session.topic) await recomputeTopicMastery(admin, userId, session.domain, session.topic);
  }

  return {
    independentAnswer: result.independentAnswer,
    keyIsCorrect: flaggedBroken ? false : result.keyIsCorrect,
    verdict: result.verdict,
    correctAnswerText: result.correctAnswerText || null,
    storedCorrectOption,
    updatedCorrectOption,
    updatedExplanation,
    isCorrect,
    flaggedBroken,
    validatedAt,
    changed: flaggedBroken || storedCorrectOption !== updatedCorrectOption,
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
    // Same recompute-from-scratch path `validateQuestion` uses, so a later
    // correction/flag on any of this topic's questions stays in sync with
    // this initial mastery write rather than two logic paths drifting apart.
    await recomputeTopicMastery(admin, userId, resolvedDomain, resolvedTopic);
  }

  if (session.journey_id && session.session_type === 'calibration') {
    await advanceStep(session.journey_id, 'quiz');
  }

  let weakTags = [];
  if (session.journey_id && session.session_type === 'reassessment') {
    weakTags = await weakTagsForSession(admin, sessionId);
    if (scorePct >= PASS_THRESHOLD) {
      // Pass → journey complete, reassessment step done (all steps done → 100%).
      outcome = 'passed';
      await admin.from('journeys').update({ status: 'mastered' }).eq('id', session.journey_id);
      await advanceStep(session.journey_id, 'reassessment');
    } else {
      // Fail → keep the journey active and route the user back to a gap-scoped
      // re-review: reopen recommended_topics, hold reassessment as upcoming.
      outcome = 'failed';
      await admin.from('journeys').update({ status: 'active' }).eq('id', session.journey_id);
      const { data: steps } = await admin.from('journey_steps').select('id, step_name').eq('journey_id', session.journey_id);
      for (const s of steps ?? []) {
        if (s.step_name === 'recommended_topics') await admin.from('journey_steps').update({ status: 'current' }).eq('id', s.id);
        if (s.step_name === 'reassessment') await admin.from('journey_steps').update({ status: 'upcoming' }).eq('id', s.id);
      }
    }
  }

  return { score: scorePct, total, timeTakenSeconds, level: session.level_at_time, outcome, weakTags };
}

// ---------- Learning verticals ----------

export async function generateVerticalsForJourney(userId, { journeyId, topic, domain }) {
  const admin = getSupabaseAdmin();
  const { data: interestRows } = await admin.from('user_interests').select('label').eq('user_id', userId);
  const interests = (interestRows ?? []).map((r) => r.label);
  const gaps = await gapTagsForJourney(admin, userId, journeyId);

  const { provider, model, apiKey } = await resolveProviderForUser(userId);
  // Generate first — if this throws (provider error), the prior set is untouched.
  const verticals = await generateVerticals({ provider, model, apiKey, topic, domain, interests, gaps });

  // Replace any prior set so a failed-reassessment re-review regenerates a
  // newly gap-scoped list rather than appending duplicates.
  await admin.from('recommended_topics').delete().eq('journey_id', journeyId);
  const rows = verticals.map((v) => ({ ...v, journey_id: journeyId, user_id: userId, status: 'todo' }));
  const { error } = await admin.from('recommended_topics').insert(rows);
  if (error) throw error;

  await advanceStep(journeyId, 'recommended_topics');

  return { generated: rows.length, gaps };
}

/** "Continue anyway" — mark a journey complete even without a passing
 *  reassessment, so the user is never trapped in the mastery loop. */
export async function forceCompleteJourney(userId, { journeyId }) {
  if (!journeyId) throw new BadRequestError('journeyId is required.');
  const admin = getSupabaseAdmin();
  const { data: journey } = await admin.from('journeys').select('id').eq('id', journeyId).eq('user_id', userId).maybeSingle();
  if (!journey) throw new NotFoundError('Journey not found.');
  await admin.from('journeys').update({ status: 'mastered' }).eq('id', journeyId);
  await admin.from('journey_steps').update({ status: 'done' }).eq('journey_id', journeyId);
  return { ok: true };
}
