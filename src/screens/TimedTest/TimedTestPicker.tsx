import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TopicPicker } from '../../components/TopicPicker';
import { PreQuizFeedback, defaultPreQuizPrefs, preQuizPrefsToParams } from '../../components/PreQuizFeedback';
import { generateQuiz } from '../../lib/api';
import type { QuizRunnerState } from '../Quiz/QuizRunner';

const QUESTION_COUNTS = [5, 10, 15, 20];
const TIME_LIMITS_MIN = [5, 10, 15, 20];

export function TimedTestPicker() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [domain, setDomain] = useState<string | null>(params.get('domain'));
  const [topic, setTopic] = useState(params.get('topic') || '');
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState(10);
  const [customTime, setCustomTime] = useState(false);
  const [prefs, setPrefs] = useState(defaultPreQuizPrefs());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!domain || !topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType: 'timed_test',
        topic: topic.trim(),
        domain,
        questionCount,
        timeLimitSeconds: timeLimitMin * 60,
        ...preQuizPrefsToParams(prefs),
      });
      const state: QuizRunnerState = { questions, timeLimitSeconds, sessionType: 'timed_test', topic: topic.trim(), domain };
      navigate(`/timed-test/${sessionId}`, { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the test.');
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Time-Bound Test</h1>
      <p className="mb-6 text-[14.5px] text-text-muted">Simulate a real OA/OT — pick a topic, question count, and time limit, then race the clock.</p>

      <Card>
        <div className="mb-5">
          <TopicPicker
            domain={domain}
            topic={topic}
            onChange={(d, t) => {
              setDomain(d);
              setTopic(t);
            }}
          />
        </div>

        <div className="mb-5">
          <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Question count</div>
          <div className="flex flex-wrap items-center gap-2">
            {QUESTION_COUNTS.map((n) => {
              const active = !customCount && questionCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCustomCount(false);
                    setQuestionCount(n);
                  }}
                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
                  style={
                    active
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
                  }
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomCount(true)}
              className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
              style={
                customCount
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
              }
            >
              Custom
            </button>
            {customCount && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  autoFocus
                  onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, Number(e.target.value) || 0)))}
                  className="w-20 rounded-[10px] border border-border bg-panel px-3 py-1.5 text-[13px] text-text outline-none focus:border-accent"
                />
                <span className="text-[13px] text-text-muted">questions</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Time limit</div>
          <div className="flex flex-wrap items-center gap-2">
            {TIME_LIMITS_MIN.map((m) => {
              const active = !customTime && timeLimitMin === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCustomTime(false);
                    setTimeLimitMin(m);
                  }}
                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
                  style={
                    active
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
                  }
                >
                  {m} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomTime(true)}
              className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
              style={
                customTime
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
              }
            >
              Custom
            </button>
            {customTime && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timeLimitMin}
                  autoFocus
                  onChange={(e) => setTimeLimitMin(Math.max(1, Math.min(180, Number(e.target.value) || 0)))}
                  className="w-20 rounded-[10px] border border-border bg-panel px-3 py-1.5 text-[13px] text-text outline-none focus:border-accent"
                />
                <span className="text-[13px] text-text-muted">min</span>
              </div>
            )}
          </div>
        </div>

        <PreQuizFeedback prefs={prefs} onChange={setPrefs} />

        {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

        <Button onClick={handleStart} disabled={!domain || !topic.trim() || generating || timeLimitMin < 1 || questionCount < 1}>
          {generating ? 'Generating…' : 'Start test'}
        </Button>
      </Card>
    </div>
  );
}
