import { getAccessToken } from './session';
import type { ClientQuizQuestion, Difficulty, ProviderId, QuestionType, SessionType } from '../types/db';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError('Not signed in.', 401);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

// ---------- CV parsing ----------

export function parseCv(text: string) {
  return apiFetch<{ parsedSkills: Record<string, unknown> }>('/api/parse-cv', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ---------- Quiz generation / answering ----------

export interface GenerateQuizParams {
  sessionType: SessionType;
  topic: string;
  domain: string;
  questionCount: number;
  journeyId?: string | null;
  timeLimitSeconds?: number | null;
  preQuestionTypes?: QuestionType[];
  preDifficulty?: Difficulty;
  description?: string;
}

export function generateQuiz(params: GenerateQuizParams) {
  return apiFetch<{ sessionId: string; questions: ClientQuizQuestion[]; timeLimitSeconds: number | null }>('/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function generateAdaptiveQuestion(sessionId: string, topic: string, domain: string) {
  return apiFetch<{ question: ClientQuizQuestion }>('/api/generate-adaptive-question', {
    method: 'POST',
    body: JSON.stringify({ sessionId, topic, domain }),
  });
}

export function answerQuestion(params: { questionId: string; chosenOption: string; timeSpentSeconds: number }) {
  return apiFetch<{ isCorrect: boolean; correctOption: string; explanation: string }>('/api/answer-question', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function completeSession(sessionId: string) {
  return apiFetch<{
    score: number;
    total: number;
    timeTakenSeconds: number;
    level: string;
    outcome?: 'mastered' | 'read_more' | 'reset' | null;
  }>('/api/complete-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function submitQuizFeedback(sessionId: string, params: { satisfaction?: number | null; comment?: string | null }) {
  return apiFetch<{ ok: true }>('/api/quiz-feedback', {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...params }),
  });
}

// ---------- Per-question review (History) ----------

export function explainQuestion(questionId: string) {
  return apiFetch<{ explanation: string }>('/api/explain-question', {
    method: 'POST',
    body: JSON.stringify({ questionId }),
  });
}

export interface ValidationResult {
  independentAnswer: string;
  keyIsCorrect: boolean;
  verdict: string;
  storedCorrectOption: string;
  updatedCorrectOption: string;
  updatedExplanation: string;
  isCorrect: boolean | null;
  changed: boolean;
}

export function validateQuestion(questionId: string) {
  return apiFetch<ValidationResult>('/api/validate-question', {
    method: 'POST',
    body: JSON.stringify({ questionId }),
  });
}

// ---------- Learning verticals ----------

export function generateLearningVerticals(params: { journeyId: string; topic: string; domain: string }) {
  return apiFetch<{ generated: number }>('/api/generate-learning-verticals', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ---------- LLM provider settings ----------

export interface LlmSettingsResponse {
  provider: ProviderId | null;
  model: string | null;
  hasKey: boolean;
  usingDefault: boolean;
  defaultProvider?: string;
  defaultModel?: string;
  badgeLabel: string;
  usage?: { used: number; limit: number };
}

export function getLlmSettings() {
  return apiFetch<LlmSettingsResponse>('/api/llm-settings');
}

export function saveLlmSettings(params: { provider: ProviderId; model: string; apiKey?: string | null }) {
  return apiFetch<{ ok: true }>('/api/llm-settings', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
