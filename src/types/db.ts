// Mirrors context/ERD.md — kept in sync with the actual schema by hand.

export type TargetRole = 'Software Engineer' | 'AI Engineer' | 'ML Engineer' | 'Data Scientist' | 'Other';
export type ExperienceLevel = 'Student' | 'Fresher' | '1-3 YOE' | '3+ YOE' | 'Other';
export type ProviderId = 'ollama' | 'groq' | 'openai' | 'gemini';
export type JourneyStatus = 'active' | 'mastered' | 'abandoned';
export type StepName = 'quiz' | 'recommended_topics' | 'reassessment';
export type StepStatus = 'upcoming' | 'current' | 'done';
export type SessionType = 'calibration' | 'reassessment' | 'adaptive' | 'timed_test';
export type QuestionType = 'mcq' | 'predict_output';
export type Difficulty = 'foundational' | 'core' | 'advanced';
export type Tier = 'foundational' | 'core' | 'advanced';
export type RecommendedTopicStatus = 'todo' | 'done';

export interface Profile {
  user_id: string;
  display_name: string | null;
  target_role: TargetRole | null;
  experience_level: ExperienceLevel | null;
  resume_source: 'cv' | 'manual' | null;
  resume_raw_text: string | null;
  parsed_skills: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UserInterest {
  id: string;
  user_id: string;
  label: string;
}

export interface UserLlmSettings {
  user_id: string;
  preferred_provider: ProviderId | null;
  preferred_model: string | null;
  encrypted_api_key: string | null;
  updated_at: string;
}

export interface Journey {
  id: string;
  user_id: string;
  topic: string;
  domain: string;
  status: JourneyStatus;
  created_at: string;
}

export interface JourneyStep {
  id: string;
  journey_id: string;
  user_id: string;
  step_name: StepName;
  status: StepStatus;
  order_index: number;
}

export interface QuizSession {
  id: string;
  journey_id: string | null;
  user_id: string;
  session_type: SessionType;
  taken_at: string;
  score: number | null;
  level_at_time: Difficulty | null;
  completed: boolean;
  time_limit_seconds: number | null;
  time_taken_seconds: number | null;
  provider_used: string | null;
  model_used: string | null;
}

export interface QuizQuestion {
  id: string;
  quiz_session_id: string;
  user_id: string;
  question_text: string;
  question_type: QuestionType;
  code_snippet: string | null;
  language: string | null;
  options: Record<string, string>;
  correct_option?: string; // never sent to the client before answering
  chosen_option: string | null;
  is_correct: boolean | null;
  explanation: string | null;
  time_spent_seconds: number | null;
  difficulty: Difficulty;
  order_index: number;
}

/** Question shape as delivered to the browser — no answer key. */
export type ClientQuizQuestion = Omit<QuizQuestion, 'correct_option'>;

export interface TopicMastery {
  id: string;
  user_id: string;
  domain: string;
  topic: string;
  attempts_count: number;
  correct_count: number;
  avg_time_seconds: number;
  mastery_score: number;
  last_practiced_at: string | null;
  updated_at: string;
}

export interface RecommendedTopic {
  id: string;
  journey_id: string;
  user_id: string;
  title: string;
  rank: number;
  tier: Tier;
  hook_question: string;
  definition: string;
  example: string;
  analogy: string;
  analogy_interest: string | null;
  scenario: string;
  sources: { title: string; url: string }[];
  status: RecommendedTopicStatus;
}
