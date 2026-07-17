import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TopicPicker, type CustomFocus } from '../../components/TopicPicker';
import { GeneratingChecklist } from '../../components/GeneratingChecklist';
import { GandalfMark } from '../../components/ui/GandalfMark';
import { PreQuizFeedback, defaultPreQuizPrefs, preQuizPrefsToParams } from '../../components/PreQuizFeedback';
import { useAuth } from '../../lib/AuthContext';
import { createJourney } from '../../lib/journeys';
import { generateQuiz } from '../../lib/api';
import type { QuizRunnerState } from '../Quiz/QuizRunner';

/** Builds the generation "description" for a focused role/company journey. */
function focusDescription(focus: CustomFocus): string {
  const role = focus.role.trim();
  const company = focus.company.trim();
  const notes = focus.notes.trim();
  const parts = [`Focused interview preparation for a ${role} role${company ? ` at ${company}` : ''}.`];
  if (notes) parts.push(notes);
  return parts.join(' ');
}

export function NewJourneyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (journeyId: string) => void }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [domain, setDomain] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState<CustomFocus | null>(null);
  const [prefs, setPrefs] = useState(defaultPreQuizPrefs());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!domain && !!topic.trim() && (!focus || !!focus.role.trim());

  async function handleStart() {
    if (!ready) return;
    setGenerating(true);
    setError(null);
    try {
      const journey = await createJourney(session!.user.id, topic.trim(), domain!);
      // A focused (role/company) journey feeds its own description into
      // generation; otherwise use the optional pre-quiz description.
      const params = focus
        ? { preDifficulty: undefined, preQuestionTypes: undefined, description: [focusDescription(focus), prefs.description.trim()].filter(Boolean).join(' ') }
        : preQuizPrefsToParams(prefs);

      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType: 'calibration',
        topic: topic.trim(),
        domain: domain!,
        questionCount: 5,
        journeyId: journey.id,
        ...params,
      });

      const state: QuizRunnerState = { questions, timeLimitSeconds, sessionType: 'calibration', topic: topic.trim(), domain: domain!, journeyId: journey.id };
      onCreated(journey.id);
      navigate(`/journeys/${journey.id}/quiz/${sessionId}`, { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start this journey.');
      setGenerating(false);
    }
  }

  // Rendered through a portal to <body> so the overlay is never trapped by a
  // positioned/filtered ancestor. (The Sidebar that mounts this modal uses
  // `backdrop-filter`, which makes it a containing block for fixed-position
  // descendants — without the portal the overlay anchors to the sidebar and
  // shows up as a narrow side panel instead of a centered popup.)
  return createPortal(
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {generating ? (
          <>
            <GandalfMark size={72} className="mx-auto mb-2 block" />
            <GeneratingChecklist title={`Building your calibration quiz on ${topic}…`} />
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col items-center text-center">
              <GandalfMark size={80} className="mb-2 block" />
              <h2 className="text-lg font-bold">Start a new practice journey</h2>
              <p className="mt-1 text-[13px] text-text-muted">Pick a domain and topic — or target a specific role &amp; company — and I'll set a 5-question calibration quiz to kick it off.</p>
            </div>

            <TopicPicker
              domain={domain}
              topic={topic}
              enableCustomFocus
              enableCustomTopic
              onFocusChange={setFocus}
              onChange={(d, t) => {
                setDomain(d);
                setTopic(t);
              }}
            />

            {!focus && (
              <div className="mt-5">
                <PreQuizFeedback prefs={prefs} onChange={setPrefs} />
              </div>
            )}

            {error && <p className="mb-3 mt-4 text-[13px] text-danger">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={!ready}>
                Start journey
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>,
    document.body,
  );
}
