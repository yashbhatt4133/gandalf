import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { DomainChip } from '../ui/Chip';
import { ProgressBar } from '../ui/ProgressBar';
import { useJourneys } from '../../lib/JourneysContext';
import { NewJourneyModal } from '../../screens/NewJourney/NewJourneyModal';
import { useJourneyProgress } from '../../lib/useJourneyProgress';

function JourneyNavItem({ id, topic, domain }: { id: string; topic: string; domain: string }) {
  const pct = useJourneyProgress(id);
  return (
    <NavLink
      to={`/journeys/${id}`}
      className={({ isActive }) => `mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors ${isActive ? '' : 'hover:bg-panel-2'}`}
      style={({ isActive }) => (isActive ? { background: 'rgba(139,92,246,0.16)' } : undefined)}
    >
      <DomainChip domain={domain} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 truncate text-[13px] font-semibold">{topic}</div>
        <ProgressBar pct={pct} small />
      </div>
    </NavLink>
  );
}

export function Sidebar() {
  const { journeys, refresh } = useJourneys();
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <aside className="w-[272px] flex-shrink-0 border-r border-border-soft bg-panel p-5">
      <Button block onClick={() => setModalOpen(true)}>
        + Start new practice
      </Button>

      <div className="mb-2.5 mt-6 font-mono text-[11.5px] font-bold uppercase tracking-wide text-text-dim">Your journeys</div>
      {journeys.length === 0 && <div className="px-2.5 py-2 text-[12.5px] text-text-muted">No journeys yet — start one above.</div>}
      {journeys.map((j) => (
        <JourneyNavItem key={j.id} id={j.id} topic={j.topic} domain={j.domain} />
      ))}

      <div className="mb-2.5 mt-6 font-mono text-[11.5px] font-bold uppercase tracking-wide text-text-dim">Practice</div>
      <NavLink to="/timed-test" className="mb-1 block rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-text-muted hover:bg-panel-2">
        ⏱ Time-Bound Test
      </NavLink>
      <NavLink to="/adaptive-quiz" className="mb-1 block rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-text-muted hover:bg-panel-2">
        🎯 Adaptive Quiz
      </NavLink>
      <NavLink to="/history" className="mb-1 block rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-text-muted hover:bg-panel-2">
        🕘 History
      </NavLink>
      <NavLink to="/settings" className="mb-1 block rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-text-muted hover:bg-panel-2">
        👤 Profile / Settings
      </NavLink>

      {modalOpen && (
        <NewJourneyModal
          onClose={() => setModalOpen(false)}
          onCreated={(journeyId) => {
            setModalOpen(false);
            refresh();
            navigate(`/journeys/${journeyId}`);
          }}
        />
      )}
    </aside>
  );
}
