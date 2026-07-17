import { ChipSelect } from './ui/ChipSelect';
import type { Difficulty, QuestionType } from '../types/db';

const QUESTION_TYPE_OPTIONS: { label: string; value: QuestionType | 'any' }[] = [
  { label: 'Any mix', value: 'any' },
  { label: 'Conceptual (MCQ)', value: 'mcq' },
  { label: 'Predict the output', value: 'predict_output' },
];

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty | 'any' }[] = [
  { label: 'Any', value: 'any' },
  { label: 'Foundational', value: 'foundational' },
  { label: 'Core', value: 'core' },
  { label: 'Advanced', value: 'advanced' },
];

export interface PreQuizPrefs {
  questionType: QuestionType | 'any';
  difficulty: Difficulty | 'any';
  description: string;
}

export function defaultPreQuizPrefs(): PreQuizPrefs {
  return { questionType: 'any', difficulty: 'any', description: '' };
}

/** Maps the UI's "any" sentinel to the params `generateQuiz` expects (undefined = no preference). */
export function preQuizPrefsToParams(prefs: PreQuizPrefs) {
  return {
    preQuestionTypes: prefs.questionType === 'any' ? undefined : [prefs.questionType],
    preDifficulty: prefs.difficulty === 'any' ? undefined : prefs.difficulty,
    description: prefs.description.trim() ? prefs.description.trim() : undefined,
  };
}

export function PreQuizFeedback({ prefs, onChange }: { prefs: PreQuizPrefs; onChange: (prefs: PreQuizPrefs) => void }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Before you start — any preference?</div>
      <div className="mb-3">
        <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">Question types</div>
        <ChipSelect
          options={QUESTION_TYPE_OPTIONS.map((o) => o.label)}
          value={QUESTION_TYPE_OPTIONS.find((o) => o.value === prefs.questionType)?.label ?? null}
          onChange={(label) => {
            const opt = QUESTION_TYPE_OPTIONS.find((o) => o.label === label);
            if (opt) onChange({ ...prefs, questionType: opt.value });
          }}
        />
      </div>
      <div className="mb-3">
        <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">Difficulty</div>
        <ChipSelect
          options={DIFFICULTY_OPTIONS.map((o) => o.label)}
          value={DIFFICULTY_OPTIONS.find((o) => o.value === prefs.difficulty)?.label ?? null}
          onChange={(label) => {
            const opt = DIFFICULTY_OPTIONS.find((o) => o.label === label);
            if (opt) onChange({ ...prefs, difficulty: opt.value });
          }}
        />
      </div>
      <div>
        <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">Description (optional)</div>
        <textarea
          value={prefs.description}
          onChange={(e) => onChange({ ...prefs, description: e.target.value })}
          placeholder="Anything specific you want? e.g. 'focus on virtual functions and pointers', 'real FAANG OA-style questions'…"
          rows={2}
          className="w-full rounded-xl border border-border-soft bg-panel-2 px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-dim focus:border-accent"
        />
      </div>
    </div>
  );
}
