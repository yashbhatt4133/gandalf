import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TopicPicker } from '../../components/TopicPicker';
import { PreQuizFeedback, defaultPreQuizPrefs, preQuizPrefsToParams } from '../../components/PreQuizFeedback';
import { generateQuiz } from '../../lib/api';
import { usePageTitle } from '../../lib/PageTitleContext';
import type { QuizRunnerState } from '../Quiz/QuizRunner';

export function AdaptiveQuizScreen() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [prefs, setPrefs] = useState(defaultPreQuizPrefs());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle('Adaptive Quiz');

  async function handleStart() {
    if (!domain || !topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType: 'adaptive',
        topic: topic.trim(),
        domain,
        questionCount: 1,
        ...preQuizPrefsToParams(prefs),
      });
      const state: QuizRunnerState = { questions, timeLimitSeconds, sessionType: 'adaptive', topic: topic.trim(), domain };
      navigate(`/adaptive-quiz/${sessionId}`, { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the quiz.');
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Adaptive Quiz</h1>
      <p className="mb-6 text-[14.5px] text-text-muted">Freeform, untimed practice — one question at a time, with an explanation right after each answer. Finish whenever you like.</p>

      <Card>
        <div className="mb-6">
          <TopicPicker
            domain={domain}
            topic={topic}
            enableCustomTopic
            enableSuggest
            onChange={(d, t) => {
              setDomain(d);
              setTopic(t);
            }}
          />
        </div>

        <PreQuizFeedback prefs={prefs} onChange={setPrefs} />

        {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

        <Button onClick={handleStart} disabled={!domain || !topic.trim() || generating}>
          {generating ? 'Generating…' : 'Start quiz'}
        </Button>
      </Card>
    </div>
  );
}
