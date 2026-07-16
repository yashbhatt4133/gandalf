import { domainChipClass } from '../../lib/taxonomy';

export function DomainChip({ domain }: { domain: string }) {
  return <span className={`chip domain-${domainChipClass(domain)}`}>{domain}</span>;
}

export function TierChip({ tier }: { tier: 'foundational' | 'core' | 'advanced' }) {
  return <span className={`tier-chip ${tier}`}>{tier}</span>;
}

export function StatusPill({ status }: { status: 'active' | 'mastered' | 'abandoned' }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-pill ${status}`}>{label}</span>;
}
